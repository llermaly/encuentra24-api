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
    sameDomainDelaySecs: 0,

    requestHandler: async ({ $, request }) => {
      const adId = request.userData.adId as string;
      const now = new Date().toISOString();

      const isSearchResultsPage = $('.d3-ad-tile').length > 1;
      const hasContactForm = $('[id^="messageform"]').length > 0;

      if (isSearchResultsPage && !hasContactForm) {
        // Use lastSeenAt as approximate removal date (last time crawler saw it alive)
        const row = await db
          .select({ lastSeenAt: listings.lastSeenAt })
          .from(listings)
          .where(eq(listings.adId, adId))
          .then(r => r[0]);
        const removedDate = row?.lastSeenAt || now;
        await db.update(listings)
          .set({ removedAt: removedDate, removalCheckedAt: now, updatedAt: now })
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
      // Vacuum every 5000 rows to prevent table bloat
      if (checked % 5000 === 0) {
        log.info('Running VACUUM ANALYZE to prevent bloat...');
        const dbUrl = process.env.DATABASE_URL || '';
        // VACUUM needs direct connection (port 5432), not transaction pooler (6543)
        const vacuumUrl = dbUrl.replace(':6543/', ':5432/');
        const { execSync } = await import('child_process');
        try {
          execSync(`psql "${vacuumUrl}" -c "VACUUM ANALYZE listings;"`, { timeout: 120000 });
          log.info('VACUUM completed');
        } catch {
          log.info('VACUUM skipped (direct connection unavailable)');
        }
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
