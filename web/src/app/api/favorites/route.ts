import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { favorites, listings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const rows = await db
    .select({
      adId: favorites.adId,
      createdAt: favorites.createdAt,
      title: listings.title,
      price: listings.price,
      currency: listings.currency,
      location: listings.location,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      builtAreaSqm: listings.builtAreaSqm,
      images: listings.images,
      url: listings.url,
    })
    .from(favorites)
    .leftJoin(listings, eq(favorites.adId, listings.adId));

  return NextResponse.json(rows.map(r => ({
    ...r,
    thumbnail: Array.isArray(r.images) && r.images.length > 0 ? r.images[0] : null,
    images: undefined,
  })));
}

export async function POST(request: NextRequest) {
  const { adId } = await request.json();

  const result = await db.insert(favorites).values({
    adId,
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().returning();

  return NextResponse.json(result[0] ?? { adId }, { status: 201 });
}
