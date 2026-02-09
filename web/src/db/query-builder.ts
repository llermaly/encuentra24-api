import { and, eq, gte, lte, like, isNotNull, sql, desc, asc, SQL } from 'drizzle-orm';
import { listings, favorites, pipelineItems } from './schema';
import type { ListingFilters } from '@/types/filters';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

export function buildListingWhere(filters: ListingFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.q) {
    conditions.push(
      sql`(${listings.title} LIKE ${'%' + filters.q + '%'} OR ${listings.description} LIKE ${'%' + filters.q + '%'} OR ${listings.location} LIKE ${'%' + filters.q + '%'})`
    );
  }
  if (filters.category) conditions.push(eq(listings.category, filters.category));
  if (filters.subcategory) conditions.push(eq(listings.subcategory, filters.subcategory));
  if (filters.priceMin != null) conditions.push(gte(listings.price, filters.priceMin));
  if (filters.priceMax != null) conditions.push(lte(listings.price, filters.priceMax));
  if (filters.bedroomsMin != null) conditions.push(gte(listings.bedrooms, filters.bedroomsMin));
  if (filters.bedroomsMax != null) conditions.push(lte(listings.bedrooms, filters.bedroomsMax));
  if (filters.bathroomsMin != null) conditions.push(gte(listings.bathrooms, filters.bathroomsMin));
  if (filters.areaMin != null) conditions.push(gte(listings.builtAreaSqm, filters.areaMin));
  if (filters.areaMax != null) conditions.push(lte(listings.builtAreaSqm, filters.areaMax));
  if (filters.landAreaMin != null) conditions.push(gte(listings.landAreaSqm, filters.landAreaMin));
  if (filters.landAreaMax != null) conditions.push(lte(listings.landAreaSqm, filters.landAreaMax));
  if (filters.location) conditions.push(like(listings.location, `%${filters.location}%`));
  if (filters.province) conditions.push(eq(listings.province, filters.province));
  if (filters.city) conditions.push(eq(listings.city, filters.city));
  if (filters.publishedAfter) conditions.push(gte(listings.publishedAt, filters.publishedAfter));
  if (filters.firstSeenAfter) conditions.push(gte(listings.firstSeenAt, filters.firstSeenAfter));
  if (filters.hasCoords) {
    conditions.push(isNotNull(listings.latitude));
    conditions.push(isNotNull(listings.longitude));
  }
  if (filters.latMin != null) conditions.push(gte(listings.latitude, filters.latMin));
  if (filters.latMax != null) conditions.push(lte(listings.latitude, filters.latMax));
  if (filters.lngMin != null) conditions.push(gte(listings.longitude, filters.lngMin));
  if (filters.lngMax != null) conditions.push(lte(listings.longitude, filters.lngMax));

  if (filters.isFavorite) {
    conditions.push(isNotNull(favorites.id));
  }
  if (filters.inPipeline) {
    conditions.push(isNotNull(pipelineItems.id));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function buildListingOrderBy(sort?: string) {
  switch (sort) {
    case 'price_asc': return asc(listings.price);
    case 'price_desc': return desc(listings.price);
    case 'area_desc': return desc(listings.builtAreaSqm);
    case 'favorites_desc': return desc(listings.favoritesCount);
    case 'date_desc': return desc(listings.lastSeenAt);
    case 'first_seen_desc': return desc(listings.firstSeenAt);
    case 'published_desc':
    default: return desc(listings.publishedAt);
  }
}

export function getPagination(filters: ListingFilters) {
  const limit = Math.min(filters.limit || DEFAULT_PAGE_SIZE, 100);
  const page = Math.max(filters.page || 1, 1);
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}
