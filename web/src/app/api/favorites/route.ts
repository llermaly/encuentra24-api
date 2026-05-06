import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { favorites, listings, pipelineItems } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

interface FavoriteRow {
  adId: string;
  favoritedAt: string;
  slug: string | null;
  url: string | null;
  category: string | null;
  subcategory: string | null;
  title: string | null;
  price: number | null;
  currency: string | null;
  oldPrice: number | null;
  province: string | null;
  city: string | null;
  location: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  builtAreaSqm: number | null;
  landAreaSqm: number | null;
  images: unknown;
  imageCount: number | null;
  sellerName: string | null;
  agentName: string | null;
  sellerVerified: boolean | null;
  featureLevel: string | null;
  favoritesCount: number | null;
  publishedAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  removedAt: string | null;
  pipelineStage: string | null;
}

export async function GET() {
  const user = await requireUser();

  const rows = await db
    .select({
      adId: favorites.adId,
      favoritedAt: favorites.createdAt,
      slug: listings.slug,
      url: listings.url,
      category: listings.category,
      subcategory: listings.subcategory,
      title: listings.title,
      price: listings.price,
      currency: listings.currency,
      oldPrice: listings.oldPrice,
      province: listings.province,
      city: listings.city,
      location: listings.location,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      parking: listings.parking,
      builtAreaSqm: listings.builtAreaSqm,
      landAreaSqm: listings.landAreaSqm,
      images: listings.images,
      imageCount: listings.imageCount,
      sellerName: listings.sellerName,
      agentName: listings.agentName,
      sellerVerified: listings.sellerVerified,
      featureLevel: listings.featureLevel,
      favoritesCount: listings.favoritesCount,
      publishedAt: listings.publishedAt,
      firstSeenAt: listings.firstSeenAt,
      lastSeenAt: listings.lastSeenAt,
      removedAt: listings.removedAt,
      pipelineStage: pipelineItems.stage,
    })
    .from(favorites)
    .leftJoin(listings, eq(favorites.adId, listings.adId))
    .leftJoin(pipelineItems, and(eq(favorites.adId, pipelineItems.adId), eq(pipelineItems.userId, user.id)))
    .where(eq(favorites.userId, user.id))
    .orderBy(desc(favorites.createdAt));

  return NextResponse.json(rows.map((r: FavoriteRow) => ({
    ...r,
    isFavorite: true,
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
