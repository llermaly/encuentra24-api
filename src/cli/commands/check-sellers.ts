import 'dotenv/config';
import { getDb } from '../../db/connection.js';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  const stats = await db.all(sql`
    SELECT
      COUNT(*) as total,
      COUNT(whatsapp) as with_wa,
      COUNT(DISTINCT whatsapp) as unique_wa,
      SUM(CASE WHEN whatsapp IS NULL OR whatsapp = '' THEN 1 ELSE 0 END) as no_wa,
      SUM(CASE WHEN whatsapp = '50764261804' THEN 1 ELSE 0 END) as generic_wa
    FROM sellers
  `);
  console.log('Seller stats:', JSON.stringify(stats, null, 2));

  const waDistribution = await db.all(sql`
    SELECT whatsapp, COUNT(*) as cnt
    FROM sellers
    WHERE whatsapp IS NOT NULL AND whatsapp != ''
    GROUP BY whatsapp
    ORDER BY cnt DESC
    LIMIT 10
  `);
  console.log('\nWhatsApp distribution (top 10):', JSON.stringify(waDistribution, null, 2));

  const sample = await db.all(sql`
    SELECT id, name, whatsapp, phone, profile_url, sample_listing_url
    FROM sellers
    LIMIT 5
  `);
  console.log('\nSample sellers:', JSON.stringify(sample, null, 2));

  process.exit(0);
}

main().catch(console.error);
