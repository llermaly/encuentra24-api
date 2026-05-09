import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

const MIGRATION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS notification_digest_runs (
    id serial PRIMARY KEY,
    user_id text NOT NULL,
    kind text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    period_start text NOT NULL,
    period_end text NOT NULL,
    item_count integer NOT NULL DEFAULT 0,
    created_at text NOT NULL,
    sent_at text,
    error_message text
  )`,
  `CREATE INDEX IF NOT EXISTS idx_digest_runs_user_kind_status
    ON notification_digest_runs (user_id, kind, status)`,
  `CREATE INDEX IF NOT EXISTS idx_digest_runs_created_at
    ON notification_digest_runs (created_at)`,
  `CREATE TABLE IF NOT EXISTS notification_digest_items (
    id serial PRIMARY KEY,
    digest_run_id integer NOT NULL,
    user_id text NOT NULL,
    event_type text NOT NULL,
    source_type text NOT NULL,
    source_id integer,
    ad_id text NOT NULL,
    event_at text NOT NULL,
    captured_at text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_digest_items_run_id
    ON notification_digest_items (digest_run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_digest_items_user_event
    ON notification_digest_items (user_id, event_type)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_items_unique_event
    ON notification_digest_items (user_id, event_type, ad_id, event_at)`,
  `ALTER TABLE notification_digest_runs
    ADD COLUMN IF NOT EXISTS schedule_key text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_runs_user_kind_schedule
    ON notification_digest_runs (user_id, kind, schedule_key)`,
  `CREATE TABLE IF NOT EXISTS notification_recipients (
    id serial PRIMARY KEY,
    user_id text NOT NULL,
    channel text NOT NULL DEFAULT 'whatsapp',
    destination text NOT NULL,
    label text,
    daily_enabled boolean NOT NULL DEFAULT true,
    weekly_enabled boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notification_recipients_user
    ON notification_recipients (user_id, active)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_recipients_unique_destination
    ON notification_recipients (user_id, channel, destination)`,
  `CREATE TABLE IF NOT EXISTS notification_deliveries (
    id serial PRIMARY KEY,
    digest_run_id integer NOT NULL,
    recipient_id integer NOT NULL,
    user_id text NOT NULL,
    channel text NOT NULL,
    destination text NOT NULL,
    cadence text NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    provider_message_id text,
    error_message text,
    created_at text NOT NULL,
    sent_at text
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user
    ON notification_deliveries (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_notification_deliveries_run
    ON notification_deliveries (digest_run_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_unique_recipient
    ON notification_deliveries (digest_run_id, recipient_id)`,
];

function verifyRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function POST(request: NextRequest) {
  const unauthorized = verifyRequest(request);
  if (unauthorized) return unauthorized;

  for (const statement of MIGRATION_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }

  const tables = await db.all<{ tableName: string }>(sql`
    select table_name as "tableName"
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'notification_digest_runs',
        'notification_digest_items',
        'notification_recipients',
        'notification_deliveries'
      )
    order by table_name
  `);

  const scheduleKeyColumns = await db.all<{ columnName: string }>(sql`
    select column_name as "columnName"
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_digest_runs'
      and column_name = 'schedule_key'
  `);

  return NextResponse.json({
    migrated: true,
    tables: tables.map(table => table.tableName),
    scheduleKeyColumn: scheduleKeyColumns.length === 1,
  });
}
