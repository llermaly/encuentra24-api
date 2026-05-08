import { NextRequest, NextResponse } from 'next/server';
import { runScheduledWhatsappDigests } from '@/lib/notifications/scheduler';
import type { SummaryCadence } from '@/lib/notifications/daily-summary';

function verifyCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function handleNotificationCron(request: NextRequest, cadence: SummaryCadence) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  const result = await runScheduledWhatsappDigests(cadence);
  return NextResponse.json(result);
}
