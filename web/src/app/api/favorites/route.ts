import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { favorites, listings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();

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
    .leftJoin(listings, eq(favorites.adId, listings.adId))
    .where(eq(favorites.userId, user.id));

  return NextResponse.json(rows.map(r => ({
    ...r,
    thumbnail: Array.isArray(r.images) && r.images.length > 0 ? r.images[0] : null,
    images: undefined,
  })));
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const { adId } = await request.json();

  const result = await db.insert(favorites).values({
    userId: user.id,
    adId,
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().returning();

  return NextResponse.json(result[0] ?? { adId }, { status: 201 });
}
