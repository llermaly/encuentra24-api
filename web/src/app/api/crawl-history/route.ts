import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

type CrawlHistoryRow = {
  runs: unknown[];
  total: number;
  daily_stats: unknown[];
};

function timingHeader(authMs: number, dbMs: number, totalMs: number) {
  return [
    `auth;dur=${authMs.toFixed(1)}`,
    `db;dur=${dbMs.toFixed(1)}`,
    `total;dur=${totalMs.toFixed(1)}`,
  ].join(', ');
}

export async function GET(request: NextRequest) {
  const started = performance.now();

  const authStarted = performance.now();
  try {
    await requireUser();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  const authMs = performance.now() - authStarted;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
  const offset = (page - 1) * limit;

  const dbStarted = performance.now();
  const [result] = await db.all<CrawlHistoryRow>(sql`
    WITH paged_runs AS (
      SELECT *
      FROM crawl_runs
      ORDER BY started_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    ),
    page_error_counts AS (
      SELECT crawl_run_id, COUNT(*)::int AS error_count
      FROM crawl_errors
      WHERE crawl_run_id IN (SELECT id FROM paged_runs)
      GROUP BY crawl_run_id
    ),
    daily AS (
      SELECT
        (started_at)::date AS day,
        COUNT(*)::int AS run_count,
        COALESCE(SUM(listings_new), 0)::int AS total_new,
        COALESCE(SUM(listings_updated), 0)::int AS total_updated,
        COALESCE(SUM(details_crawled), 0)::int AS total_details,
        COALESCE(SUM(errors), 0)::int AS total_errors,
        COALESCE(AVG(duration_secs), 0)::float AS avg_duration
      FROM crawl_runs
      WHERE started_at::timestamptz >= NOW() - INTERVAL '30 days'
        AND status = 'completed'
      GROUP BY (started_at)::date
      ORDER BY day ASC
    )
    SELECT
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'startedAt', r.started_at,
            'finishedAt', r.finished_at,
            'status', r.status,
            'category', r.category,
            'subcategory', r.subcategory,
            'regionSlug', r.region_slug,
            'pagesProcessed', r.pages_processed,
            'listingsFound', r.listings_found,
            'listingsNew', r.listings_new,
            'listingsUpdated', r.listings_updated,
            'detailsCrawled', r.details_crawled,
            'errors', r.errors,
            'durationSecs', r.duration_secs,
            'errorCount', COALESCE(e.error_count, r.errors, 0),
            'crawlType', COALESCE(r.type, 'incremental')
          )
          ORDER BY r.started_at DESC
        )
        FROM paged_runs r
        LEFT JOIN page_error_counts e ON e.crawl_run_id = r.id
      ), '[]'::jsonb) AS runs,
      (SELECT COUNT(*)::int FROM crawl_runs) AS total,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'day', day,
            'run_count', run_count,
            'total_new', total_new,
            'total_updated', total_updated,
            'total_details', total_details,
            'total_errors', total_errors,
            'avg_duration', avg_duration
          )
          ORDER BY day ASC
        )
        FROM daily
      ), '[]'::jsonb) AS daily_stats
  `);
  const dbMs = performance.now() - dbStarted;
  const totalMs = performance.now() - started;

  console.info('crawl-history timings', {
    page,
    limit,
    authMs: Math.round(authMs),
    dbMs: Math.round(dbMs),
    totalMs: Math.round(totalMs),
  });

  return NextResponse.json({
    runs: result?.runs ?? [],
    pagination: {
      page,
      limit,
      total: result?.total ?? 0,
      totalPages: Math.ceil((result?.total ?? 0) / limit),
    },
    dailyStats: result?.daily_stats ?? [],
  }, {
    headers: {
      'Server-Timing': timingHeader(authMs, dbMs, totalMs),
    },
  });
}
