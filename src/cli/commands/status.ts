import { Command } from 'commander';
import { sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { listings, priceHistory, crawlRuns, crawlErrors } from '../../db/schema.js';

export const statusCommand = new Command('status')
  .description('Show database stats and last crawl info')
  .action(async () => {
    const db = getDb();

    // Total listings
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(listings).all();

    // By category
    const byCategory = await db
      .select({
        category: listings.category,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .groupBy(listings.category)
      .all();

    // By subcategory (top 10)
    const bySubcategory = await db
      .select({
        subcategory: listings.subcategory,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .groupBy(listings.subcategory)
      .orderBy(sql`count(*) DESC`)
      .limit(10)
      .all();

    // Detail crawled stats
    const [detailStats] = await db
      .select({
        crawled: sql<number>`SUM(CASE WHEN detail_crawled = 1 THEN 1 ELSE 0 END)`,
        uncrawled: sql<number>`SUM(CASE WHEN detail_crawled = 0 THEN 1 ELSE 0 END)`,
      })
      .from(listings)
      .all();

    // Price history entries
    const [priceHistoryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(priceHistory)
      .all();

    // Removed listings
    const [removed] = await db
      .select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(sql`removed_at IS NOT NULL`)
      .all();

    // Last crawl run
    const lastRun = await db
      .select()
      .from(crawlRuns)
      .orderBy(sql`id DESC`)
      .limit(1)
      .get();

    // Error count
    const [errorCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(crawlErrors)
      .all();

    // Display
    console.log('=== Encuentra24 Database Status ===\n');
    console.log(`Total listings: ${total.count}`);
    console.log(`  Detail crawled: ${detailStats?.crawled || 0}`);
    console.log(`  Pending detail: ${detailStats?.uncrawled || 0}`);
    console.log(`  Removed: ${removed.count}`);
    console.log(`  Price history entries: ${priceHistoryCount.count}`);
    console.log(`  Crawl errors: ${errorCount.count}`);

    console.log('\nBy category:');
    for (const row of byCategory) {
      console.log(`  ${row.category}: ${row.count}`);
    }

    console.log('\nTop subcategories:');
    for (const row of bySubcategory) {
      console.log(`  ${row.subcategory}: ${row.count}`);
    }

    if (lastRun) {
      console.log('\nLast crawl run:');
      console.log(`  ID: #${lastRun.id}`);
      console.log(`  Status: ${lastRun.status}`);
      console.log(`  Started: ${lastRun.startedAt}`);
      console.log(`  Finished: ${lastRun.finishedAt || 'N/A'}`);
      console.log(`  Duration: ${lastRun.durationSecs ? `${lastRun.durationSecs}s` : 'N/A'}`);
      console.log(`  Category: ${lastRun.category || 'all'}`);
      console.log(`  New listings: ${lastRun.listingsNew}`);
      console.log(`  Details crawled: ${lastRun.detailsCrawled}`);
    }
  });
