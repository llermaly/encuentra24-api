import { migrate } from 'drizzle-orm/libsql/migrator';
import { getDb } from './connection.js';

async function runMigrations() {
  const db = getDb();
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
