import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { notificationRecipients } from '@/db/schema';
import type { SummaryCadence } from '@/lib/notifications/daily-summary';

export interface NotificationRecipientInput {
  phoneNumber: string;
  label?: string | null;
  dailyEnabled?: boolean;
  weeklyEnabled?: boolean;
}

export function normalizeWhatsappNumber(value: string) {
  return value.replace(/\D/g, '');
}

export function validateWhatsappNumber(value: string) {
  const normalized = normalizeWhatsappNumber(value);
  if (normalized.length < 8 || normalized.length > 20) {
    throw new Error('Enter a WhatsApp number with country code.');
  }
  return normalized;
}

export function maskDestination(destination: string) {
  if (destination.length <= 7) return destination;
  return `${destination.slice(0, 3)}...${destination.slice(-4)}`;
}

export async function listNotificationRecipients(userId: string) {
  return db
    .select()
    .from(notificationRecipients)
    .where(and(eq(notificationRecipients.userId, userId), eq(notificationRecipients.active, true)))
    .orderBy(asc(notificationRecipients.createdAt), asc(notificationRecipients.id));
}

export async function upsertNotificationRecipient(userId: string, input: NotificationRecipientInput) {
  const now = new Date().toISOString();
  const destination = validateWhatsappNumber(input.phoneNumber);
  const label = input.label?.trim() || null;

  const [recipient] = await db
    .insert(notificationRecipients)
    .values({
      userId,
      channel: 'whatsapp',
      destination,
      label,
      dailyEnabled: input.dailyEnabled ?? true,
      weeklyEnabled: input.weeklyEnabled ?? true,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        notificationRecipients.userId,
        notificationRecipients.channel,
        notificationRecipients.destination,
      ],
      set: {
        label,
        dailyEnabled: input.dailyEnabled ?? true,
        weeklyEnabled: input.weeklyEnabled ?? true,
        active: true,
        updatedAt: now,
      },
    })
    .returning();

  return recipient;
}

export async function updateNotificationRecipient(
  userId: string,
  recipientId: number,
  updates: Partial<NotificationRecipientInput> & { active?: boolean }
) {
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.phoneNumber != null) patch.destination = validateWhatsappNumber(updates.phoneNumber);
  if (updates.label !== undefined) patch.label = updates.label?.trim() || null;
  if (updates.dailyEnabled !== undefined) patch.dailyEnabled = updates.dailyEnabled;
  if (updates.weeklyEnabled !== undefined) patch.weeklyEnabled = updates.weeklyEnabled;
  if (updates.active !== undefined) patch.active = updates.active;

  const [recipient] = await db
    .update(notificationRecipients)
    .set(patch)
    .where(and(
      eq(notificationRecipients.id, recipientId),
      eq(notificationRecipients.userId, userId)
    ))
    .returning();

  return recipient ?? null;
}

export async function listEnabledRecipientsByCadence(cadence: SummaryCadence) {
  const cadenceEnabled = cadence === 'daily'
    ? notificationRecipients.dailyEnabled
    : notificationRecipients.weeklyEnabled;

  return db
    .select()
    .from(notificationRecipients)
    .where(and(
      eq(notificationRecipients.channel, 'whatsapp'),
      eq(notificationRecipients.active, true),
      eq(cadenceEnabled, true)
    ))
    .orderBy(asc(notificationRecipients.userId), asc(notificationRecipients.id));
}
