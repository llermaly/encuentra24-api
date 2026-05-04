import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET() {
  await requireUser();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [dailyNewRaw, dailyRemovedRaw, topCitiesRaw, recentCrawlsRaw, priceBucketsRaw, categoryShareRaw] = await Promise.all([
    db.all<{ day: string; count: number }>(sql`
      SELECT to_char(date_trunc('day', first_seen_at::timestamp), 'YYYY-MM-DD') as day,
             COUNT(*) as count
      FROM listings
      WHERE first_seen_at >= ${thirtyDaysAgo}
      GROUP BY day
      ORDER BY day
    `),
    db.all<{ day: string; count: number }>(sql`
      SELECT to_char(date_trunc('day', removed_at::timestamp), 'YYYY-MM-DD') as day,
             COUNT(*) as count
      FROM listings
      WHERE removed_at IS NOT NULL AND removed_at >= ${thirtyDaysAgo}
      GROUP BY day
      ORDER BY day
    `),
    db.all<{ city: string; active: number; new_this_week: number; avg_sale: number | null; avg_rent: number | null }>(sql`
      SELECT city,
             COUNT(*) FILTER (WHERE removed_at IS NULL) as active,
             COUNT(*) FILTER (WHERE first_seen_at >= ${weekAgo}) as new_this_week,
             AVG(price) FILTER (WHERE removed_at IS NULL AND category = 'sale' AND price IS NOT NULL) as avg_sale,
             AVG(price) FILTER (WHERE removed_at IS NULL AND category = 'rental' AND price IS NOT NULL) as avg_rent
      FROM listings
      WHERE city IS NOT NULL
      GROUP BY city
      ORDER BY active DESC
      LIMIT 8
    `),
    db.all<{ id: number; status: string; started_at: string; finished_at: string | null; listings_new: number; listings_updated: number; duration_secs: number | null; errors: number }>(sql`
      SELECT id, status, started_at, finished_at, listings_new, listings_updated, duration_secs, errors
      FROM crawl_runs
      ORDER BY started_at DESC
      LIMIT 7
    `),
    db.all<{ bucket: string; count: number }>(sql`
      SELECT bucket, COUNT(*) as count FROM (
        SELECT CASE
          WHEN price < 100000 THEN '<100K'
          WHEN price < 250000 THEN '100-250K'
          WHEN price < 500000 THEN '250-500K'
          WHEN price < 1000000 THEN '500K-1M'
          WHEN price < 2500000 THEN '1-2.5M'
          ELSE '2.5M+'
        END as bucket
        FROM listings
        WHERE removed_at IS NULL AND category = 'sale' AND price IS NOT NULL
      ) buckets
      GROUP BY bucket
    `),
    db.all<{ category: string; active: number }>(sql`
      SELECT category, COUNT(*) FILTER (WHERE removed_at IS NULL) as active
      FROM listings
      GROUP BY category
      ORDER BY active DESC
    `),
  ]);

  const dailyNewMap = new Map<string, number>();
  for (const row of dailyNewRaw) dailyNewMap.set(row.day, Number(row.count));
  const dailyRemovedMap = new Map<string, number>();
  for (const row of dailyRemovedRaw) dailyRemovedMap.set(row.day, Number(row.count));

  const dailyTrend: Array<{ day: string; added: number; removed: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyTrend.push({ day: key, added: dailyNewMap.get(key) ?? 0, removed: dailyRemovedMap.get(key) ?? 0 });
  }

  const bucketOrder = ['<100K', '100-250K', '250-500K', '500K-1M', '1-2.5M', '2.5M+'];
  const bucketMap = new Map(priceBucketsRaw.map((b) => [b.bucket, Number(b.count)]));
  const priceDistribution = bucketOrder.map((b) => ({ bucket: b, count: bucketMap.get(b) ?? 0 }));

  return NextResponse.json({
    dailyTrend,
    topCities: topCitiesRaw.map((c) => ({
      city: c.city,
      active: Number(c.active),
      newThisWeek: Number(c.new_this_week),
      avgSale: c.avg_sale != null ? Number(c.avg_sale) : null,
      avgRent: c.avg_rent != null ? Number(c.avg_rent) : null,
    })),
    recentCrawls: recentCrawlsRaw.map((r) => ({
      id: r.id,
      status: r.status,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      listingsNew: Number(r.listings_new),
      listingsUpdated: Number(r.listings_updated),
      durationSecs: r.duration_secs != null ? Number(r.duration_secs) : null,
      errors: Number(r.errors),
    })),
    priceDistribution,
    categoryShare: categoryShareRaw.map((c) => ({ category: c.category, active: Number(c.active) })),
  });
}
