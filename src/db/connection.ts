import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';
import { config } from '../config.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const { tursoUrl, tursoAuthToken, path } = config.database;

  let client;
  if (tursoUrl) {
    console.log('Connecting to Turso:', tursoUrl);
    client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });
  } else {
    mkdirSync(dirname(path), { recursive: true });
    client = createClient({
      url: `file:${path}`,
    });
  }

  return drizzle(client, { schema });
}

export function getDb() {
  if (!db) {
    db = createDb();
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
