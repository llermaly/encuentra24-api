import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const tursoUrl = process.env.TURSO_DATABASE_URL;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  ...(tursoUrl && !tursoUrl.startsWith('file:')
    ? {
        dialect: 'turso',
        dbCredentials: {
          url: tursoUrl,
          authToken: process.env.TURSO_AUTH_TOKEN,
        },
      }
    : {
        dialect: 'sqlite',
        dbCredentials: {
          url: tursoUrl || 'file:local.db',
        },
      }),
});
