import { pgTable, text, integer, doublePrecision, boolean, serial, index, uniqueIndex, jsonb, primaryKey } from 'drizzle-orm/pg-core';

// ─── Crawler tables (read-only from web app) ───────────────────────────────

export const listings = pgTable('listings', {
  id: serial().primaryKey(),
  adId: text('ad_id').notNull().unique(),
  slug: text(),
  url: text().notNull(),

  category: text().notNull(),
  subcategory: text().notNull(),
  housingType: text('housing_type'),

  title: text(),
  description: text(),
  price: doublePrecision(),
  currency: text().default('USD'),
  oldPrice: doublePrecision('old_price'),
  pricePerSqmConstruction: doublePrecision('price_per_sqm_construction'),
  pricePerSqmLand: doublePrecision('price_per_sqm_land'),

  province: text(),
  city: text(),
  location: text(),
  address: text(),
  regionSlug: text('region_slug'),
  latitude: doublePrecision(),
  longitude: doublePrecision(),

  bedrooms: integer(),
  bathrooms: doublePrecision(),
  parking: integer(),
  builtAreaSqm: doublePrecision('built_area_sqm'),
  landAreaSqm: doublePrecision('land_area_sqm'),
  totalSqm: doublePrecision('total_sqm'),
  yearBuilt: integer('year_built'),
  levels: integer(),
  floorNumber: integer('floor_number'),
  floorType: text('floor_type'),
  ceilingHeight: doublePrecision('ceiling_height'),
  maintenanceCost: doublePrecision('maintenance_cost'),
  titleStatus: text('title_status'),

  images: jsonb().$type<string[]>(),
  imageCount: integer('image_count').default(0),
  hasVideo: boolean('has_video'),
  hasVr: boolean('has_vr'),

  sellerId: integer('seller_id'),
  sellerName: text('seller_name'),
  agentName: text('agent_name'),
  sellerType: text('seller_type'),
  sellerVerified: boolean('seller_verified'),

  featureLevel: text('feature_level'),
  discountPct: doublePrecision('discount_pct'),
  favoritesCount: integer('favorites_count'),

  amenities: jsonb().$type<string[]>(),

  publishedAt: text('published_at'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  removedAt: text('removed_at'),
  updatedAt: text('updated_at').notNull(),

  removalCheckedAt: text('removal_checked_at'),
  detailCrawled: boolean('detail_crawled').default(false),
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
  index('idx_category_subcategory').on(table.category, table.subcategory),
  index('idx_category_location').on(table.category, table.location),
  index('idx_category_price').on(table.category, table.price),
  index('idx_province_city').on(table.province, table.city),
  index('idx_published_at').on(table.publishedAt),
  index('idx_first_seen_at').on(table.firstSeenAt),
  index('idx_removed_at').on(table.removedAt),
  index('idx_category_published').on(table.category, table.publishedAt),
  index('idx_subcategory_published').on(table.subcategory, table.publishedAt),
]);

export const priceHistory = pgTable('price_history', {
  id: serial().primaryKey(),
  adId: text('ad_id').notNull(),
  price: doublePrecision().notNull(),
  currency: text().default('USD'),
  source: text(),
  recordedAt: text('recorded_at').notNull(),
}, (table) => [
  index('idx_ph_ad_id').on(table.adId),
  index('idx_ph_recorded_at').on(table.recordedAt),
]);

export const crawlRuns = pgTable('crawl_runs', {
  id: serial().primaryKey(),
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

export const crawlSeenListings = pgTable('crawl_seen_listings', {
  crawlRunId: integer('crawl_run_id').notNull(),
  adId: text('ad_id').notNull(),
  seenAt: text('seen_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.crawlRunId, table.adId], name: 'crawl_seen_listings_pkey' }),
  index('idx_csl_ad_id').on(table.adId),
  index('idx_csl_seen_at').on(table.seenAt),
]);

export const sellers = pgTable('sellers', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  type: text(),
  verified: boolean().default(false),
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

export const crawlErrors = pgTable('crawl_errors', {
  id: serial().primaryKey(),
  crawlRunId: integer('crawl_run_id'),
  url: text().notNull(),
  errorType: text('error_type').notNull(),
  statusCode: integer('status_code'),
  message: text(),
  occurredAt: text('occurred_at').notNull(),
});

// ─── App tables (read/write from web app, scoped by userId) ──────────────

export const favorites = pgTable('favorites', {
  id: serial().primaryKey(),
  userId: text('user_id').notNull(),
  adId: text('ad_id').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_fav_user_ad').on(table.userId, table.adId),
  index('idx_fav_user_id').on(table.userId),
]);

export const pipelineItems = pgTable('pipeline_items', {
  id: serial().primaryKey(),
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

export const propertyNotes = pgTable('property_notes', {
  id: serial().primaryKey(),
  userId: text('user_id').notNull(),
  adId: text('ad_id').notNull(),
  type: text().notNull().default('note'),
  content: text().notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_notes_user_ad').on(table.userId, table.adId),
  index('idx_notes_user_id').on(table.userId),
]);

export const savedSearches = pgTable('saved_searches', {
  id: serial().primaryKey(),
  userId: text('user_id').notNull(),
  name: text().notNull(),
  filters: text().notNull(),
  lastCheckedAt: text('last_checked_at'),
  newMatchCount: integer('new_match_count').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_ss_user_id').on(table.userId),
]);
