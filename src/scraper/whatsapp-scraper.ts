import { chromium, type Browser, type Page } from 'playwright';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { sellers } from '../db/schema.js';
import { config } from '../config.js';

const GENERIC_WA = '50764261804';

/**
 * Extract the real WhatsApp number from a single listing page.
 *
 * Strategy:
 *  1. Navigate to the listing URL, wait for reCAPTCHA to init
 *  2. Fill the inline contact form (email, name, phone)
 *  3. Click the WhatsApp button — the page JS POSTs the form via AJAX
 *  4. Intercept the AJAX JSON response: { success: true, content: "https://wa.me/NUMBER?..." }
 *  5. Extract the phone number from the response content URL
 */
async function extractWhatsApp(page: Page, listingUrl: string): Promise<string | null> {
  await page.goto(listingUrl, {
    waitUntil: 'load',
    timeout: config.scraper.pageTimeoutMs,
  });

  // Wait for reCAPTCHA to load and generate token
  await page.waitForTimeout(5000);

  // Check if WhatsApp button exists
  const formExists = await page.locator('.show-whatsapp').isVisible({ timeout: 5000 }).catch(() => false);
  if (!formExists) {
    return null;
  }

  // Fill the contact form fields
  const emailInput = page.locator('input[name="cnmessage[fromemail]"]');
  const nameInput = page.locator('input[name="cnmessage[name]"]');
  const telInput = page.locator('input.init-tel-input');

  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await emailInput.fill(config.scraper.contactEmail);
  }
  if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nameInput.fill(config.scraper.contactName);
  }
  if (await telInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await telInput.fill(config.scraper.contactPhone);
  }

  // Regenerate reCAPTCHA token right before submitting
  await page.evaluate(() => {
    const w = window as any;
    if (typeof w.regenerateRecaptchaToken === 'function') {
      w.regenerateRecaptchaToken();
    }
  });
  await page.waitForTimeout(2000);

  // Set up a promise to capture the AJAX response from the form POST
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('cnmessage/send'),
    { timeout: 15000 },
  ).catch(() => null);

  // Click the WhatsApp button
  await page.locator('.show-whatsapp').click();

  // Wait for the form POST response
  const response = await responsePromise;
  if (!response) {
    return null;
  }

  const body = await response.text().catch(() => '');

  // Successful response is JSON: { success: true, content: "https://wa.me/NUMBER?..." }
  if (!body.startsWith('{')) {
    return null;
  }

  try {
    const data = JSON.parse(body);
    if (data.success && data.content) {
      const match = data.content.match(/wa\.me\/(\d+)/);
      if (match) {
        const number = match[1];
        // Close any popup tab that window.open created
        const pages = page.context().pages();
        for (const p of pages) {
          if (p !== page) {
            await p.close().catch(() => {});
          }
        }
        return number === GENERIC_WA ? null : number;
      }
    }
  } catch {}

  return null;
}

export interface ScrapeWhatsAppOptions {
  headless?: boolean;
  limit?: number;
  dryRun?: boolean;
}

/**
 * Batch runner: query sellers without WhatsApp and scrape their real numbers.
 */
export async function scrapeWhatsAppBatch(options: ScrapeWhatsAppOptions = {}) {
  const { headless = config.scraper.headless, limit, dryRun = false } = options;
  const db = getDb();

  // Use sample_listing_url from sellers table directly (avoids expensive join)
  const sellersWithUrls = await db
    .select({
      id: sellers.id,
      name: sellers.name,
      listing_url: sellers.sampleListingUrl,
    })
    .from(sellers)
    .where(sql`(${sellers.whatsapp} IS NULL OR ${sellers.whatsapp} = ${GENERIC_WA}) AND ${sellers.sampleListingUrl} IS NOT NULL`)
    .all() as Array<{ id: number; name: string; listing_url: string }>;

  if (sellersWithUrls.length === 0) {
    console.log('No sellers need WhatsApp scraping.');
    return;
  }

  const toProcess = limit ? sellersWithUrls.slice(0, limit) : sellersWithUrls;
  console.log(`Found ${sellersWithUrls.length} sellers to scrape. Processing ${toProcess.length}.`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would scrape:');
    for (const s of toProcess) {
      console.log(`  ${s.name} → ${s.listing_url}`);
    }
    return;
  }

  const RESTART_EVERY = 200; // Restart browser to prevent memory leaks

  async function launchBrowser() {
    const b = await chromium.launch({ headless });
    const ctx = await b.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const p = await ctx.newPage();
    return { browser: b, page: p };
  }

  let { browser, page } = await launchBrowser();
  let pagesSinceRestart = 0;
  let found = 0;
  let notFound = 0;
  let errors = 0;

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const seller = toProcess[i];
      const progress = `[${i + 1}/${toProcess.length}]`;

      // Restart browser periodically to prevent memory crashes
      if (pagesSinceRestart >= RESTART_EVERY) {
        await browser.close();
        ({ browser, page } = await launchBrowser());
        pagesSinceRestart = 0;
        console.log(`  (browser restarted)`);
      }

      try {
        const whatsapp = await extractWhatsApp(page, seller.listing_url);

        if (whatsapp) {
          await db.update(sellers)
            .set({
              whatsapp,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(sellers.id, seller.id));
          found++;
          console.log(`${progress} ✓ ${seller.name}: ${whatsapp}`);
        } else {
          // Mark as empty string so we don't re-scrape
          await db.update(sellers)
            .set({
              whatsapp: '',
              updatedAt: new Date().toISOString(),
            })
            .where(eq(sellers.id, seller.id));
          notFound++;
          console.log(`${progress} - ${seller.name}: no WhatsApp found`);
        }
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${progress} ✗ ${seller.name}: ${msg}`);
      }

      pagesSinceRestart++;

      // Delay between requests
      if (i < toProcess.length - 1) {
        await new Promise(r => setTimeout(r, config.scraper.delayBetweenMs));
      }
    }

    console.log(`\nDone: ${found} found, ${notFound} not found, ${errors} errors`);
  } finally {
    await browser.close();
  }
}
