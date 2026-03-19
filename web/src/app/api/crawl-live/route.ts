import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { crawlRuns, listings, crawlErrors, sellers } from '@/db/schema';
import { sql, eq, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  await requireUser();

  const runId = request.nextUrl.searchParams.get('runId');
  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  const [crawlRun] = await db
    .select()
    .from(crawlRuns)
    .where(eq(crawlRuns.id, Number(runId)))
    .limit(1);

  if (!crawlRun) {
    return NextResponse.json({ error: 'Crawl run not found' }, { status: 404 });
  }

  const startedAt = crawlRun.startedAt;
  const endedAt = crawlRun.finishedAt || new Date().toISOString();
  const isRunning = crawlRun.status === 'running';

  const [
    newListings,
    updatedListings,
    detailCount,
    errorList,
    categoryCounts,
    locationCounts,
    sellerCounts,
    priceStats,
  ] = await Promise.all([
    // New listings from this crawl (with detail)
    db.select({
      adId: listings.adId,
      title: listings.title,
      price: listings.price,
      currency: listings.currency,
      location: listings.location,
      province: listings.province,
      city: listings.city,
      category: listings.category,
      subcategory: listings.subcategory,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      builtAreaSqm: listings.builtAreaSqm,
      sellerName: listings.sellerName,
      images: listings.images,
      firstSeenAt: listings.firstSeenAt,
    })
      .from(listings)
      .where(sql`${listings.firstSeenAt} >= ${startedAt} AND ${listings.firstSeenAt} <= ${endedAt}`)
      .orderBy(desc(listings.firstSeenAt))
      .limit(100),

    // Updated listings (existed before but price changed or detail crawled)
    db.select({
      adId: listings.adId,
      title: listings.title,
      price: listings.price,
      currency: listings.currency,
      location: listings.location,
      category: listings.category,
      subcategory: listings.subcategory,
      sellerName: listings.sellerName,
      detailCrawled: listings.detailCrawled,
      updatedAt: listings.updatedAt,
    })
      .from(listings)
      .where(sql`${listings.updatedAt} >= ${startedAt} AND ${listings.updatedAt} <= ${endedAt} AND ${listings.firstSeenAt} < ${startedAt}`)
      .orderBy(desc(listings.updatedAt))
      .limit(50),

    // Details crawled count
    db.select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(sql`${listings.updatedAt} >= ${startedAt} AND ${listings.updatedAt} <= ${endedAt} AND ${listings.detailCrawled} = true`),

    // Errors for this run
    db.select({
      url: crawlErrors.url,
      errorType: crawlErrors.errorType,
      statusCode: crawlErrors.statusCode,
      message: crawlErrors.message,
      occurredAt: crawlErrors.occurredAt,
    })
      .from(crawlErrors)
      .where(eq(crawlErrors.crawlRunId, crawlRun.id))
      .orderBy(desc(crawlErrors.occurredAt))
      .limit(50),

    // Breakdown by category
    db.all(sql`
      SELECT category, subcategory, COUNT(*) as count
      FROM listings
      WHERE first_seen_at >= ${startedAt} AND first_seen_at <= ${endedAt}
      GROUP BY category, subcategory
      ORDER BY count DESC
    `),

    // Breakdown by location
    db.all(sql`
      SELECT COALESCE(location, province, 'Unknown') as location, COUNT(*) as count
      FROM listings
      WHERE first_seen_at >= ${startedAt} AND first_seen_at <= ${endedAt}
      GROUP BY COALESCE(location, province, 'Unknown')
      ORDER BY count DESC
      LIMIT 15
    `),

    // Sellers discovered/updated
    db.all(sql`
      SELECT seller_name, COUNT(*) as count
      FROM listings
      WHERE first_seen_at >= ${startedAt} AND first_seen_at <= ${endedAt}
        AND seller_name IS NOT NULL
      GROUP BY seller_name
      ORDER BY count DESC
      LIMIT 20
    `),

    // Price stats of new listings
    db.all(sql`
      SELECT
        COUNT(*) as total,
        COALESCE(AVG(price), 0) as avg_price,
        COALESCE(MIN(price), 0) as min_price,
        COALESCE(MAX(price), 0) as max_price
      FROM listings
      WHERE first_seen_at >= ${startedAt} AND first_seen_at <= ${endedAt}
        AND price IS NOT NULL
    `),
  ]);

  const elapsedSecs = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  );

  const ps = (priceStats as any[])[0] || { total: 0, avg_price: 0, min_price: 0, max_price: 0 };

  return NextResponse.json({
    crawlRun: {
      ...crawlRun,
      elapsedSecs,
      isRunning,
    },
    stats: {
      newListings: newListings.length,
      updatedListings: updatedListings.length,
      detailsCrawled: detailCount[0].count,
      errors: errorList.length,
    },
    price: {
      total: Number(ps.total),
      avg: Math.round(Number(ps.avg_price)),
      min: Number(ps.min_price),
      max: Number(ps.max_price),
    },
    breakdowns: {
      categories: (categoryCounts as any[]).map((r: any) => ({
        category: r.category,
        subcategory: r.subcategory,
        count: Number(r.count),
      })),
      locations: (locationCounts as any[]).map((r: any) => ({
        location: r.location,
        count: Number(r.count),
      })),
      sellers: (sellerCounts as any[]).map((r: any) => ({
        name: r.seller_name,
        count: Number(r.count),
      })),
    },
    newListings: newListings.map((l: any) => ({
      adId: l.adId,
      title: l.title,
      price: l.price,
      currency: l.currency,
      location: l.location,
      province: l.province,
      city: l.city,
      category: l.category,
      subcategory: l.subcategory,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      area: l.builtAreaSqm,
      sellerName: l.sellerName,
      thumbnail: Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null,
      firstSeenAt: l.firstSeenAt,
    })),
    updatedListings: updatedListings.map((l: any) => ({
      adId: l.adId,
      title: l.title,
      price: l.price,
      currency: l.currency,
      location: l.location,
      category: l.category,
      subcategory: l.subcategory,
      sellerName: l.sellerName,
      detailCrawled: l.detailCrawled,
      updatedAt: l.updatedAt,
    })),
    errors: errorList.map((e: any) => ({
      url: e.url,
      type: e.errorType,
      statusCode: e.statusCode,
      message: e.message,
      occurredAt: e.occurredAt,
    })),
  });
}
