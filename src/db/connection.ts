import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import * as schema from './schema.js';

let db: ReturnType<typeof drizzle> | null = null;

export async function initDb() {
  if (!db) {
    const url = config.database.url;
    console.log('Connecting to PostgreSQL:', url.replace(/:[^:@]+@/, ':***@'));
    const client = postgres(url);
    db = drizzle(client, { schema });
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
