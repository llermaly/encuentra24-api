import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { closeDb, initDb, getDb } from './connection.js';

async function runMigrations() {
  await initDb();
  const db = getDb();
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');
}

try {
  await runMigrations();
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
