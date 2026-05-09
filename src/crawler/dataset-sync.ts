import { log } from 'crawlee';

type ListingDatasetEventType =
  | 'listing.card.inserted'
  | 'listing.price.updated'
  | 'listing.reappeared'
  | 'listing.detail.updated'
  | 'listing.removed';

export interface ListingDatasetEvent {
  eventType: ListingDatasetEventType;
  crawlRunId: number;
  adId: string;
  url?: string | null;
  occurredAt: string;
  postgres: {
    table: 'listings' | 'price_history';
    operation: 'insert' | 'update';
    fields: string[];
  };
  listing: Record<string, unknown>;
  changes?: Record<string, unknown>;
}

const DEFAULT_BATCH_SIZE = 50;
const MAX_STRING_LENGTH = 1000;
const MAX_ARRAY_ITEMS = 10;
const MAX_OBJECT_KEYS = 50;

const eventBuffer: ListingDatasetEvent[] = [];

function datasetBatchSize(): number {
  const value = Number(process.env.DATASET_SYNC_BATCH_SIZE);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_BATCH_SIZE;
}

function compactValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}...`;
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => compactValue(item, depth + 1));

    if (value.length <= MAX_ARRAY_ITEMS) {
      return items;
    }

    return {
      items,
      truncatedItems: value.length - MAX_ARRAY_ITEMS,
      totalItems: value.length,
    };
  }

  if (value && typeof value === 'object' && depth < 3) {
    return compactObject(value as Record<string, unknown>, depth + 1);
  }

  return value;
}

function compactObject(value: Record<string, unknown>, depth = 0): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_OBJECT_KEYS)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, compactValue(v, depth)]),
  );
}

export function buildListingDatasetEvent(
  event: Omit<ListingDatasetEvent, 'listing' | 'changes'> & {
    listing: Record<string, unknown>;
    changes?: Record<string, unknown>;
  },
): ListingDatasetEvent {
  return {
    ...event,
    listing: compactObject(event.listing),
    changes: event.changes ? compactObject(event.changes) : undefined,
  };
}

export async function pushListingDatasetEvents(
  enabled: boolean | undefined,
  events: ListingDatasetEvent[],
): Promise<void> {
  if (!enabled || events.length === 0) return;

  eventBuffer.push(...events);

  if (eventBuffer.length < datasetBatchSize()) return;

  await flushListingDatasetEvents(enabled);
}

export async function flushListingDatasetEvents(enabled: boolean | undefined): Promise<void> {
  if (!enabled || eventBuffer.length === 0) return;

  const batchSize = datasetBatchSize();
  let batch: ListingDatasetEvent[] = [];

  try {
    const { Actor } = await import('apify');

    while (eventBuffer.length > 0) {
      batch = eventBuffer.splice(0, batchSize);
      await Actor.pushData(batch);
      batch = [];
    }
  } catch (error) {
    if (batch.length > 0) {
      eventBuffer.unshift(...batch);
    }

    log.warning('Failed to push listing events to Crawlee dataset', {
      count: eventBuffer.length,
      error: (error as Error).message,
    });
  }
}
