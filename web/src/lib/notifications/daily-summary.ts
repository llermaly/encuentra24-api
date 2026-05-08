import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  favorites,
  listings,
  notificationDigestItems,
  notificationDigestRuns,
  pipelineItems,
  savedSearches,
} from '@/db/schema';
import { buildListingWhere } from '@/db/query-builder';
import { parseSavedSearchFilters } from '@/lib/saved-search-filters';

export type SummaryCadence = 'daily' | 'weekly';

const DIGEST_KIND_BY_CADENCE: Record<SummaryCadence, string> = {
  daily: 'saved_search_daily',
  weekly: 'saved_search_weekly',
};

const LOOKBACK_HOURS_BY_CADENCE: Record<SummaryCadence, number> = {
  daily: 24,
  weekly: 7 * 24,
};

const EVENT_TYPE_BY_CADENCE: Record<SummaryCadence, string> = {
  daily: 'new_saved_search_match_daily',
  weekly: 'new_saved_search_match_weekly',
};
const SAVED_SEARCH_SOURCE = 'saved_search';
const INSERT_BATCH_SIZE = 500;

export interface CaptureOptions {
  cadence?: SummaryCadence;
  lookbackHours?: number;
  periodStart?: string;
  periodEnd?: string;
  scheduleKey?: string;
  now?: Date;
}

export interface DigestListing {
  itemId: number;
  adId: string;
  eventAt: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  subcategory: string | null;
  location: string | null;
  city: string | null;
  province: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaSqm: number | null;
  url: string | null;
  thumbnail: string | null;
}

export interface DigestSearchGroup {
  id: number | null;
  name: string;
  listings: DigestListing[];
}

interface MatchingListing {
  adId: string;
  firstSeenAt: string;
}

interface DigestItemInsert {
  digestRunId: number;
  userId: string;
  eventType: string;
  sourceType: string;
  sourceId: number;
  adId: string;
  eventAt: string;
  capturedAt: string;
}

export interface DailySummaryDigest {
  id: number;
  kind: string;
  scheduleKey: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  itemCount: number;
  createdAt: string;
  sentAt: string | null;
  savedSearches: DigestSearchGroup[];
}

function getCaptureWindow(options: CaptureOptions) {
  const now = options.now ?? new Date();
  const periodEnd = options.periodEnd ?? now.toISOString();
  const lookbackHours = options.lookbackHours ?? LOOKBACK_HOURS_BY_CADENCE[options.cadence ?? 'daily'];
  const periodStart = options.periodStart ?? new Date(
    new Date(periodEnd).getTime() - lookbackHours * 60 * 60 * 1000
  ).toISOString();

  return { now, periodStart, periodEnd };
}

export async function getDailySummaryDigest(
  userId: string,
  digestRunId: number
): Promise<DailySummaryDigest | null> {
  const [run] = await db
    .select()
    .from(notificationDigestRuns)
    .where(and(eq(notificationDigestRuns.id, digestRunId), eq(notificationDigestRuns.userId, userId)))
    .limit(1);

  if (!run) return null;

  const rows = await db
    .select({
      itemId: notificationDigestItems.id,
      sourceId: notificationDigestItems.sourceId,
      eventAt: notificationDigestItems.eventAt,
      searchName: savedSearches.name,
      adId: notificationDigestItems.adId,
      title: listings.title,
      price: listings.price,
      currency: listings.currency,
      category: listings.category,
      subcategory: listings.subcategory,
      location: listings.location,
      city: listings.city,
      province: listings.province,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      builtAreaSqm: listings.builtAreaSqm,
      url: listings.url,
      images: listings.images,
    })
    .from(notificationDigestItems)
    .leftJoin(listings, eq(notificationDigestItems.adId, listings.adId))
    .leftJoin(savedSearches, eq(notificationDigestItems.sourceId, savedSearches.id))
    .where(and(eq(notificationDigestItems.digestRunId, digestRunId), eq(notificationDigestItems.userId, userId)))
    .orderBy(desc(notificationDigestItems.eventAt));

  const groupsBySearch = new Map<string, DigestSearchGroup>();

  for (const row of rows) {
    const groupKey = row.sourceId == null ? 'unknown' : String(row.sourceId);
    const existingGroup = groupsBySearch.get(groupKey);
    const group: DigestSearchGroup = existingGroup ?? {
      id: row.sourceId,
      name: row.searchName ?? 'Saved search',
      listings: [],
    };

    group.listings.push({
      itemId: row.itemId,
      adId: row.adId,
      eventAt: row.eventAt,
      title: row.title,
      price: row.price,
      currency: row.currency,
      category: row.category,
      subcategory: row.subcategory,
      location: row.location,
      city: row.city,
      province: row.province,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      builtAreaSqm: row.builtAreaSqm,
      url: row.url,
      thumbnail: Array.isArray(row.images) && row.images.length > 0 ? row.images[0] : null,
    });

    if (!existingGroup) groupsBySearch.set(groupKey, group);
  }

  return {
    id: run.id,
    kind: run.kind,
    scheduleKey: run.scheduleKey,
    status: run.status,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    itemCount: Number(run.itemCount ?? rows.length),
    createdAt: run.createdAt,
    sentAt: run.sentAt,
    savedSearches: Array.from(groupsBySearch.values()),
  };
}

export async function getLatestDailySummary(
  userId: string,
  cadence: SummaryCadence = 'daily'
): Promise<DailySummaryDigest | null> {
  const [run] = await db
    .select({ id: notificationDigestRuns.id })
    .from(notificationDigestRuns)
    .where(and(
      eq(notificationDigestRuns.userId, userId),
      eq(notificationDigestRuns.kind, DIGEST_KIND_BY_CADENCE[cadence])
    ))
    .orderBy(
      sql`case when ${notificationDigestRuns.status} = 'pending' and ${notificationDigestRuns.itemCount} > 0 then 0 else 1 end`,
      desc(notificationDigestRuns.createdAt)
    )
    .limit(1);

  return run ? getDailySummaryDigest(userId, run.id) : null;
}

async function insertDigestItems(rows: DigestItemInsert[]) {
  let insertedCount = 0;

  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);
    const inserted = await db
      .insert(notificationDigestItems)
      .values(batch)
      .onConflictDoNothing({
        target: [
          notificationDigestItems.userId,
          notificationDigestItems.eventType,
          notificationDigestItems.adId,
          notificationDigestItems.eventAt,
        ],
      })
      .returning({ id: notificationDigestItems.id });

    insertedCount += inserted.length;
  }

  return insertedCount;
}

export async function captureSavedSearchDailySummary(
  userId: string,
  options: CaptureOptions = {}
): Promise<DailySummaryDigest> {
  const cadence = options.cadence ?? 'daily';
  const eventType = EVENT_TYPE_BY_CADENCE[cadence];
  const { now, periodStart, periodEnd } = getCaptureWindow(options);
  const createdAt = now.toISOString();

  const runValues = {
    userId,
    kind: DIGEST_KIND_BY_CADENCE[cadence],
    scheduleKey: options.scheduleKey ?? null,
    status: 'pending',
    periodStart,
    periodEnd,
    itemCount: 0,
    createdAt,
  };

  const insertedRuns = await db
    .insert(notificationDigestRuns)
    .values(runValues)
    .onConflictDoNothing({
      target: [
        notificationDigestRuns.userId,
        notificationDigestRuns.kind,
        notificationDigestRuns.scheduleKey,
      ],
    })
    .returning();

  if (insertedRuns.length === 0 && options.scheduleKey) {
    const [existingRun] = await db
      .select()
      .from(notificationDigestRuns)
      .where(and(
        eq(notificationDigestRuns.userId, userId),
        eq(notificationDigestRuns.kind, DIGEST_KIND_BY_CADENCE[cadence]),
        eq(notificationDigestRuns.scheduleKey, options.scheduleKey)
      ))
      .limit(1);

    if (existingRun) {
      const existingDigest = await getDailySummaryDigest(userId, existingRun.id);
      if (existingDigest) return existingDigest;
    }
  }

  const [run] = insertedRuns;
  if (!run) throw new Error('Failed to create daily summary digest run');

  const searches = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(asc(savedSearches.id));

  let capturedCount = 0;

  for (const search of searches) {
    const filters = parseSavedSearchFilters(search.filters);
    const where = buildListingWhere(filters);
    const timeWindow = and(
      gte(listings.firstSeenAt, periodStart),
      lte(listings.firstSeenAt, periodEnd)
    );
    const combinedWhere = where ? and(where, timeWindow) : timeWindow;
    const needsUserJoins = filters.isFavorite || filters.inPipeline;

    const matches = (needsUserJoins
      ? await db
          .select({ adId: listings.adId, firstSeenAt: listings.firstSeenAt })
          .from(listings)
          .leftJoin(favorites, and(eq(listings.adId, favorites.adId), eq(favorites.userId, userId)))
          .leftJoin(pipelineItems, and(eq(listings.adId, pipelineItems.adId), eq(pipelineItems.userId, userId)))
          .where(combinedWhere)
          .orderBy(desc(listings.firstSeenAt))
      : await db
          .select({ adId: listings.adId, firstSeenAt: listings.firstSeenAt })
          .from(listings)
          .where(combinedWhere)
          .orderBy(desc(listings.firstSeenAt))) as MatchingListing[];

    if (matches.length === 0) continue;

    const insertedCount = await insertDigestItems(
      matches.map((match) => ({
        digestRunId: run.id,
        userId,
        eventType,
        sourceType: SAVED_SEARCH_SOURCE,
        sourceId: search.id,
        adId: match.adId,
        eventAt: match.firstSeenAt,
        capturedAt: createdAt,
      }))
    );

    capturedCount += insertedCount;
  }

  const status = capturedCount > 0 ? 'pending' : 'empty';

  await db
    .update(notificationDigestRuns)
    .set({ status, itemCount: capturedCount })
    .where(eq(notificationDigestRuns.id, run.id));

  const digest = await getDailySummaryDigest(userId, run.id);
  if (!digest) throw new Error('Failed to load created daily summary digest');

  return digest;
}

export function getDigestKind(cadence: SummaryCadence) {
  return DIGEST_KIND_BY_CADENCE[cadence];
}

export function getDefaultLookbackHours(cadence: SummaryCadence) {
  return LOOKBACK_HOURS_BY_CADENCE[cadence];
}

export async function markDailySummarySent(digestRunId: number, sentAt = new Date().toISOString()) {
  await db
    .update(notificationDigestRuns)
    .set({ status: 'sent', sentAt, errorMessage: null })
    .where(eq(notificationDigestRuns.id, digestRunId));
}

export async function markDailySummaryFailed(digestRunId: number, errorMessage: string) {
  await db
    .update(notificationDigestRuns)
    .set({ status: 'failed', errorMessage })
    .where(eq(notificationDigestRuns.id, digestRunId));
}
