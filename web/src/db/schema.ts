import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ─── Crawler tables (read-only from web app) ───────────────────────────────

export const listings = sqliteTable('listings', {
  id: integer().primaryKey({ autoIncrement: true }),
  adId: text('ad_id').notNull().unique(),
  slug: text(),
  url: text().notNull(),

  category: text().notNull(),
  subcategory: text().notNull(),
  housingType: text('housing_type'),

  title: text(),
  description: text(),
  price: real(),
  currency: text().default('USD'),
  oldPrice: real('old_price'),
  pricePerSqmConstruction: real('price_per_sqm_construction'),
  pricePerSqmLand: real('price_per_sqm_land'),

  province: text(),
  city: text(),
  location: text(),
  address: text(),
  regionSlug: text('region_slug'),
  latitude: real(),
  longitude: real(),

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

  images: text({ mode: 'json' }).$type<string[]>(),
  imageCount: integer('image_count').default(0),
  hasVideo: integer('has_video', { mode: 'boolean' }),
  hasVr: integer('has_vr', { mode: 'boolean' }),

  sellerId: integer('seller_id'),
  sellerName: text('seller_name'),
  agentName: text('agent_name'),
  sellerType: text('seller_type'),
  sellerVerified: integer('seller_verified', { mode: 'boolean' }),

  featureLevel: text('feature_level'),
  discountPct: real('discount_pct'),
  favoritesCount: integer('favorites_count'),

  amenities: text({ mode: 'json' }).$type<string[]>(),

  publishedAt: text('published_at'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  removedAt: text('removed_at'),
  updatedAt: text('updated_at').notNull(),

  detailCrawled: integer('detail_crawled', { mode: 'boolean' }).default(false),
  crawlVersion: integer('crawl_version').default(1),

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
  type: text().default('incremental'),
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

export const sellers = sqliteTable('sellers', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  type: text(),
  verified: integer({ mode: 'boolean' }).default(false),
  whatsapp: text(),
  phone: text(),
  profileUrl: text('profile_url'),
  listingCount: integer('listing_count').default(0),
  sampleListingUrl: text('sample_listing_url'),
  firstSeenAt: text('first_seen_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_seller_name').on(table.name),
  index('idx_seller_whatsapp').on(table.whatsapp),
]);

export const crawlErrors = sqliteTable('crawl_errors', {
  id: integer().primaryKey({ autoIncrement: true }),
  crawlRunId: integer('crawl_run_id'),
  url: text().notNull(),
  errorType: text('error_type').notNull(),
  statusCode: integer('status_code'),
  message: text(),
  occurredAt: text('occurred_at').notNull(),
});

// ─── App tables (read/write from web app, scoped by userId) ──────────────

export const favorites = sqliteTable('favorites', {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  adId: text('ad_id').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_fav_user_ad').on(table.userId, table.adId),
  index('idx_fav_user_id').on(table.userId),
]);

export const pipelineItems = sqliteTable('pipeline_items', {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  adId: text('ad_id').notNull(),
  stage: text().notNull().default('discovered'),
  position: integer().notNull().default(0),
  movedAt: text('moved_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_pipe_user_ad').on(table.userId, table.adId),
  index('idx_pipe_user_id').on(table.userId),
  index('idx_pipe_stage').on(table.stage),
]);

export const propertyNotes = sqliteTable('property_notes', {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  adId: text('ad_id').notNull(),
  type: text().notNull().default('note'),
  content: text().notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_notes_user_ad').on(table.userId, table.adId),
  index('idx_notes_user_id').on(table.userId),
]);

export const savedSearches = sqliteTable('saved_searches', {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  name: text().notNull(),
  filters: text().notNull(), // JSON serialized
  lastCheckedAt: text('last_checked_at'),
  newMatchCount: integer('new_match_count').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_ss_user_id').on(table.userId),
]);
