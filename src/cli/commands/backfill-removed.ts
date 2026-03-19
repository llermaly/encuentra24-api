import { CheerioCrawler, log, LogLevel } from 'crawlee';
import { eq, isNull, and } from 'drizzle-orm';
import { getDb, initDb } from '../../db/connection.js';
import { listings } from '../../db/schema.js';

export async function backfillRemoved(options: { concurrency?: number; rateLimit?: number; batchSize?: number }) {
  const {
    concurrency = 10,
    rateLimit = 200,
    batchSize = 1000,
  } = options;

  log.setLevel(LogLevel.INFO);
  await initDb();
  const db = getDb();

  // Get all listings that haven't been checked for removal yet
  const unchecked = await db
    .select({ adId: listings.adId, url: listings.url })
    .from(listings)
    .where(and(
      isNull(listings.removalCheckedAt),
      isNull(listings.removedAt),
    ));

  if (unchecked.length === 0) {
    log.info('All listings have been checked for removal. Nothing to do.');
    return;
  }

  log.info(`Found ${unchecked.length} listings to check for removal`);

  let checked = 0;
  let removed = 0;
  let valid = 0;
  const startTime = Date.now();

  const crawler = new CheerioCrawler({
    maxConcurrency: concurrency,
    maxRequestsPerMinute: rateLimit,
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 30,
    navigationTimeoutSecs: 15,
    useSessionPool: true,
    sessionPoolOptions: { maxPoolSize: concurrency },
    sameDomainDelaySecs: 0.5,

    requestHandler: async ({ $, request }) => {
      const adId = request.userData.adId as string;
      const now = new Date().toISOString();

      const jsonLdScripts = $('script[type="application/ld+json"]');
      const hasProductJsonLd = jsonLdScripts.toArray().some((el) => {
        const text = $(el).text();
        return text.includes('"@type":"Product"') || text.includes('"@type": "Product"');
      });

      if (!hasProductJsonLd) {
        await db.update(listings)
          .set({ removedAt: now, removalCheckedAt: now, updatedAt: now })
          .where(eq(listings.adId, adId));
        removed++;
      } else {
        await db.update(listings)
          .set({ removalCheckedAt: now })
          .where(eq(listings.adId, adId));
        valid++;
      }

      checked++;
      if (checked % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const rate = Math.round(checked / elapsed);
        log.info(`Progress: ${checked}/${unchecked.length} checked (${removed} removed, ${valid} valid) — ${rate}/min`);
      }
    },

    failedRequestHandler: async ({ request }, error) => {
      const adId = request.userData.adId as string;
      log.error(`Failed to check ${adId}: ${(error as Error).message}`);
      checked++;
    },
  });

  const requests = unchecked.map((l) => ({
    url: l.url,
    userData: { adId: l.adId },
  }));

  await crawler.run(requests);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  log.info(`Backfill complete in ${elapsed}s: ${checked} checked, ${removed} removed, ${valid} valid`);
}
