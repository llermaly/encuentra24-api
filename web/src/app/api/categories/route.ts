import { NextResponse } from 'next/server';
import { db } from '@/db';
import { listings } from '@/db/schema';
import { sql, isNull, and } from 'drizzle-orm';

export async function GET() {
  const active = isNull(listings.removedAt);
  const [categories, provinces, cities, locations] = await Promise.all([
    db
      .select({
        category: listings.category,
        subcategory: listings.subcategory,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .where(active)
      .groupBy(listings.category, listings.subcategory)
      .orderBy(listings.category, listings.subcategory),

    db
      .select({
        province: listings.province,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .where(active)
      .groupBy(listings.province)
      .orderBy(listings.province),

    db
      .select({
        province: listings.province,
        city: listings.city,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .where(active)
      .groupBy(listings.province, listings.city)
      .orderBy(listings.province, listings.city),

    db
      .select({
        location: listings.location,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .where(and(active, sql`${listings.location} IS NOT NULL`))
      .groupBy(listings.location)
      .orderBy(listings.location),
  ]);

  return NextResponse.json({ categories, provinces, cities, locations });
}
