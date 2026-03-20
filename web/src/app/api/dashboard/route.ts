import { NextResponse } from 'next/server';
import { db } from '@/db';
import { listings, crawlRuns, favorites, savedSearches } from '@/db/schema';
import { sql, desc, gte, eq, and, isNull } from 'drizzle-orm';
import { buildListingWhere } from '@/db/query-builder';
import type { ListingFilters } from '@/types/filters';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const active = isNull(listings.removedAt);
  const [totalResult, todayResult, weekResult, favoritesResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(listings).where(active),
    db.select({ count: sql<number>`count(*)` }).from(listings).where(and(active, gte(listings.firstSeenAt, todayStart))),
    db.select({ count: sql<number>`count(*)` }).from(listings).where(and(active, gte(listings.firstSeenAt, weekAgo))),
    db.select({ count: sql<number>`count(*)` }).from(favorites).where(eq(favorites.userId, user.id)),
  ]);

  // Market summary
  const marketSummaryResult = await db.all<{
    active_listings: number;
    removed_listings: number;
    avg_price: number | null;
    active_sellers: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE removed_at IS NULL) as active_listings,
      COUNT(*) FILTER (WHERE removed_at IS NOT NULL) as removed_listings,
      AVG(price) FILTER (WHERE removed_at IS NULL AND price IS NOT NULL) as avg_price,
      COUNT(DISTINCT seller_name) FILTER (WHERE removed_at IS NULL) as active_sellers
    FROM listings
  `);

  // Category breakdown
  const categoryBreakdownResult = await db.all<{
    category: string;
    subcategory: string;
    total: number;
    active: number;
    avg_price: number | null;
    min_price: number | null;
    max_price: number | null;
    new_this_week: number;
  }>(sql`
    SELECT category, subcategory,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE removed_at IS NULL) as active,
      AVG(price) FILTER (WHERE removed_at IS NULL AND price IS NOT NULL) as avg_price,
      MIN(price) FILTER (WHERE removed_at IS NULL AND price IS NOT NULL) as min_price,
      MAX(price) FILTER (WHERE removed_at IS NULL AND price IS NOT NULL) as max_price,
      COUNT(*) FILTER (WHERE first_seen_at >= ${weekAgo}) as new_this_week
    FROM listings
    GROUP BY category, subcategory
    ORDER BY category, total DESC
  `);

  // Location breakdown with category detail (using city + location since province is unpopulated)
  const locationBreakdownResult = await db.all<{
    city: string;
    location: string | null;
    category: string;
    subcategory: string;
    active: number;
    avg_price: number | null;
    new_this_week: number;
  }>(sql`
    SELECT city, location, category, subcategory,
      COUNT(*) FILTER (WHERE removed_at IS NULL) as active,
      AVG(price) FILTER (WHERE removed_at IS NULL AND price IS NOT NULL) as avg_price,
      COUNT(*) FILTER (WHERE first_seen_at >= ${weekAgo}) as new_this_week
    FROM listings
    WHERE city IS NOT NULL
    GROUP BY city, location, category, subcategory
    HAVING COUNT(*) FILTER (WHERE removed_at IS NULL) > 0
    ORDER BY COUNT(*) FILTER (WHERE removed_at IS NULL) DESC
  `);

  const latestListings = await db
    .select({
      adId: listings.adId,
      title: listings.title,
      price: listings.price,
      location: listings.location,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      builtAreaSqm: listings.builtAreaSqm,
      images: listings.images,
      firstSeenAt: listings.firstSeenAt,
    })
    .from(listings)
    .where(active)
    .orderBy(desc(listings.firstSeenAt))
    .limit(10);

  const lastCrawl = await db
    .select()
    .from(crawlRuns)
    .orderBy(desc(crawlRuns.startedAt))
    .limit(1);

  const lastCrawlData = lastCrawl[0] ?? null;

  // For each saved search, fetch the 10 newest matching listings
  const userSearches = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, user.id));

  const savedSearchResults = await Promise.all(
    userSearches.map(async (search: typeof savedSearches.$inferSelect) => {
      const filters: ListingFilters = JSON.parse(search.filters);
      const where = buildListingWhere(filters);

      const matchingListings = await db
        .select({
          adId: listings.adId,
          title: listings.title,
          price: listings.price,
          location: listings.location,
          bedrooms: listings.bedrooms,
          bathrooms: listings.bathrooms,
          builtAreaSqm: listings.builtAreaSqm,
          images: listings.images,
          firstSeenAt: listings.firstSeenAt,
        })
        .from(listings)
        .where(where)
        .orderBy(desc(listings.firstSeenAt))
        .limit(10);

      return {
        id: search.id,
        name: search.name,
        filters: search.filters,
        listings: matchingListings.map((l: any) => ({
          ...l,
          thumbnail: Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null,
          images: undefined,
        })),
      };
    })
  );

  const market = marketSummaryResult[0] ?? {
    active_listings: 0,
    removed_listings: 0,
    avg_price: null,
    active_sellers: 0,
  };

  return NextResponse.json({
    stats: {
      totalListings: totalResult[0].count,
      newToday: todayResult[0].count,
      newThisWeek: weekResult[0].count,
      totalFavorites: favoritesResult[0].count,
    },
    marketSummary: {
      activeListings: Number(market.active_listings),
      removedListings: Number(market.removed_listings),
      avgPrice: market.avg_price != null ? Number(market.avg_price) : null,
      activeSellers: Number(market.active_sellers),
    },
    categoryBreakdown: categoryBreakdownResult.map((r: any) => ({
      category: r.category,
      subcategory: r.subcategory,
      total: Number(r.total),
      active: Number(r.active),
      avgPrice: r.avg_price != null ? Number(r.avg_price) : null,
      minPrice: r.min_price != null ? Number(r.min_price) : null,
      maxPrice: r.max_price != null ? Number(r.max_price) : null,
      newThisWeek: Number(r.new_this_week),
    })),
    locationBreakdown: locationBreakdownResult.map((r: any) => ({
      city: r.city,
      location: r.location,
      category: r.category,
      subcategory: r.subcategory,
      active: Number(r.active),
      avgPrice: r.avg_price != null ? Number(r.avg_price) : null,
      newThisWeek: Number(r.new_this_week),
    })),
    latestListings: latestListings.map((l: any) => ({
      ...l,
      thumbnail: Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null,
      images: undefined,
    })),
    savedSearches: savedSearchResults,
    lastCrawl: lastCrawlData,
  });
}
