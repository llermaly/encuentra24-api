import { NextResponse } from 'next/server';
import { db } from '@/db';
import { listings, crawlRuns, favorites, savedSearches } from '@/db/schema';
import { sql, desc, gte, eq, and } from 'drizzle-orm';
import { buildListingWhere } from '@/db/query-builder';
import type { ListingFilters } from '@/types/filters';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalResult, todayResult, weekResult, favoritesResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(listings),
    db.select({ count: sql<number>`count(*)` }).from(listings).where(gte(listings.firstSeenAt, todayStart)),
    db.select({ count: sql<number>`count(*)` }).from(listings).where(gte(listings.firstSeenAt, weekAgo)),
    db.select({ count: sql<number>`count(*)` }).from(favorites).where(eq(favorites.userId, user.id)),
  ]);

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
    userSearches.map(async (search) => {
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

  return NextResponse.json({
    stats: {
      totalListings: totalResult[0].count,
      newToday: todayResult[0].count,
      newThisWeek: weekResult[0].count,
      totalFavorites: favoritesResult[0].count,
    },
    latestListings: latestListings.map((l: any) => ({
      ...l,
      thumbnail: Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null,
      images: undefined,
    })),
    savedSearches: savedSearchResults,
    lastCrawl: lastCrawlData,
  });
}
