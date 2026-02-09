import { Command } from 'commander';
import { eq, sql, isNull } from 'drizzle-orm';
import { CheerioCrawler, Configuration, log, LogLevel } from 'crawlee';
import { getDb } from '../../db/connection.js';
import { listings, sellers } from '../../db/schema.js';
import { config } from '../../config.js';

/**
 * Populate the sellers table from existing listing data.
 */
async function syncSellers() {
  const db = getDb();
  const now = new Date().toISOString();

  // Get unique sellers from listings
  const uniqueSellers = await db
    .select({
      name: listings.sellerName,
      type: listings.sellerType,
      verified: listings.sellerVerified,
      count: sql<number>`count(*)`,
      sampleUrl: sql<string>`min(${listings.url})`,
    })
    .from(listings)
    .where(sql`${listings.sellerName} IS NOT NULL AND ${listings.sellerName} != ''`)
    .groupBy(listings.sellerName)
    .all();

  let inserted = 0;
  let updated = 0;

  for (const s of uniqueSellers) {
    const existing = await db
      .select({ id: sellers.id })
      .from(sellers)
      .where(eq(sellers.name, s.name!))
      .get();

    if (!existing) {
      await db.insert(sellers).values({
        name: s.name!,
        type: s.type || null,
        verified: s.verified || false,
        listingCount: s.count,
        sampleListingUrl: s.sampleUrl,
        firstSeenAt: now,
        updatedAt: now,
      });
      inserted++;
    } else {
      await db.update(sellers)
        .set({ listingCount: s.count, updatedAt: now })
        .where(eq(sellers.id, existing.id));
      updated++;
    }
  }

  console.log(`Sellers synced: ${inserted} new, ${updated} updated (${uniqueSellers.length} total)`);

  // Link listings to sellers via seller_id
  const allSellers = await db.select({ id: sellers.id, name: sellers.name }).from(sellers).all();
  const sellerMap = new Map(allSellers.map(s => [s.name, s.id]));

  let linked = 0;
  for (const [name, sellerId] of sellerMap) {
    const result = await db.update(listings)
      .set({ sellerId })
      .where(sql`${listings.sellerName} = ${name} AND (${listings.sellerId} IS NULL OR ${listings.sellerId} != ${sellerId})`);
    linked += result.rowsAffected;
  }

  console.log(`Linked ${linked} listings to sellers`);
}

/**
 * Crawl WhatsApp numbers for sellers that don't have one yet.
 */
async function crawlSellerContacts() {
  const db = getDb();

  // Get sellers missing WhatsApp, with a sample listing URL to crawl
  const pending = await db
    .select({
      id: sellers.id,
      name: sellers.name,
      sampleListingUrl: sellers.sampleListingUrl,
    })
    .from(sellers)
    .where(sql`${sellers.whatsapp} IS NULL AND ${sellers.sampleListingUrl} IS NOT NULL`)
    .all();

  if (pending.length === 0) {
    console.log('All sellers already have contact info.');
    return;
  }

  console.log(`Crawling contact info for ${pending.length} sellers...`);

  Configuration.getGlobalConfig().set('persistStorage', false);
  log.setLevel(LogLevel.INFO);

  let found = 0;
  let notFound = 0;

  const crawler = new CheerioCrawler({
    minConcurrency: config.crawler.maxConcurrency,
    maxConcurrency: config.crawler.maxConcurrency,
    maxRequestsPerMinute: config.crawler.maxRequestsPerMinute,
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 30,
    navigationTimeoutSecs: 20,
    sameDomainDelaySecs: config.crawler.sameDomainDelaySecs,
    requestHandler: async ({ $, request }) => {
      const sellerId = request.userData.sellerId as number;
      const sellerName = request.userData.sellerName as string;

      // Extract WhatsApp link
      const waHref = $('a[href*="wa.me"]').attr('href') || null;
      const whatsapp = waHref ? waHref.replace('https://wa.me/', '').split('?')[0] : null;

      // Extract phone from tel: links
      const phoneHref = $('a[href^="tel:"]').first().attr('href') || null;
      const phone = phoneHref ? phoneHref.replace('tel:', '').trim() : null;

      // Extract profile URL
      const profileUrl = $('.d3-ad-contact a[href*="/profile/"], .d3-property-contact a[href*="/profile/"]').attr('href') || null;

      if (whatsapp || phone) {
        await db.update(sellers)
          .set({
            whatsapp,
            phone,
            profileUrl,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(sellers.id, sellerId));
        found++;
        log.info(`Found contact for "${sellerName}": WA=${whatsapp}, Phone=${phone}`);
      } else {
        // Mark as checked (empty string) so we don't re-crawl
        await db.update(sellers)
          .set({ whatsapp: '', updatedAt: new Date().toISOString() })
          .where(eq(sellers.id, sellerId));
        notFound++;
      }
    },
    failedRequestHandler: async ({ request }, error) => {
      log.warning(`Failed to crawl contact for seller: ${request.userData.sellerName}`, {
        error: (error as Error).message,
      });
    },
  });

  const requests = pending.map(s => ({
    url: s.sampleListingUrl!,
    userData: { sellerId: s.id, sellerName: s.name },
  }));

  await crawler.run(requests);
  console.log(`\nDone: ${found} contacts found, ${notFound} without WhatsApp/phone`);
}

export const sellersCommand = new Command('sellers')
  .description('Manage seller/agent data')
  .addCommand(
    new Command('sync')
      .description('Populate sellers table from listing data')
      .action(async () => {
        await syncSellers();
      })
  )
  .addCommand(
    new Command('crawl-contacts')
      .description('Crawl WhatsApp/phone numbers for sellers')
      .action(async () => {
        await syncSellers();
        await crawlSellerContacts();
      })
  )
  .addCommand(
    new Command('stats')
      .description('Show seller statistics')
      .action(async () => {
        const db = getDb();
        const total = await db.select({ count: sql<number>`count(*)` }).from(sellers).all();
        const withWa = await db.select({ count: sql<number>`count(*)` }).from(sellers).where(sql`${sellers.whatsapp} IS NOT NULL AND ${sellers.whatsapp} != ''`).all();
        const pending = await db.select({ count: sql<number>`count(*)` }).from(sellers).where(isNull(sellers.whatsapp)).all();
        const topSellers = await db
          .select({ name: sellers.name, whatsapp: sellers.whatsapp, listingCount: sellers.listingCount })
          .from(sellers)
          .orderBy(sql`${sellers.listingCount} DESC`)
          .limit(15)
          .all();

        console.log(`\n=== Seller Stats ===`);
        console.log(`Total sellers: ${total[0].count}`);
        console.log(`With WhatsApp: ${withWa[0].count}`);
        console.log(`Pending contact crawl: ${pending[0].count}`);
        console.log(`\nTop sellers:`);
        topSellers.forEach(s => {
          const wa = s.whatsapp ? ` | WA: ${s.whatsapp}` : '';
          console.log(`  ${s.name} (${s.listingCount} listings${wa})`);
        });
      })
  );
