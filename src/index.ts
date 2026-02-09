#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { crawlCommand } from './cli/commands/crawl.js';
import { statusCommand } from './cli/commands/status.js';
import { exportCommand } from './cli/commands/export.js';

const program = new Command();

program
  .name('e24')
  .description('Encuentra24 Panama Real Estate Scraper')
  .version('0.1.0');

program.addCommand(crawlCommand);
program.addCommand(statusCommand);
program.addCommand(exportCommand);

program.parse();
