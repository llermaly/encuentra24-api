import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pipelineItems, listings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();

  const rows = await db
    .select({
      adId: pipelineItems.adId,
      stage: pipelineItems.stage,
      position: pipelineItems.position,
      movedAt: pipelineItems.movedAt,
      createdAt: pipelineItems.createdAt,
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
    .from(pipelineItems)
    .leftJoin(listings, eq(pipelineItems.adId, listings.adId))
    .where(eq(pipelineItems.userId, user.id));

  return NextResponse.json(rows.map(r => ({
    ...r,
    thumbnail: Array.isArray(r.images) && r.images.length > 0 ? r.images[0] : null,
    images: undefined,
  })));
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const { adId, stage = 'discovered' } = await request.json();
  const now = new Date().toISOString();

  const result = await db.insert(pipelineItems).values({
    userId: user.id,
    adId,
    stage,
    position: 0,
    movedAt: now,
    createdAt: now,
  }).onConflictDoNothing().returning();

  return NextResponse.json(result[0] ?? { adId, stage }, { status: 201 });
}
