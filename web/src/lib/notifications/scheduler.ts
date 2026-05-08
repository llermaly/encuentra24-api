import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { notificationDeliveries } from '@/db/schema';
import {
  captureSavedSearchDailySummary,
  getDefaultLookbackHours,
  markDailySummaryFailed,
  markDailySummarySent,
  type DailySummaryDigest,
  type SummaryCadence,
} from '@/lib/notifications/daily-summary';
import { sendEvoTextMessage } from '@/lib/notifications/evo';
import { listEnabledRecipientsByCadence, maskDestination } from '@/lib/notifications/recipients';
import { renderWhatsappDigestMessages } from '@/lib/notifications/whatsapp-summary';

const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000;

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
    const providerIds: string[] = [];
    for (const text of renderWhatsappDigestMessages(digest, cadence)) {
      const result = await sendEvoTextMessage(recipient.destination, text);
      if (result.providerMessageId) providerIds.push(result.providerMessageId);
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
