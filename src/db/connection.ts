import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import * as schema from './schema.js';

let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export async function initDb() {
  if (!db) {
    const url = config.database.url;
    console.log('Connecting to PostgreSQL:', url.replace(/:[^:@]+@/, ':***@'));
    client = postgres(url);
    db = drizzle(client, { schema });
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

export type Database = ReturnType<typeof getDb>;
