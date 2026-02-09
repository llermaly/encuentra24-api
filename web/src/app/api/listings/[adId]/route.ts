import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { listings, favorites, pipelineItems, priceHistory, propertyNotes } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const { adId } = await params;

  const rows = await db
    .select({
      listing: listings,
      isFavorite: sql<number>`CASE WHEN ${favorites.id} IS NOT NULL THEN 1 ELSE 0 END`,
      pipelineStage: pipelineItems.stage,
      pipelineMovedAt: pipelineItems.movedAt,
    })
    .from(listings)
    .leftJoin(favorites, eq(listings.adId, favorites.adId))
    .leftJoin(pipelineItems, eq(listings.adId, pipelineItems.adId))
    .where(eq(listings.adId, adId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const row = rows[0];

  const prices = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.adId, adId))
    .orderBy(desc(priceHistory.recordedAt));

  const notes = await db
    .select()
    .from(propertyNotes)
    .where(eq(propertyNotes.adId, adId))
    .orderBy(desc(propertyNotes.createdAt));

  return NextResponse.json({
    ...row.listing,
    isFavorite: row.isFavorite === 1,
    pipelineStage: row.pipelineStage,
    pipelineMovedAt: row.pipelineMovedAt,
    priceHistory: prices,
    notes,
  });
}
