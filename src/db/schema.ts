import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const listings = sqliteTable('listings', {
  id: integer().primaryKey({ autoIncrement: true }),
  adId: text('ad_id').notNull().unique(),
  slug: text(),
  url: text().notNull(),

  // Classification
  category: text().notNull(),
  subcategory: text().notNull(),
  housingType: text('housing_type'),

  // Core property data
  title: text(),
  description: text(),
  price: real(),
  currency: text().default('USD'),
  oldPrice: real('old_price'),
  pricePerSqmConstruction: real('price_per_sqm_construction'),
  pricePerSqmLand: real('price_per_sqm_land'),

  // Location
  province: text(),
  city: text(),
  location: text(),
  address: text(),
  regionSlug: text('region_slug'),
  latitude: real(),
  longitude: real(),

  // Property features
  bedrooms: integer(),
  bathrooms: real(),
  parking: integer(),
  builtAreaSqm: real('built_area_sqm'),
  landAreaSqm: real('land_area_sqm'),
  totalSqm: real('total_sqm'),
  yearBuilt: integer('year_built'),
  levels: integer(),
  floorNumber: integer('floor_number'),
  floorType: text('floor_type'),
  ceilingHeight: real('ceiling_height'),
  maintenanceCost: real('maintenance_cost'),
  titleStatus: text('title_status'),

  // Media
  images: text({ mode: 'json' }).$type<string[]>(),
  imageCount: integer('image_count').default(0),
  hasVideo: integer('has_video', { mode: 'boolean' }),
  hasVr: integer('has_vr', { mode: 'boolean' }),

  // Seller / Agent
  sellerName: text('seller_name'),
  sellerType: text('seller_type'),
  sellerVerified: integer('seller_verified', { mode: 'boolean' }),

  // Ad prominence
  featureLevel: text('feature_level'),
  discountPct: real('discount_pct'),
  favoritesCount: integer('favorites_count'),

  // Amenities
  amenities: text({ mode: 'json' }).$type<string[]>(),

  // Timestamps
  publishedAt: text('published_at'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  removedAt: text('removed_at'),
  updatedAt: text('updated_at').notNull(),

  // Crawl metadata
  detailCrawled: integer('detail_crawled', { mode: 'boolean' }).default(false),
  crawlVersion: integer('crawl_version').default(1),

  // Raw data
  rawJsonLd: text('raw_json_ld'),
  rawLoopaData: text('raw_loopa_data'),
  rawRetailRocket: text('raw_retail_rocket'),
}, (table) => [
  index('idx_category').on(table.category),
  index('idx_subcategory').on(table.subcategory),
  index('idx_price').on(table.price),
  index('idx_bedrooms').on(table.bedrooms),
  index('idx_location').on(table.location),
  index('idx_province').on(table.province),
  index('idx_city').on(table.city),
  index('idx_last_seen').on(table.lastSeenAt),
  index('idx_detail_crawled').on(table.detailCrawled),
  index('idx_built_area').on(table.builtAreaSqm),
  index('idx_land_area').on(table.landAreaSqm),
  index('idx_year_built').on(table.yearBuilt),
  index('idx_category_location').on(table.category, table.location),
  index('idx_category_price').on(table.category, table.price),
]);

export const priceHistory = sqliteTable('price_history', {
  id: integer().primaryKey({ autoIncrement: true }),
  adId: text('ad_id').notNull(),
  price: real().notNull(),
  currency: text().default('USD'),
  source: text(),
  recordedAt: text('recorded_at').notNull(),
}, (table) => [
  index('idx_ph_ad_id').on(table.adId),
  index('idx_ph_recorded_at').on(table.recordedAt),
]);

export const crawlRuns = sqliteTable('crawl_runs', {
  id: integer().primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text().notNull(),
  category: text(),
  subcategory: text(),
  regionSlug: text('region_slug'),
  pagesProcessed: integer('pages_processed').default(0),
  listingsFound: integer('listings_found').default(0),
  listingsNew: integer('listings_new').default(0),
  listingsUpdated: integer('listings_updated').default(0),
  detailsCrawled: integer('details_crawled').default(0),
  errors: integer().default(0),
  durationSecs: integer('duration_secs'),
});

export const crawlErrors = sqliteTable('crawl_errors', {
  id: integer().primaryKey({ autoIncrement: true }),
  crawlRunId: integer('crawl_run_id'),
  url: text().notNull(),
  errorType: text('error_type').notNull(),
  statusCode: integer('status_code'),
  message: text(),
  occurredAt: text('occurred_at').notNull(),
});
