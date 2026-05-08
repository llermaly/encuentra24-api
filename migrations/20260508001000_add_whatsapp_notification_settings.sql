ALTER TABLE notification_digest_runs
  ADD COLUMN IF NOT EXISTS schedule_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_runs_user_kind_schedule
  ON notification_digest_runs (user_id, kind, schedule_key);

CREATE TABLE IF NOT EXISTS notification_recipients (
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
);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_user
  ON notification_recipients (user_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_recipients_unique_destination
  ON notification_recipients (user_id, channel, destination);

CREATE TABLE IF NOT EXISTS notification_deliveries (
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
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user
  ON notification_deliveries (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_run
  ON notification_deliveries (digest_run_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_unique_recipient
  ON notification_deliveries (digest_run_id, recipient_id);
