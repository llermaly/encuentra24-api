import { eq, sql } from 'drizzle-orm';
import { CheerioCrawler, Configuration, log, LogLevel } from 'crawlee';
import { getDb } from '../../db/connection.js';
import { sellers } from '../../db/schema.js';
import { config } from '../../config.js';

async function main() {
  const db = getDb();
  const pending = await db
    .select({ id: sellers.id, name: sellers.name, sampleListingUrl: sellers.sampleListingUrl })
    .from(sellers)
    .where(sql`${sellers.whatsapp} IS NULL AND ${sellers.sampleListingUrl} IS NOT NULL`)
    .all();

  console.log(`Sellers to crawl: ${pending.length}`);
  if (pending.length === 0) return;

  Configuration.getGlobalConfig().set('persistStorage', false);
  log.setLevel(LogLevel.WARNING);

  let found = 0;
  let notFound = 0;

  const crawler = new CheerioCrawler({
    minConcurrency: config.crawler.maxConcurrency,
    maxConcurrency: config.crawler.maxConcurrency,
    maxRequestsPerMinute: config.crawler.maxRequestsPerMinute,
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 30,
    sameDomainDelaySecs: config.crawler.sameDomainDelaySecs,
    requestHandler: async ({ $, request }) => {
      const sellerId = request.userData.sellerId as number;
      const waHref = $('a[href*="wa.me"]').attr('href') || null;
      const whatsapp = waHref ? waHref.replace('https://wa.me/', '').split('?')[0] : null;
      const phoneHref = $('a[href^="tel:"]').first().attr('href') || null;
      const phone = phoneHref ? phoneHref.replace('tel:', '').trim() : null;
      const profileUrl = $('.d3-ad-contact a[href*=profile], .d3-property-contact a[href*=profile]').attr('href') || null;

      await db.update(sellers)
        .set({ whatsapp: whatsapp || '', phone, profileUrl, updatedAt: new Date().toISOString() })
        .where(eq(sellers.id, sellerId));

      if (whatsapp) found++;
      else notFound++;
    },
    failedRequestHandler: async ({ request }) => {
      await db.update(sellers)
        .set({ whatsapp: '', updatedAt: new Date().toISOString() })
        .where(eq(sellers.id, request.userData.sellerId as number));
      notFound++;
    },
  });

  await crawler.run(pending.map(s => ({
    url: s.sampleListingUrl!,
    userData: { sellerId: s.id, sellerName: s.name },
  })));

  console.log(`Done: ${found} with WhatsApp, ${notFound} without`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
