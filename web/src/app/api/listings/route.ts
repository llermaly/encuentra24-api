import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { listings, favorites, pipelineItems } from '@/db/schema';
import { buildListingWhere, buildListingOrderBy, getPagination } from '@/db/query-builder';
import { parseFiltersFromParams } from '@/types/filters';
import { sql, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const filters = parseFiltersFromParams(request.nextUrl.searchParams);
  const { limit, offset, page } = getPagination(filters);

  const where = buildListingWhere(filters);
  const orderBy = buildListingOrderBy(filters.sort);

  const rows = await db
    .select({
      adId: listings.adId,
      slug: listings.slug,
      url: listings.url,
      category: listings.category,
      subcategory: listings.subcategory,
      title: listings.title,
      price: listings.price,
      currency: listings.currency,
      oldPrice: listings.oldPrice,
      province: listings.province,
      city: listings.city,
      location: listings.location,
      latitude: listings.latitude,
      longitude: listings.longitude,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      parking: listings.parking,
      builtAreaSqm: listings.builtAreaSqm,
      landAreaSqm: listings.landAreaSqm,
      imageCount: listings.imageCount,
      images: listings.images,
      sellerName: listings.sellerName,
      sellerType: listings.sellerType,
      featureLevel: listings.featureLevel,
      favoritesCount: listings.favoritesCount,
      publishedAt: listings.publishedAt,
      firstSeenAt: listings.firstSeenAt,
      lastSeenAt: listings.lastSeenAt,
      isFavorite: sql<number>`CASE WHEN ${favorites.id} IS NOT NULL THEN 1 ELSE 0 END`.as('is_favorite'),
      pipelineStage: pipelineItems.stage,
    })
    .from(listings)
    .leftJoin(favorites, eq(listings.adId, favorites.adId))
    .leftJoin(pipelineItems, eq(listings.adId, pipelineItems.adId))
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .leftJoin(favorites, eq(listings.adId, favorites.adId))
    .leftJoin(pipelineItems, eq(listings.adId, pipelineItems.adId))
    .where(where);

  const total = countResult[0].count;

  return NextResponse.json({
    data: rows.map(r => ({
      ...r,
      isFavorite: r.isFavorite === 1,
      images: Array.isArray(r.images) ? r.images : [],
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
