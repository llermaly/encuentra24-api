export interface ListingFilters {
  q?: string;
  category?: string;
  subcategory?: string;
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bedroomsMax?: number;
  bathroomsMin?: number;
  areaMin?: number;
  areaMax?: number;
  landAreaMin?: number;
  landAreaMax?: number;
  location?: string;
  province?: string;
  city?: string;
  publishedAfter?: string;
  firstSeenAfter?: string;
  hasCoords?: boolean;
  latMin?: number;
  latMax?: number;
  lngMin?: number;
  lngMax?: number;
  isFavorite?: boolean;
  inPipeline?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export function parseFiltersFromParams(params: URLSearchParams): ListingFilters {
  const filters: ListingFilters = {};

  const str = (key: string) => params.get(key) || undefined;
  const num = (key: string) => {
    const v = params.get(key);
    return v ? Number(v) : undefined;
  };
  const bool = (key: string) => {
    const v = params.get(key);
    return v === 'true' ? true : v === 'false' ? false : undefined;
  };

  filters.q = str('q');
  filters.category = str('category');
  filters.subcategory = str('subcategory');
  filters.priceMin = num('priceMin');
  filters.priceMax = num('priceMax');
  filters.bedroomsMin = num('bedroomsMin');
  filters.bedroomsMax = num('bedroomsMax');
  filters.bathroomsMin = num('bathroomsMin');
  filters.areaMin = num('areaMin');
  filters.areaMax = num('areaMax');
  filters.landAreaMin = num('landAreaMin');
  filters.landAreaMax = num('landAreaMax');
  filters.location = str('location');
  filters.province = str('province');
  filters.city = str('city');
  filters.publishedAfter = str('publishedAfter');
  filters.firstSeenAfter = str('firstSeenAfter');
  filters.hasCoords = bool('hasCoords');
  filters.latMin = num('latMin');
  filters.latMax = num('latMax');
  filters.lngMin = num('lngMin');
  filters.lngMax = num('lngMax');
  filters.isFavorite = bool('isFavorite');
  filters.inPipeline = bool('inPipeline');
  filters.sort = str('sort');
  filters.page = num('page');
  filters.limit = num('limit');

  return filters;
}
