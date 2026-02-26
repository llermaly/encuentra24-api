import { NextResponse } from 'next/server';
import { db } from '@/db';
import { listings } from '@/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  // Run all 4 aggregations in parallel instead of sequential
  const [categories, provinces, cities, locations] = await Promise.all([
    db
      .select({
        category: listings.category,
        subcategory: listings.subcategory,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .groupBy(listings.category, listings.subcategory)
      .orderBy(listings.category, listings.subcategory),

    db
      .select({
        province: listings.province,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .groupBy(listings.province)
      .orderBy(listings.province),

    db
      .select({
        province: listings.province,
        city: listings.city,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .groupBy(listings.province, listings.city)
      .orderBy(listings.province, listings.city),

    db
      .select({
        location: listings.location,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .where(sql`${listings.location} IS NOT NULL`)
      .groupBy(listings.location)
      .orderBy(listings.location),
  ]);

  return NextResponse.json(
    { categories, provinces, cities, locations },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } },
  );
}
