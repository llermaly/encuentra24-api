import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { updateNotificationRecipient } from '@/lib/notifications/recipients';

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid recipient id');
  return id;
}

function isUniqueDestinationError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const cause = (error as Error & { cause?: { code?: string } }).cause;
  return cause?.code === '23505';
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const recipient = await updateNotificationRecipient(user.id, parseId(id), {
      phoneNumber: typeof body.phoneNumber === 'string' ? body.phoneNumber : undefined,
      label: typeof body.label === 'string' || body.label === null ? body.label : undefined,
      dailyEnabled: typeof body.dailyEnabled === 'boolean' ? body.dailyEnabled : undefined,
      weeklyEnabled: typeof body.weeklyEnabled === 'boolean' ? body.weeklyEnabled : undefined,
      active: typeof body.active === 'boolean' ? body.active : undefined,
    });

    if (!recipient) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ recipient });
  } catch (error) {
    if (error instanceof Error && error.message.includes('WhatsApp number')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueDestinationError(error)) {
      return NextResponse.json({ error: 'That WhatsApp number is already configured.' }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const recipient = await updateNotificationRecipient(user.id, parseId(id), { active: false });
  if (!recipient) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
