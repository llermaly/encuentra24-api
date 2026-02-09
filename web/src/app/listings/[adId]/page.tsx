import { db } from '@/db';
import { listings, favorites, pipelineItems, priceHistory, propertyNotes } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ListingDetail } from '@/components/listings/ListingDetail';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ adId: string }>;
}) {
  const { adId } = await params;

  const rows = await db
    .select({
      listing: listings,
      isFavorite: sql<number>`CASE WHEN ${favorites.id} IS NOT NULL THEN 1 ELSE 0 END`,
      pipelineStage: pipelineItems.stage,
    })
    .from(listings)
    .leftJoin(favorites, eq(listings.adId, favorites.adId))
    .leftJoin(pipelineItems, eq(listings.adId, pipelineItems.adId))
    .where(eq(listings.adId, adId))
    .limit(1);

  if (rows.length === 0) notFound();

  const row = rows[0];

  const [prices, notes] = await Promise.all([
    db.select().from(priceHistory).where(eq(priceHistory.adId, adId)).orderBy(desc(priceHistory.recordedAt)),
    db.select().from(propertyNotes).where(eq(propertyNotes.adId, adId)).orderBy(desc(propertyNotes.createdAt)),
  ]);

  return (
    <ListingDetail
      listing={{
        ...row.listing,
        isFavorite: row.isFavorite === 1,
        pipelineStage: row.pipelineStage ?? null,
      }}
      priceHistory={prices}
      notes={notes}
    />
  );
}
