import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { crawlRuns, crawlErrors } from '@/db/schema';
import { sql, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  await requireUser();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
  const offset = (page - 1) * limit;

  const [runs, totalResult, errorCounts, dailyStats] = await Promise.all([
    // Paginated crawl runs
    db.select()
      .from(crawlRuns)
      .orderBy(desc(crawlRuns.startedAt))
      .limit(limit)
      .offset(offset),

    // Total count
    db.select({ count: sql<number>`count(*)` }).from(crawlRuns),

    // Error counts per recent run
    db.select({
      crawlRunId: crawlErrors.crawlRunId,
      errorCount: sql<number>`count(*)`,
    })
      .from(crawlErrors)
      .groupBy(crawlErrors.crawlRunId),

    // Daily aggregation (last 30 days): new listings per day
    db.all(sql`
      SELECT
        (started_at)::date as day,
        COUNT(*) as run_count,
        SUM(listings_new) as total_new,
        SUM(listings_updated) as total_updated,
        SUM(details_crawled) as total_details,
        SUM(errors) as total_errors,
        AVG(duration_secs) as avg_duration
      FROM crawl_runs
      WHERE started_at::timestamptz >= NOW() - INTERVAL '30 days'
        AND status = 'completed'
      GROUP BY (started_at)::date
      ORDER BY day ASC
    `),
  ]);

  const errorMap = new Map(errorCounts.map((e: any) => [e.crawlRunId, e.errorCount]));
  const total = totalResult[0].count;

  return NextResponse.json({
    runs: runs.map((r: any) => ({
      ...r,
      errorCount: errorMap.get(r.id) || r.errors || 0,
      crawlType: r.type || 'incremental',
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    dailyStats: (dailyStats as any[]).map((d: any) => ({
      day: d.day,
      run_count: Number(d.run_count),
      total_new: Number(d.total_new) || 0,
      total_updated: Number(d.total_updated) || 0,
      total_details: Number(d.total_details) || 0,
      total_errors: Number(d.total_errors) || 0,
      avg_duration: Number(d.avg_duration) || 0,
    })),
  });
}
