import { Command } from 'commander';
import { sql } from 'drizzle-orm';
import { writeFileSync } from 'node:fs';
import { getDb } from '../../db/connection.js';
import { listings } from '../../db/schema.js';

export const exportCommand = new Command('export')
  .description('Export listings to CSV or JSON')
  .option('-c, --category <type>', 'Category filter: sale, rental, vacation, new_project')
  .option('-s, --subcategory <type>', 'Subcategory filter')
  .option('-f, --format <type>', 'Output format: csv, json', 'json')
  .option('-o, --output <path>', 'Output file path', 'listings.json')
  .option('--detail-only', 'Only export listings with detail data', false)
  .action(async (opts) => {
    const db = getDb();

    let conditions: string[] = [];
    if (opts.category) conditions.push(`category = '${opts.category}'`);
    if (opts.subcategory) conditions.push(`subcategory = '${opts.subcategory}'`);
    if (opts.detailOnly) conditions.push(`detail_crawled = 1`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await db.all(sql.raw(`SELECT * FROM listings ${whereClause} ORDER BY id`));

    if (rows.length === 0) {
      console.log('No listings found matching criteria.');
      return;
    }

    if (opts.format === 'csv') {
      const headers = Object.keys(rows[0] as Record<string, unknown>);
      const csvRows = [
        headers.join(','),
        ...rows.map((row) => {
          const r = row as Record<string, unknown>;
          return headers.map((h) => {
            const val = r[h];
            if (val === null || val === undefined) return '';
            const str = String(val);
            // Escape CSV values with commas, quotes, or newlines
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',');
        }),
      ];
      writeFileSync(opts.output, csvRows.join('\n'), 'utf-8');
    } else {
      writeFileSync(opts.output, JSON.stringify(rows, null, 2), 'utf-8');
    }

    console.log(`Exported ${rows.length} listings to ${opts.output} (${opts.format})`);
  });
