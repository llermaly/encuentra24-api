#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { crawlCommand } from './cli/commands/crawl.js';
import { statusCommand } from './cli/commands/status.js';
import { exportCommand } from './cli/commands/export.js';
import { sellersCommand } from './cli/commands/sellers.js';
import { backfillRemoved } from './cli/commands/backfill-removed.js';

const program = new Command();

program
  .name('e24')
  .description('Encuentra24 Panama Real Estate Scraper')
  .version('0.1.0');

program.addCommand(crawlCommand);
program.addCommand(statusCommand);
program.addCommand(exportCommand);
program.addCommand(sellersCommand);

program
  .command('backfill-removed')
  .description('Check all listings for removal and mark removed ones')
  .option('--concurrency <number>', 'Max concurrent requests', '10')
  .option('--rate-limit <number>', 'Max requests per minute', '200')
  .action(async (opts) => {
    await backfillRemoved({
      concurrency: Number(opts.concurrency),
      rateLimit: Number(opts.rateLimit),
    });
  });

program.parse();
