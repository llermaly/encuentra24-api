import { Command } from 'commander';
import { runCrawl } from '../../crawler/index.js';

export const crawlCommand = new Command('crawl')
  .description('Crawl encuentra24.com listings')
  .option('-c, --category <type>', 'Category filter: sale, rental, vacation, new_project')
  .option('-s, --subcategory <type>', 'Subcategory filter: casas, apartamentos, etc.')
  .option('-r, --region <slug>', 'Region slug filter (e.g., prov-panama-ciudad-de-panama-las-cumbres)')
  .option('-p, --max-pages <number>', 'Max pages per category', '5')
  .option('--full', 'Full crawl (up to 500 pages per category)', false)
  .option('--detail-only', 'Only crawl detail pages for listings missing detail data', false)
  .option('--log-level <level>', 'Log level: debug, info, warn, error', 'info')
  .action(async (opts) => {
    console.log('Starting crawl...');
    console.log(`  Category: ${opts.category || 'all'}`);
    console.log(`  Subcategory: ${opts.subcategory || 'all'}`);
    console.log(`  Region: ${opts.region || 'all'}`);
    console.log(`  Max pages: ${opts.full ? '500 (full)' : opts.maxPages}`);
    console.log(`  Detail only: ${opts.detailOnly}`);
    console.log('');

    try {
      await runCrawl({
        category: opts.category,
        subcategory: opts.subcategory,
        regionSlug: opts.region,
        maxPages: parseInt(opts.maxPages, 10),
        full: opts.full,
        detailOnly: opts.detailOnly,
        logLevel: opts.logLevel,
      });
      console.log('\nCrawl completed successfully.');
    } catch (error) {
      console.error('\nCrawl failed:', (error as Error).message);
      process.exit(1);
    }
  });
