import { CheerioCrawler, log, LogLevel } from 'crawlee';
import { eq } from 'drizzle-orm';
import { router } from './router.js';
import { findCategory, buildListUrl, type CategoryConfig } from './categories.js';
import { config } from '../config.js';
import { getDb } from '../db/connection.js';
import { listings, crawlRuns } from '../db/schema.js';

export interface CrawlOptions {
  category?: string;
  subcategory?: string;
  regionSlug?: string;
  maxPages?: number;
  full?: boolean;
  detailOnly?: boolean;
  logLevel?: string;
}

/**
 * Create and configure the CheerioCrawler.
 */
function createCrawler() {
  return new CheerioCrawler({
    requestHandler: router,
    maxConcurrency: config.crawler.maxConcurrency,
    maxRequestsPerMinute: config.crawler.maxRequestsPerMinute,
    maxRequestRetries: config.crawler.maxRequestRetries,
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 30,
    useSessionPool: true,
    sessionPoolOptions: {
      maxPoolSize: 10,
    },
    // Respectful delay between requests to same domain
    sameDomainDelaySecs: config.crawler.sameDomainDelaySecs,
    failedRequestHandler: async ({ request }, error) => {
      const db = getDb();
      const crawlRunId = request.userData.crawlRunId as number | undefined;
      const errMsg = (error as Error).message || '';

      // Extract status code from error message (Crawlee includes it)
      const statusMatch = errMsg.match(/(\d{3})/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : null;

      log.error(`Request failed: ${request.url}`, { error: errMsg });

      await db.insert((await import('../db/schema.js')).crawlErrors).values({
        crawlRunId: crawlRunId || null,
        url: request.url,
        errorType: statusCode === 429 ? 'blocked'
          : statusCode === 404 ? 'http_error'
          : 'timeout',
        statusCode,
        message: errMsg,
        occurredAt: new Date().toISOString(),
      });

      // Mark listing as removed if 404 on detail page
      if (statusCode === 404 && request.label === 'DETAIL') {
        const adId = request.userData.adId as string;
        if (adId) {
          await db.update(listings)
            .set({ removedAt: new Date().toISOString() })
            .where(eq(listings.adId, adId));
        }
      }
    },
  });
}

/**
 * Run the crawler with the given options.
 */
export async function runCrawl(options: CrawlOptions): Promise<void> {
  const {
    category,
    subcategory,
    regionSlug,
    maxPages = config.crawler.defaultMaxPages,
    full = false,
    detailOnly = false,
    logLevel = config.log.level,
  } = options;

  // Set log level
  log.setLevel(logLevel === 'debug' ? LogLevel.DEBUG : LogLevel.INFO);

  const db = getDb();
  const startedAt = new Date().toISOString();

  // Create crawl run record
  const crawlRun = await db.insert(crawlRuns).values({
    startedAt,
    status: 'running',
    category: category || null,
    subcategory: subcategory || null,
    regionSlug: regionSlug || null,
  }).returning({ id: crawlRuns.id });

  const crawlRunId = crawlRun[0].id;
  log.info(`Crawl run #${crawlRunId} started`);

  const crawler = createCrawler();
  const effectiveMaxPages = full ? 500 : maxPages;

  try {
    if (detailOnly) {
      // Only crawl detail pages for listings missing detail data
      await crawlDetailOnly(crawler, crawlRunId, category, subcategory);
    } else {
      // Normal crawl: list pages first, then details
      const categories = findCategory(category, subcategory);

      if (categories.length === 0) {
        log.error('No matching categories found', { category, subcategory });
        return;
      }

      log.info(`Crawling ${categories.length} categories, max ${effectiveMaxPages} pages each`);

      // Enqueue first page of each category
      const requests = categories.map((cat) => ({
        url: buildListUrl(cat, regionSlug, 1),
        label: 'LIST',
        userData: {
          categoryConfig: cat,
          regionSlug,
          maxPages: effectiveMaxPages,
          crawlRunId,
          page: 1,
        },
      }));

      await crawler.run(requests);
    }

    // Update crawl run as completed
    const finishedAt = new Date().toISOString();
    const durationSecs = Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);

    // Count stats from DB
    const stats = await getCrawlStats(db, crawlRunId, startedAt);

    await db.update(crawlRuns)
      .set({
        finishedAt,
        status: 'completed',
        durationSecs,
        ...stats,
      })
      .where(eq(crawlRuns.id, crawlRunId));

    log.info(`Crawl run #${crawlRunId} completed in ${durationSecs}s`, stats);
  } catch (error) {
    await db.update(crawlRuns)
      .set({
        finishedAt: new Date().toISOString(),
        status: 'failed',
      })
      .where(eq(crawlRuns.id, crawlRunId));
    throw error;
  }
}

/**
 * Crawl only detail pages for listings that haven't been detail-crawled yet.
 */
async function crawlDetailOnly(
  crawler: CheerioCrawler,
  crawlRunId: number,
  category?: string,
  subcategory?: string,
) {
  const db = getDb();

  let query = db
    .select({ adId: listings.adId, url: listings.url })
    .from(listings)
    .where(eq(listings.detailCrawled, false));

  const uncrawled = await query.all();

  // Filter by category/subcategory if specified
  let filtered = uncrawled;
  if (category) {
    const allListings = await db
      .select({ adId: listings.adId, url: listings.url, category: listings.category, subcategory: listings.subcategory })
      .from(listings)
      .where(eq(listings.detailCrawled, false))
      .all();

    filtered = allListings.filter((l) => {
      if (category && l.category !== category) return false;
      if (subcategory && l.subcategory !== subcategory) return false;
      return true;
    });
  }

  if (filtered.length === 0) {
    log.info('No listings need detail crawling');
    return;
  }

  log.info(`Enqueueing ${filtered.length} detail pages`);

  const requests = filtered.map((l) => ({
    url: l.url,
    label: 'DETAIL',
    userData: { adId: l.adId, crawlRunId },
  }));

  await crawler.run(requests);
}

/**
 * Get stats for a completed crawl run.
 */
async function getCrawlStats(db: ReturnType<typeof getDb>, crawlRunId: number, startedAt: string) {
  const { sql } = await import('drizzle-orm');

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .all();

  const [newResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .where(sql`${listings.firstSeenAt} >= ${startedAt}`)
    .all();

  const [detailResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .where(sql`${listings.updatedAt} >= ${startedAt} AND ${listings.detailCrawled} = 1`)
    .all();

  return {
    listingsFound: totalResult?.count || 0,
    listingsNew: newResult?.count || 0,
    detailsCrawled: detailResult?.count || 0,
  };
}
