import { sql, SQL } from 'drizzle-orm';

/** Days between now and a text-stored date column */
export function daysSince(column: any): SQL {
  return sql`EXTRACT(EPOCH FROM (NOW() - CAST(${column} AS timestamp))) / 86400`;
}

/** CAST to floating-point for division */
export function castReal(expr: SQL): SQL {
  return sql`CAST(${expr} AS DOUBLE PRECISION)`;
}

/** date('now', '-N days') equivalent */
export function dateAgo(days: number): SQL {
  return sql`NOW() - INTERVAL '${sql.raw(String(days))} days'`;
}

/** Extract just the date portion from a timestamp text column */
export function dateOf(column: string): SQL {
  return sql.raw(`(${column})::date`);
}

/** Full-text search condition using ILIKE on title, description, location */
export function fullTextSearch(adIdColumn: any, query: string): SQL {
  return sql`(
    title ILIKE ${'%' + query + '%'}
    OR description ILIKE ${'%' + query + '%'}
    OR location ILIKE ${'%' + query + '%'}
  )`;
}

/** Case-insensitive LIKE search */
export function ilike(column: string, value: string): string {
  return `${column} ILIKE '%${value.replace(/'/g, "''")}%'`;
}
