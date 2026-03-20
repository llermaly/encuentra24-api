import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { crawlRuns, listings, crawlErrors, sellers } from '@/db/schema';
import { sql, eq, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  await requireUser();

  const runId = request.nextUrl.searchParams.get('runId');
  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  const newPage = Math.max(1, Number(request.nextUrl.searchParams.get('newPage') || '1'));
  const updatedPage = Math.max(1, Number(request.nextUrl.searchParams.get('updatedPage') || '1'));
  const errorsPage = Math.max(1, Number(request.nextUrl.searchParams.get('errorsPage') || '1'));

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

  const newWhere = sql`${listings.firstSeenAt} >= ${startedAt} AND ${listings.firstSeenAt} <= ${endedAt}`;
  const updatedWhere = sql`${listings.updatedAt} >= ${startedAt} AND ${listings.updatedAt} <= ${endedAt} AND ${listings.firstSeenAt} < ${startedAt}`;

  const [
    newCount,
    updatedCount,
    errorCount,
    newListings,
    updatedListings,
    errorList,
    detailCount,
    categoryCounts,
    locationCounts,
    sellerCounts,
    priceStats,
  ] = await Promise.all([
    // Counts
    db.select({ count: sql<number>`count(*)` }).from(listings).where(newWhere),
    db.select({ count: sql<number>`count(*)` }).from(listings).where(updatedWhere),
    db.select({ count: sql<number>`count(*)` }).from(crawlErrors).where(eq(crawlErrors.crawlRunId, crawlRun.id)),

    // Paginated new listings
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
      .where(newWhere)
      .orderBy(desc(listings.firstSeenAt))
      .limit(PAGE_SIZE)
      .offset((newPage - 1) * PAGE_SIZE),

    // Paginated updated listings
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
      .where(updatedWhere)
      .orderBy(desc(listings.updatedAt))
      .limit(PAGE_SIZE)
      .offset((updatedPage - 1) * PAGE_SIZE),

    // Paginated errors
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
      .limit(PAGE_SIZE)
      .offset((errorsPage - 1) * PAGE_SIZE),

    // Details crawled count
    db.select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(sql`${listings.updatedAt} >= ${startedAt} AND ${listings.updatedAt} <= ${endedAt} AND ${listings.detailCrawled} = true`),

    // Breakdowns
    db.all(sql`
      SELECT category, subcategory, COUNT(*) as count
      FROM listings
      WHERE first_seen_at >= ${startedAt} AND first_seen_at <= ${endedAt}
      GROUP BY category, subcategory
      ORDER BY count DESC
    `),
    db.all(sql`
      SELECT COALESCE(location, province, 'Unknown') as location, COUNT(*) as count
      FROM listings
      WHERE first_seen_at >= ${startedAt} AND first_seen_at <= ${endedAt}
      GROUP BY COALESCE(location, province, 'Unknown')
      ORDER BY count DESC
      LIMIT 15
    `),
    db.all(sql`
      SELECT seller_name, COUNT(*) as count
      FROM listings
      WHERE first_seen_at >= ${startedAt} AND first_seen_at <= ${endedAt}
        AND seller_name IS NOT NULL
      GROUP BY seller_name
      ORDER BY count DESC
      LIMIT 20
    `),
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
  const totalNew = newCount[0].count;
  const totalUpdated = updatedCount[0].count;
  const totalErrors = errorCount[0].count;

  return NextResponse.json({
    crawlRun: {
      ...crawlRun,
      elapsedSecs,
      isRunning,
    },
    stats: {
      newListings: totalNew,
      updatedListings: totalUpdated,
      detailsCrawled: detailCount[0].count,
      errors: totalErrors,
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
    newListings: {
      data: newListings.map((l: any) => ({
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
      pagination: { page: newPage, pageSize: PAGE_SIZE, total: totalNew, totalPages: Math.ceil(totalNew / PAGE_SIZE) },
    },
    updatedListings: {
      data: updatedListings.map((l: any) => ({
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
      pagination: { page: updatedPage, pageSize: PAGE_SIZE, total: totalUpdated, totalPages: Math.ceil(totalUpdated / PAGE_SIZE) },
    },
    errors: {
      data: errorList.map((e: any) => ({
        url: e.url,
        type: e.errorType,
        statusCode: e.statusCode,
        message: e.message,
        occurredAt: e.occurredAt,
      })),
      pagination: { page: errorsPage, pageSize: PAGE_SIZE, total: totalErrors, totalPages: Math.ceil(totalErrors / PAGE_SIZE) },
    },
  });
}

export async function POST(request: NextRequest) {
  await requireUser();

  const body = await request.json();
  const { runId, action } = body;

  if (!runId || action !== 'cancel') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const [crawlRun] = await db
    .select({ id: crawlRuns.id, status: crawlRuns.status, startedAt: crawlRuns.startedAt })
    .from(crawlRuns)
    .where(eq(crawlRuns.id, Number(runId)))
    .limit(1);

  if (!crawlRun) {
    return NextResponse.json({ error: 'Crawl run not found' }, { status: 404 });
  }

  if (crawlRun.status !== 'running') {
    return NextResponse.json({ error: 'Crawl run is not running' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const durationSecs = Math.round(
    (new Date(now).getTime() - new Date(crawlRun.startedAt).getTime()) / 1000
  );

  await db.update(crawlRuns)
    .set({
      status: 'cancelled',
      finishedAt: now,
      durationSecs,
    })
    .where(eq(crawlRuns.id, Number(runId)));

  return NextResponse.json({ success: true });
}
