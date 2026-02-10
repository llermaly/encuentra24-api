import { NextResponse } from 'next/server';
import { db } from '@/db';
import { listings, priceHistory, pipelineItems, crawlRuns, favorites } from '@/db/schema';
import { sql, desc, gte, eq, and } from 'drizzle-orm';
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

  const priceDrops = await db
    .select({
      adId: priceHistory.adId,
      price: priceHistory.price,
      recordedAt: priceHistory.recordedAt,
      title: listings.title,
      currentPrice: listings.price,
      location: listings.location,
      images: listings.images,
    })
    .from(priceHistory)
    .leftJoin(listings, eq(priceHistory.adId, listings.adId))
    .where(gte(priceHistory.recordedAt, weekAgo))
    .orderBy(desc(priceHistory.recordedAt))
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
    recentPriceDrops: priceDrops.map(p => ({
      ...p,
      thumbnail: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null,
      images: undefined,
    })),
    pipelineSummary: Object.fromEntries(pipelineCounts.map(r => [r.stage, r.count])),
    lastCrawl: lastCrawl[0] ?? null,
  });
}
