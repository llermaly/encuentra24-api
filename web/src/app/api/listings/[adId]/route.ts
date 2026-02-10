import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { listings, favorites, pipelineItems, priceHistory, propertyNotes, sellers } from '@/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const user = await requireUser();
  const { adId } = await params;

  const rows = await db
    .select({
      listing: listings,
      isFavorite: sql<number>`CASE WHEN ${favorites.id} IS NOT NULL THEN 1 ELSE 0 END`,
      pipelineStage: pipelineItems.stage,
      pipelineMovedAt: pipelineItems.movedAt,
      sellerWhatsapp: sellers.whatsapp,
    })
    .from(listings)
    .leftJoin(sellers, eq(listings.sellerId, sellers.id))
    .leftJoin(favorites, and(eq(listings.adId, favorites.adId), eq(favorites.userId, user.id)))
    .leftJoin(pipelineItems, and(eq(listings.adId, pipelineItems.adId), eq(pipelineItems.userId, user.id)))
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
    .where(and(eq(propertyNotes.adId, adId), eq(propertyNotes.userId, user.id)))
    .orderBy(desc(propertyNotes.createdAt));

  const whatsapp = row.sellerWhatsapp && row.sellerWhatsapp !== '50764261804'
    ? row.sellerWhatsapp
    : null;

  return NextResponse.json({
    ...row.listing,
    isFavorite: row.isFavorite === 1,
    pipelineStage: row.pipelineStage,
    pipelineMovedAt: row.pipelineMovedAt,
    sellerWhatsapp: whatsapp,
    priceHistory: prices,
    notes,
  });
}
