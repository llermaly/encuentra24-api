import { NextResponse } from 'next/server';
import { db } from '@/db';
import { savedSearches, listings, favorites, pipelineItems } from '@/db/schema';
import { buildListingWhere } from '@/db/query-builder';
import { sql, eq, gte, and } from 'drizzle-orm';
import type { ListingFilters } from '@/types/filters';

export async function POST() {
  const searches = await db.select().from(savedSearches);

  for (const search of searches) {
    const filters: ListingFilters = JSON.parse(search.filters);
    const where = buildListingWhere(filters);

    const timeFilter = search.lastCheckedAt
      ? gte(listings.firstSeenAt, search.lastCheckedAt)
      : undefined;

    const combined = where && timeFilter ? and(where, timeFilter) : (timeFilter ?? where);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(listings)
      .leftJoin(favorites, eq(listings.adId, favorites.adId))
      .leftJoin(pipelineItems, eq(listings.adId, pipelineItems.adId))
      .where(combined);

    const now = new Date().toISOString();
    await db
      .update(savedSearches)
      .set({
        newMatchCount: countResult[0].count,
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(savedSearches.id, search.id));
  }

  return NextResponse.json({ success: true, checked: searches.length });
}
