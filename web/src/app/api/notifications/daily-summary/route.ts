import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import {
  captureSavedSearchDailySummary,
  getLatestDailySummary,
  type SummaryCadence,
} from '@/lib/notifications/daily-summary';

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function optionalLookbackHours(value: unknown) {
  if (value == null) return undefined;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
    throw new Error('lookbackHours must be between 1 and 168');
  }
  return hours;
}

function parseCadence(value: unknown): SummaryCadence {
  if (value === 'weekly') return 'weekly';
  return 'daily';
}

function isMissingDigestTable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const cause = (error as Error & { cause?: { code?: string } }).cause;
  return cause?.code === '42P01' || error.message.includes('notification_digest_runs');
}

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const cadence = parseCadence(request.nextUrl.searchParams.get('cadence'));

  try {
    const digest = await getLatestDailySummary(user.id, cadence);
    return NextResponse.json({ digest });
  } catch (error) {
    if (isMissingDigestTable(error)) {
      return NextResponse.json({
        digest: null,
        setupRequired: true,
        error: 'Notification digest tables are not migrated yet.',
      });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  let body: Record<string, unknown> = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const digest = await captureSavedSearchDailySummary(user.id, {
      cadence: parseCadence(body.cadence),
      lookbackHours: optionalLookbackHours(body.lookbackHours),
      periodStart: optionalString(body.periodStart),
      periodEnd: optionalString(body.periodEnd),
    });

    return NextResponse.json({ digest }, { status: digest.status === 'pending' ? 201 : 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('lookbackHours')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isMissingDigestTable(error)) {
      return NextResponse.json({
        digest: null,
        setupRequired: true,
        error: 'Notification digest tables are not migrated yet.',
      }, { status: 409 });
    }
    throw error;
  }
}
