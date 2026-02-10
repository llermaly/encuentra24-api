import { db } from '@/db';
import { listings, favorites, pipelineItems, priceHistory, propertyNotes, sellers } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ListingDetail } from '@/components/listings/ListingDetail';
import { stackServerApp } from '@/stack';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ adId: string }>;
}) {
  const user = await stackServerApp.getUser({ or: 'redirect' });
  const { adId } = await params;

  const rows = await db
    .select({
      listing: listings,
      isFavorite: sql<number>`CASE WHEN ${favorites.id} IS NOT NULL THEN 1 ELSE 0 END`,
      pipelineStage: pipelineItems.stage,
      sellerWhatsapp: sellers.whatsapp,
    })
    .from(listings)
    .leftJoin(sellers, eq(listings.sellerId, sellers.id))
    .leftJoin(favorites, and(eq(listings.adId, favorites.adId), eq(favorites.userId, user.id)))
    .leftJoin(pipelineItems, and(eq(listings.adId, pipelineItems.adId), eq(pipelineItems.userId, user.id)))
    .where(eq(listings.adId, adId))
    .limit(1);

  if (rows.length === 0) notFound();

  const row = rows[0];

  const [prices, notes] = await Promise.all([
    db.select().from(priceHistory).where(eq(priceHistory.adId, adId)).orderBy(desc(priceHistory.recordedAt)),
    db.select().from(propertyNotes).where(and(eq(propertyNotes.adId, adId), eq(propertyNotes.userId, user.id))).orderBy(desc(propertyNotes.createdAt)),
  ]);

  return (
    <ListingDetail
      listing={{
        ...row.listing,
        isFavorite: row.isFavorite === 1,
        pipelineStage: row.pipelineStage ?? null,
        sellerWhatsapp: row.sellerWhatsapp && row.sellerWhatsapp !== '50764261804' ? row.sellerWhatsapp : null,
      }}
      priceHistory={prices}
      notes={notes}
    />
  );
}
