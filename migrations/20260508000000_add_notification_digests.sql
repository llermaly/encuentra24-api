CREATE TABLE IF NOT EXISTS notification_digest_runs (
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
);

CREATE INDEX IF NOT EXISTS idx_digest_runs_user_kind_status
  ON notification_digest_runs (user_id, kind, status);

CREATE INDEX IF NOT EXISTS idx_digest_runs_created_at
  ON notification_digest_runs (created_at);

CREATE TABLE IF NOT EXISTS notification_digest_items (
  id serial PRIMARY KEY,
  digest_run_id integer NOT NULL,
  user_id text NOT NULL,
  event_type text NOT NULL,
  source_type text NOT NULL,
  source_id integer,
  ad_id text NOT NULL,
  event_at text NOT NULL,
  captured_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_digest_items_run_id
  ON notification_digest_items (digest_run_id);

CREATE INDEX IF NOT EXISTS idx_digest_items_user_event
  ON notification_digest_items (user_id, event_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_items_unique_event
  ON notification_digest_items (user_id, event_type, ad_id, event_at);
