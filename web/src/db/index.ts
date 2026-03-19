import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { SQL } from 'drizzle-orm';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://encuentra24:encuentra24@localhost:5433/encuentra24';

const client = postgres(connectionString);
const pgDb = drizzle(client, { schema });

interface DbWithAll {
  all: <T = any>(query: SQL) => Promise<T[]>;
  select: any;
  insert: any;
  update: any;
  delete: any;
  execute: any;
  [key: string]: any;
}

// Polyfill .all() for compatibility with raw SQL queries
(pgDb as any).all = async <T = any>(query: any): Promise<T[]> => {
  const result = await pgDb.execute(query);
  return (result as any).rows ?? (result as T[]);
};

export const db: DbWithAll = pgDb as any;
export type Database = typeof db;
