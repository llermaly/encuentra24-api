import { and, eq } from 'drizzle-orm';
import type sharp from 'sharp';
import { db } from '@/db';
import { notificationDeliveries } from '@/db/schema';
import {
  captureSavedSearchDailySummary,
  getDefaultLookbackHours,
  markDailySummaryFailed,
  markDailySummarySent,
  type DailySummaryDigest,
  type DigestListing,
  type SummaryCadence,
} from '@/lib/notifications/daily-summary';
import { sendEvoImageMessage, sendEvoTextMessage } from '@/lib/notifications/evo';
import { listEnabledRecipientsByCadence, maskDestination } from '@/lib/notifications/recipients';
import {
  getWhatsappDigestCards,
  renderWhatsappDigestIntroMessage,
  renderWhatsappDigestOverflowMessage,
  renderWhatsappListingCardCaption,
  renderWhatsappListingTextFallback,
  type WhatsappDigestCard,
} from '@/lib/notifications/whatsapp-summary';

const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DEFAULT_CARD_LIMIT = 10;
const DEFAULT_MESSAGE_DELAY_MS = 5000;
const MIN_MESSAGE_DELAY_MS = 1000;
const MAX_MESSAGE_DELAY_MS = 30000;
const IMAGE_FETCH_TIMEOUT_MS = 15000;
const WHATSAPP_IMAGE_MIMETYPE = 'image/jpeg';
const WHATSAPP_IMAGE_EXTENSION = 'jpg';
const WHATSAPP_IMAGE_MAX_SIZE = 1280;
const WHATSAPP_IMAGE_QUALITY = 84;
const WHATSAPP_NATIVE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

type SharpFactory = typeof sharp;
type SharpModule = { default: SharpFactory };

let sharpPromise: Promise<SharpFactory | null> | null = null;

interface NotificationRecipientRow {
  id: number;
  userId: string;
  channel: string;
  destination: string;
  label: string | null;
}

interface DeliveryResult {
  recipientId: number;
  destination: string;
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
}

interface MessageSender {
  send: () => Promise<{ providerMessageId: string | null; status: string | null }>;
}

export interface ScheduledDigestResult {
  userId: string;
  digestRunId: number;
  cadence: SummaryCadence;
  itemCount: number;
  deliveryResults: DeliveryResult[];
  error?: string;
}

function panamaDateParts(now: Date) {
  const shifted = new Date(now.getTime() - PANAMA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  return { shifted, year, month, day };
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getScheduleKey(cadence: SummaryCadence, now: Date) {
  const { shifted, year, month, day } = panamaDateParts(now);
  if (cadence === 'daily') return ymd(shifted);

  const localDay = shifted.getUTCDay();
  const daysSinceMonday = (localDay + 6) % 7;
  const monday = new Date(Date.UTC(year, month, day - daysSinceMonday));
  return `week-of-${ymd(monday)}`;
}

function groupByUser(recipients: NotificationRecipientRow[]) {
  const groups = new Map<string, NotificationRecipientRow[]>();
  for (const recipient of recipients) {
    const existing = groups.get(recipient.userId) ?? [];
    existing.push(recipient);
    groups.set(recipient.userId, existing);
  }
  return groups;
}

function getCardLimit() {
  const configured = Number(process.env.WHATSAPP_DIGEST_CARD_LIMIT ?? DEFAULT_CARD_LIMIT);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_CARD_LIMIT;
  return Math.min(Math.floor(configured), 25);
}

function getMessageDelayMs() {
  const configured = Number(process.env.WHATSAPP_DIGEST_MESSAGE_DELAY_MS ?? DEFAULT_MESSAGE_DELAY_MS);
  if (!Number.isFinite(configured)) return DEFAULT_MESSAGE_DELAY_MS;
  return Math.min(Math.max(Math.floor(configured), MIN_MESSAGE_DELAY_MS), MAX_MESSAGE_DELAY_MS);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadSharp() {
  sharpPromise ??= import('sharp')
    .then(module => (module as unknown as SharpModule).default)
    .catch(() => null);
  return sharpPromise;
}

async function normalizeImageForWhatsapp(buffer: Buffer, mimetype: string) {
  const sharp = await loadSharp();

  if (!sharp) {
    if (WHATSAPP_NATIVE_IMAGE_TYPES.has(mimetype)) {
      return { media: buffer, mimetype, extension: mimetype === 'image/png' ? 'png' : 'jpg' };
    }

    throw new Error(`Thumbnail conversion unavailable for ${mimetype}`);
  }

  const media = await sharp(buffer)
    .rotate()
    .resize({
      width: WHATSAPP_IMAGE_MAX_SIZE,
      height: WHATSAPP_IMAGE_MAX_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: WHATSAPP_IMAGE_QUALITY })
    .toBuffer();

  return {
    media,
    mimetype: WHATSAPP_IMAGE_MIMETYPE,
    extension: WHATSAPP_IMAGE_EXTENSION,
  };
}

async function fetchListingImage(listing: DigestListing) {
  if (!listing.thumbnail) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(listing.thumbnail, {
      signal: controller.signal,
      headers: {
        accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8,*/*;q=0.5',
        referer: listing.url ?? 'https://www.encuentra24.com/',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Thumbnail fetch failed (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimetype = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const image = await normalizeImageForWhatsapp(Buffer.from(arrayBuffer), mimetype);

  return {
    media: image.media.toString('base64'),
    mimetype: image.mimetype,
    extension: image.extension,
  };
}

async function createOrLoadDelivery(
  digest: DailySummaryDigest,
  cadence: SummaryCadence,
  recipient: NotificationRecipientRow
) {
  const now = new Date().toISOString();
  const inserted = await db
    .insert(notificationDeliveries)
    .values({
      digestRunId: digest.id,
      recipientId: recipient.id,
      userId: recipient.userId,
      channel: recipient.channel,
      destination: recipient.destination,
      cadence,
      status: 'queued',
      createdAt: now,
    })
    .onConflictDoNothing({
      target: [
        notificationDeliveries.digestRunId,
        notificationDeliveries.recipientId,
      ],
    })
    .returning();

  if (inserted.length > 0) return inserted[0];

  const [existing] = await db
    .select()
    .from(notificationDeliveries)
    .where(and(
      eq(notificationDeliveries.digestRunId, digest.id),
      eq(notificationDeliveries.recipientId, recipient.id)
    ))
    .limit(1);

  return existing ?? null;
}

async function sendDigestToRecipient(
  digest: DailySummaryDigest,
  cadence: SummaryCadence,
  recipient: NotificationRecipientRow
): Promise<DeliveryResult> {
  const delivery = await createOrLoadDelivery(digest, cadence, recipient);
  const maskedDestination = maskDestination(recipient.destination);

  if (!delivery) {
    return {
      recipientId: recipient.id,
      destination: maskedDestination,
      status: 'failed',
      error: 'Unable to create delivery row.',
    };
  }

  if (delivery.status === 'sent') {
    return {
      recipientId: recipient.id,
      destination: maskedDestination,
      status: 'skipped',
    };
  }

  try {
    const cardLimit = getCardLimit();
    const messageDelayMs = getMessageDelayMs();
    const cards = getWhatsappDigestCards(digest, cardLimit);
    const totalCardCount = cards[0]?.total ?? 0;
    const extraCount = totalCardCount - cards.length;
    const messageSenders: MessageSender[] = [
      {
        send: () => sendEvoTextMessage(
          recipient.destination,
          renderWhatsappDigestIntroMessage(digest, cadence, cardLimit, recipient.label)
        ),
      },
      ...cards.map(card => ({
        send: () => sendCardMessage(recipient.destination, card),
      })),
    ];

    if (extraCount > 0) {
      messageSenders.push({
        send: () => sendEvoTextMessage(
          recipient.destination,
          renderWhatsappDigestOverflowMessage(extraCount)
        ),
      });
    }

    const providerIds = delivery.providerMessageId
      ? delivery.providerMessageId.split(',').filter(Boolean)
      : [];

    await db
      .update(notificationDeliveries)
      .set({ status: 'sending', errorMessage: null })
      .where(eq(notificationDeliveries.id, delivery.id));

    for (let index = providerIds.length; index < messageSenders.length; index += 1) {
      if (index > 0) await sleep(messageDelayMs);
      const result = await messageSenders[index].send();
      providerIds.push(result.providerMessageId ?? `sent-${index + 1}`);

      await db
        .update(notificationDeliveries)
        .set({
          status: 'sending',
          providerMessageId: providerIds.join(','),
          errorMessage: null,
        })
        .where(eq(notificationDeliveries.id, delivery.id));
    }

    await db
      .update(notificationDeliveries)
      .set({
        status: 'sent',
        providerMessageId: providerIds.join(',') || null,
        errorMessage: null,
        sentAt: new Date().toISOString(),
      })
      .where(eq(notificationDeliveries.id, delivery.id));

    return {
      recipientId: recipient.id,
      destination: maskedDestination,
      status: 'sent',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Evo API error';
    await db
      .update(notificationDeliveries)
      .set({
        status: 'failed',
        errorMessage: message,
      })
      .where(eq(notificationDeliveries.id, delivery.id));

    return {
      recipientId: recipient.id,
      destination: maskedDestination,
      status: 'failed',
      error: message,
    };
  }
}

async function sendCardMessage(destination: string, card: WhatsappDigestCard) {
  const caption = renderWhatsappListingCardCaption(card);

  if (!card.listing.thumbnail) {
    return sendEvoTextMessage(destination, renderWhatsappListingTextFallback(card));
  }

  try {
    const image = await fetchListingImage(card.listing);
    if (!image) {
      return sendEvoTextMessage(destination, renderWhatsappListingTextFallback(card));
    }

    return sendEvoImageMessage({
      destination,
      media: image.media,
      mimetype: image.mimetype,
      caption,
      fileName: `${card.listing.adId}.${image.extension}`,
    });
  } catch {
    return sendEvoTextMessage(destination, renderWhatsappListingTextFallback(card));
  }
}

export async function runScheduledWhatsappDigests(
  cadence: SummaryCadence,
  now = new Date()
) {
  const recipients = await listEnabledRecipientsByCadence(cadence) as NotificationRecipientRow[];
  const groupedRecipients = groupByUser(recipients);
  const scheduleKey = getScheduleKey(cadence, now);
  const periodEnd = now.toISOString();
  const periodStart = new Date(
    now.getTime() - getDefaultLookbackHours(cadence) * 60 * 60 * 1000
  ).toISOString();
  const results: ScheduledDigestResult[] = [];

  for (const [userId, userRecipients] of groupedRecipients.entries()) {
    const digest = await captureSavedSearchDailySummary(userId, {
      cadence,
      lookbackHours: getDefaultLookbackHours(cadence),
      periodStart,
      periodEnd,
      scheduleKey,
      now,
    });

    const deliveryResults: DeliveryResult[] = [];
    for (const recipient of userRecipients) {
      deliveryResults.push(await sendDigestToRecipient(digest, cadence, recipient));
    }

    const failed = deliveryResults.find(result => result.status === 'failed');
    if (failed) {
      await markDailySummaryFailed(digest.id, failed.error ?? 'One or more WhatsApp deliveries failed.');
    } else {
      await markDailySummarySent(digest.id);
    }

    results.push({
      userId,
      digestRunId: digest.id,
      cadence,
      itemCount: digest.itemCount,
      deliveryResults,
      error: failed?.error,
    });
  }

  return {
    cadence,
    scheduleKey,
    userCount: groupedRecipients.size,
    recipientCount: recipients.length,
    results,
  };
}
