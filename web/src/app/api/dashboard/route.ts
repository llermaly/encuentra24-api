import { NextResponse } from 'next/server';
import { db } from '@/db';
import { listings, pipelineItems, crawlRuns, favorites } from '@/db/schema';
import { sql, desc, gte, eq, and, isNotNull } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalResult, todayResult, weekResult, favoritesResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(listings),
    db.select({ count: sql<number>`count(*)` }).from(listings).where(gte(listings.firstSeenAt, todayStart)),
    db.select({ count: sql<number>`count(*)` }).from(listings).where(gte(listings.firstSeenAt, weekAgo)),
    db.select({ count: sql<number>`count(*)` }).from(favorites).where(eq(favorites.userId, user.id)),
  ]);

  // Listings with real price drops: old_price set by detail crawler from the actual listing page
  const priceDrops = await db
    .select({
      adId: listings.adId,
      price: listings.oldPrice,
      currentPrice: listings.price,
      recordedAt: listings.updatedAt,
      title: listings.title,
      location: listings.location,
      images: listings.images,
    })
    .from(listings)
    .where(and(
      isNotNull(listings.oldPrice),
      sql`${listings.oldPrice} != ${listings.price}`,
      gte(listings.updatedAt, weekAgo),
    ))
    .orderBy(desc(listings.updatedAt))
    .limit(20);

  const pipelineCounts = await db
    .select({
      stage: pipelineItems.stage,
      count: sql<number>`count(*)`,
    })
    .from(pipelineItems)
    .where(eq(pipelineItems.userId, user.id))
    .groupBy(pipelineItems.stage);

  const lastCrawl = await db
    .select()
    .from(crawlRuns)
    .orderBy(desc(crawlRuns.startedAt))
    .limit(1);

  return NextResponse.json({
    stats: {
      totalListings: totalResult[0].count,
      newToday: todayResult[0].count,
      newThisWeek: weekResult[0].count,
      totalFavorites: favoritesResult[0].count,
    },
    recentPriceDrops: priceDrops.map((p: any) => ({
      ...p,
      thumbnail: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null,
      images: undefined,
    })),
    pipelineSummary: Object.fromEntries(pipelineCounts.map((r: any) => [r.stage, r.count])),
    lastCrawl: lastCrawl[0] ?? null,
  });
}
