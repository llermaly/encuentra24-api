import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;

// Auto-create/migrate app-owned tables (crawler tables are managed by the crawler)
const _migrated = client.executeMultiple(`
  -- Drop old single-user tables and recreate with user_id
  DROP TABLE IF EXISTS favorites;
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_user_ad ON favorites(user_id, ad_id);
  CREATE INDEX IF NOT EXISTS idx_fav_user_id ON favorites(user_id);

  DROP TABLE IF EXISTS pipeline_items;
  CREATE TABLE IF NOT EXISTS pipeline_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'discovered',
    position INTEGER NOT NULL DEFAULT 0,
    moved_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pipe_user_ad ON pipeline_items(user_id, ad_id);
  CREATE INDEX IF NOT EXISTS idx_pipe_user_id ON pipeline_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_pipe_stage ON pipeline_items(stage);

  DROP TABLE IF EXISTS property_notes;
  CREATE TABLE IF NOT EXISTS property_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'note',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notes_user_ad ON property_notes(user_id, ad_id);
  CREATE INDEX IF NOT EXISTS idx_notes_user_id ON property_notes(user_id);

  DROP TABLE IF EXISTS saved_searches;
  CREATE TABLE IF NOT EXISTS saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    filters TEXT NOT NULL,
    last_checked_at TEXT,
    new_match_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ss_user_id ON saved_searches(user_id);
`);
