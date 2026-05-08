import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import {
  listNotificationRecipients,
  upsertNotificationRecipient,
} from '@/lib/notifications/recipients';

function isMissingSettingsTable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const cause = (error as Error & { cause?: { code?: string } }).cause;
  return cause?.code === '42P01' || error.message.includes('notification_recipients');
}

function evoConfigured() {
  return Boolean(
    process.env.EVO_API_URL &&
    process.env.EVO_API_KEY &&
    process.env.EVO_INSTANCE_NAME
  );
}

export async function GET() {
  const user = await requireUser();

  try {
    const recipients = await listNotificationRecipients(user.id);
    return NextResponse.json({ recipients, evoConfigured: evoConfigured() });
  } catch (error) {
    if (isMissingSettingsTable(error)) {
      return NextResponse.json({
        recipients: [],
        evoConfigured: evoConfigured(),
        setupRequired: true,
        error: 'Notification recipient tables are not migrated yet.',
      });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json().catch(() => ({}));

  try {
    const recipient = await upsertNotificationRecipient(user.id, {
      phoneNumber: String(body.phoneNumber ?? ''),
      label: typeof body.label === 'string' ? body.label : null,
      dailyEnabled: typeof body.dailyEnabled === 'boolean' ? body.dailyEnabled : undefined,
      weeklyEnabled: typeof body.weeklyEnabled === 'boolean' ? body.weeklyEnabled : undefined,
    });

    return NextResponse.json({ recipient }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('WhatsApp number')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isMissingSettingsTable(error)) {
      return NextResponse.json({
        error: 'Notification recipient tables are not migrated yet.',
        setupRequired: true,
      }, { status: 409 });
    }
    throw error;
  }
}
