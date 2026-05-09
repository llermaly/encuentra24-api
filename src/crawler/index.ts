import { CheerioCrawler, Configuration, log, LogLevel } from 'crawlee';
import { eq, sql, isNull, lt } from 'drizzle-orm';
import { rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { router } from './router.js';
import { findCategory, buildListUrl, type CategoryConfig } from './categories.js';
import { config } from '../config.js';
import { getDb, initDb } from '../db/connection.js';
import { listings, crawlRuns, crawlErrors, crawlSeenListings } from '../db/schema.js';
import { flushListingDatasetEvents } from './dataset-sync.js';
import {
  finishCrawlMetrics,
  getCrawlMetrics,
  incrementCrawlMetric,
  startCrawlMetrics,
  type CrawlRuntimeMetrics,
} from './metrics.js';

export interface CrawlOptions {
  category?: string;
  subcategory?: string;
  regionSlug?: string;
  maxPages?: number;
  full?: boolean;
  detailOnly?: boolean;
  crawlDetails?: boolean;
  syncDataset?: boolean;
  logLevel?: string;
  cleanupStorage?: boolean;
  persistCrawlerStorage?: boolean;
}

export interface CrawlRunResult {
  crawlRunId: number;
  type: 'full' | 'incremental';
  startedAt: string;
  finishedAt: string;
  durationSecs: number;
  category: string | null;
  subcategory: string | null;
  regionSlug: string | null;
  full: boolean;
  detailOnly: boolean;
  crawlDetails: boolean;
  syncDataset: boolean;
  removedCount: number;
  stats: {
    pagesProcessed: number;
    listingsFound: number;
    listingsNew: number;
    listingsUpdated: number;
    detailsCrawled: number;
    errors: number;
  };
  runtimeMetrics: CrawlRuntimeMetrics;
}

function toLogLevel(level: string): LogLevel {
  const normalized = level.toLowerCase();

  if (normalized === 'debug') return LogLevel.DEBUG;
  if (normalized === 'warn' || normalized === 'warning') return LogLevel.WARNING;
  if (normalized === 'error') return LogLevel.ERROR;

  return LogLevel.INFO;
}

/**
 * Create and configure the CheerioCrawler.
 */
function createCrawler(persistCrawlerStorage: boolean) {
  return new CheerioCrawler({
    requestHandler: router,
    minConcurrency: config.crawler.maxConcurrency,
    maxConcurrency: config.crawler.maxConcurrency,
    maxRequestsPerMinute: config.crawler.maxRequestsPerMinute,
    maxRequestRetries: config.crawler.maxRequestRetries,
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 30,
    useSessionPool: true,
    sessionPoolOptions: {
      maxPoolSize: config.crawler.maxConcurrency,
    },
    sameDomainDelaySecs: config.crawler.sameDomainDelaySecs,
    failedRequestHandler: async ({ request }, error) => {
      const db = getDb();
      const crawlRunId = request.userData.crawlRunId as number | undefined;
      const errMsg = (error as Error).message || '';

      // Extract status code from error message (Crawlee includes it)
      const statusMatch = errMsg.match(/(\d{3})/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : null;

      log.error(`Request failed: ${request.url}`, { error: errMsg });
      incrementCrawlMetric(crawlRunId, 'errors');

      await db.insert(crawlErrors).values({
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
  }, new Configuration({ persistStorage: persistCrawlerStorage }));
}

/**
 * Run the crawler with the given options.
 */
export async function runCrawl(options: CrawlOptions): Promise<CrawlRunResult> {
  const {
    category,
    subcategory,
    regionSlug,
    maxPages = config.crawler.defaultMaxPages,
    full = false,
    detailOnly = false,
    crawlDetails = true,
    syncDataset = false,
    logLevel = config.log.level,
    cleanupStorage = true,
    persistCrawlerStorage = false,
  } = options;

  // Set log level
  log.setLevel(toLogLevel(logLevel));

  // Initialize database connection
  await initDb();

  if (cleanupStorage) {
    // Clean up stale storage from previous crashed CLI runs.
    try {
      rmSync('./storage', { recursive: true, force: true });
    } catch {
      // ignore if doesn't exist
    }
  }

  const db = getDb();
  const startedAt = new Date().toISOString();

  // Create crawl run record
  const crawlType = full || detailOnly ? 'full' : 'incremental';
  const crawlRun = await db.insert(crawlRuns).values({
    type: crawlType,
    startedAt,
    status: 'running',
    category: category || null,
    subcategory: subcategory || null,
    regionSlug: regionSlug || null,
  }).returning({ id: crawlRuns.id });

  const crawlRunId = crawlRun[0].id;
  startCrawlMetrics(crawlRunId);
  log.info(`Crawl run #${crawlRunId} started`);

  const effectiveMaxPages = full ? 9999 : maxPages;
  const tracksSeenListings = full && !detailOnly && !category && !subcategory;

  try {
    if (detailOnly) {
      // Only crawl detail pages for listings missing detail data
      const crawler = createCrawler(persistCrawlerStorage);
      await crawlDetailOnly(crawler, crawlRunId, syncDataset, category, subcategory);
    } else {
      // Normal crawl: list pages first, then details
      const categories = findCategory(category, subcategory);

      if (categories.length === 0) {
        log.error('No matching categories found', { category, subcategory });
        throw new Error(`No matching categories found for category=${category || 'all'} subcategory=${subcategory || 'all'}`);
      }

      log.info(`Crawling ${categories.length} categories, max ${effectiveMaxPages} pages each`);

      const makeListRequest = (cat: CategoryConfig) => ({
        url: buildListUrl(cat, regionSlug, 1),
        label: 'LIST',
        userData: {
          categoryConfig: cat,
          regionSlug,
          maxPages: effectiveMaxPages,
          crawlRunId,
          page: 1,
          trackSeen: tracksSeenListings,
          crawlDetails,
          syncDataset,
        },
      });

      if (categories.length > 1) {
        for (const [index, cat] of categories.entries()) {
          log.info(`Starting category pass: ${cat.label}`);
          const categoryCrawler = createCrawler(persistCrawlerStorage);
          await categoryCrawler.run([makeListRequest(cat)]);

          if (config.crawler.betweenCategoryDelaySecs > 0 && index < categories.length - 1) {
            await delay(config.crawler.betweenCategoryDelaySecs * 1000);
          }
        }
      } else {
        const crawler = createCrawler(persistCrawlerStorage);
        await crawler.run(categories.map(makeListRequest));
      }
    }

    // Update crawl run as completed
    const finishedAt = new Date().toISOString();
    const durationSecs = Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);

    // For full crawls, mark unseen listings as removed.
    // A full crawl scans all list pages, so any active listing not seen during this crawl
    // (lastSeenAt older than when we started) is no longer on the site.
    let removedCount = 0;
    if (full && !detailOnly && !category && !subcategory) {
      const [activeResult, seenResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
          .from(listings)
          .where(isNull(listings.removedAt)),
        db.select({ count: sql<number>`count(*)` })
          .from(listings)
          .where(sql`${listings.removedAt} IS NULL AND EXISTS (
            SELECT 1
            FROM ${crawlSeenListings}
            WHERE ${crawlSeenListings.crawlRunId} = ${crawlRunId}
              AND ${crawlSeenListings.adId} = ${listings.adId}
          )`),
      ]);
      const activeCount = Number(activeResult?.[0]?.count || 0);
      const seenCount = Number(seenResult?.[0]?.count || 0);

      if (activeCount >= 1000 && seenCount < Math.floor(activeCount * 0.5)) {
        throw new Error(`Full crawl safety check failed: only ${seenCount}/${activeCount} active listings were seen; refusing to mark unseen listings as removed`);
      }

      const [toRemoveResult] = await db.select({ count: sql<number>`count(*)` })
        .from(listings)
        .where(sql`${listings.removedAt} IS NULL AND NOT EXISTS (
          SELECT 1
          FROM ${crawlSeenListings}
          WHERE ${crawlSeenListings.crawlRunId} = ${crawlRunId}
            AND ${crawlSeenListings.adId} = ${listings.adId}
        )`);

      removedCount = Number(toRemoveResult?.count || 0);

      await db.update(listings)
        .set({ removedAt: startedAt, removalCheckedAt: finishedAt })
        .where(sql`${listings.removedAt} IS NULL AND NOT EXISTS (
          SELECT 1
          FROM ${crawlSeenListings}
          WHERE ${crawlSeenListings.crawlRunId} = ${crawlRunId}
            AND ${crawlSeenListings.adId} = ${listings.adId}
        )`);

      if (removedCount > 0) {
        log.info(`Marked ${removedCount} listings as removed (not seen during full crawl)`);
      }
    }

    // Count stats from DB
    const runtimeMetrics = getCrawlMetrics(crawlRunId);
    const stats = await getCrawlStats(db, crawlRunId, startedAt, runtimeMetrics, tracksSeenListings);

    await db.update(crawlRuns)
      .set({
        finishedAt,
        status: 'completed',
        durationSecs,
        ...stats,
      })
      .where(eq(crawlRuns.id, crawlRunId));

    log.info(`Crawl run #${crawlRunId} completed in ${durationSecs}s`, { ...stats, removedCount });

    return {
      crawlRunId,
      type: crawlType,
      startedAt,
      finishedAt,
      durationSecs,
      category: category || null,
      subcategory: subcategory || null,
      regionSlug: regionSlug || null,
      full,
      detailOnly,
      crawlDetails,
      syncDataset,
      removedCount,
      stats,
      runtimeMetrics: finishCrawlMetrics(crawlRunId),
    };
  } catch (error) {
    const errMsg = (error as Error).message || String(error);
    log.error(`Crawl run #${crawlRunId} failed: ${errMsg}`);
    await db.update(crawlRuns)
      .set({
        finishedAt: new Date().toISOString(),
        status: 'failed',
        errors: getCrawlMetrics(crawlRunId).errors,
      })
      .where(eq(crawlRuns.id, crawlRunId));
    finishCrawlMetrics(crawlRunId);
    throw error;
  } finally {
    await flushListingDatasetEvents(syncDataset);
  }
}

/**
 * Crawl only detail pages for listings that haven't been detail-crawled yet.
 */
async function crawlDetailOnly(
  crawler: CheerioCrawler,
  crawlRunId: number,
  syncDataset: boolean,
  category?: string,
  subcategory?: string,
) {
  const db = getDb();

  let query = db
    .select({ adId: listings.adId, url: listings.url })
    .from(listings)
    .where(eq(listings.detailCrawled, false));

  const uncrawled = await query;

  // Filter by category/subcategory if specified
  let filtered = uncrawled;
  if (category) {
    const allListings = await db
      .select({ adId: listings.adId, url: listings.url, category: listings.category, subcategory: listings.subcategory })
      .from(listings)
      .where(eq(listings.detailCrawled, false))
      ;

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
    userData: { adId: l.adId, crawlRunId, syncDataset },
  }));

  await crawler.run(requests);
}

/**
 * Get stats for a completed crawl run.
 */
async function getCrawlStats(
  db: ReturnType<typeof getDb>,
  crawlRunId: number,
  startedAt: string,
  runtimeMetrics: CrawlRuntimeMetrics,
  tracksSeenListings: boolean,
) {
  const { sql } = await import('drizzle-orm');

  const [newResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .where(sql`${listings.firstSeenAt} >= ${startedAt}`)
    ;

  const [detailResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .where(sql`${listings.updatedAt} >= ${startedAt} AND ${listings.detailCrawled} = true`)
    ;

  let listingsFound = runtimeMetrics.listingsFound;
  if (tracksSeenListings) {
    const [seenResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(crawlSeenListings)
      .where(eq(crawlSeenListings.crawlRunId, crawlRunId));

    listingsFound = Number(seenResult?.count || listingsFound);
  }

  return {
    pagesProcessed: runtimeMetrics.pagesProcessed,
    listingsFound,
    listingsNew: Number(newResult?.count || runtimeMetrics.listingsNew),
    listingsUpdated: runtimeMetrics.listingsUpdated,
    detailsCrawled: Number(detailResult?.count || runtimeMetrics.detailsCrawled),
    errors: runtimeMetrics.errors,
  };
}
