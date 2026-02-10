import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { listings } from '@/db/schema';
import { sql, eq, and, isNull, isNotNull } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  await requireUser();

  try {
  const { name } = await params;
  const sellerName = decodeURIComponent(name);

  const listingsPage = Math.max(1, Number(request.nextUrl.searchParams.get('listingsPage') || '1'));
  const listingsLimit = 24;
  const listingsOffset = (listingsPage - 1) * listingsLimit;

  const activeCond = and(eq(listings.sellerName, sellerName), isNull(listings.removedAt));
  const allCond = eq(listings.sellerName, sellerName);

  // All queries in parallel
  const [
    profileResult,
    metricsResult,
    categorySplit,
    subcategorySplit,
    priceRanges,
    pricingVsMarket,
    pricePerSqmVsMarket,
    priceDropStats,
    rankResult,
    areaPositions,
    competitors,
    qualityResult,
    domDistribution,
    agencyAgents,
    inventoryStatus,
    geoListings,
    agentListings,
    listingsTotal,
  ] = await Promise.all([
    // 1. Profile info
    db.all<{
      seller_name: string | null;
      seller_type: string | null;
      seller_verified: number | null;
      first_seen: string | null;
      total_listings: number;
    }>(sql`
      SELECT
        seller_name, seller_type,
        MAX(seller_verified) as seller_verified,
        MIN(first_seen_at) as first_seen,
        COUNT(*) as total_listings
      FROM listings
      WHERE seller_name = ${sellerName} AND removed_at IS NULL
    `),

    // 2. Key metrics
    db.all<{
      total: number; active: number; portfolio_value: number;
      avg_price: number; avg_price_sqm: number; total_favorites: number;
    }>(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN removed_at IS NULL THEN 1 END) as active,
        COALESCE(SUM(CASE WHEN removed_at IS NULL THEN price ELSE 0 END), 0) as portfolio_value,
        COALESCE(AVG(CASE WHEN removed_at IS NULL THEN price END), 0) as avg_price,
        COALESCE(AVG(CASE WHEN removed_at IS NULL AND price_per_sqm_construction IS NOT NULL THEN price_per_sqm_construction END), 0) as avg_price_sqm,
        COALESCE(SUM(CASE WHEN removed_at IS NULL THEN favorites_count ELSE 0 END), 0) as total_favorites
      FROM listings WHERE seller_name = ${sellerName}
    `),

    // 3. Category split
    db.all<{ category: string; count: number }>(sql`
      SELECT category, COUNT(*) as count FROM listings
      WHERE seller_name = ${sellerName} AND removed_at IS NULL
      GROUP BY category
    `),

    // 4. Subcategory split
    db.all<{ subcategory: string; count: number }>(sql`
      SELECT subcategory, COUNT(*) as count FROM listings
      WHERE seller_name = ${sellerName} AND removed_at IS NULL
      GROUP BY subcategory ORDER BY count DESC
    `),

    // 5. Price range distribution
    db.all<{ range_label: string; count: number; sort_order: number }>(sql`
      SELECT
        CASE
          WHEN ${listings.price} < 100000 THEN '<$100K'
          WHEN ${listings.price} < 200000 THEN '$100-200K'
          WHEN ${listings.price} < 300000 THEN '$200-300K'
          WHEN ${listings.price} < 500000 THEN '$300-500K'
          WHEN ${listings.price} < 1000000 THEN '$500K-1M'
          ELSE '$1M+'
        END as range_label,
        CASE
          WHEN ${listings.price} < 100000 THEN 1
          WHEN ${listings.price} < 200000 THEN 2
          WHEN ${listings.price} < 300000 THEN 3
          WHEN ${listings.price} < 500000 THEN 4
          WHEN ${listings.price} < 1000000 THEN 5
          ELSE 6
        END as sort_order,
        COUNT(*) as count
      FROM ${listings}
      WHERE ${listings.sellerName} = ${sellerName} AND ${listings.removedAt} IS NULL AND ${listings.price} IS NOT NULL
      GROUP BY range_label
      ORDER BY sort_order
    `),

    // 6. Pricing vs market (by subcategory)
    db.all<{ subcategory: string; agent_avg: number; market_avg: number }>(sql`
      SELECT
        a.subcategory,
        a.agent_avg,
        m.market_avg
      FROM (
        SELECT ${listings.subcategory} as subcategory, AVG(${listings.price}) as agent_avg
        FROM ${listings}
        WHERE ${listings.sellerName} = ${sellerName} AND ${listings.removedAt} IS NULL AND ${listings.price} IS NOT NULL
        GROUP BY ${listings.subcategory}
      ) a
      JOIN (
        SELECT ${listings.subcategory} as subcategory, AVG(${listings.price}) as market_avg
        FROM ${listings}
        WHERE ${listings.removedAt} IS NULL AND ${listings.price} IS NOT NULL
        GROUP BY ${listings.subcategory}
      ) m ON a.subcategory = m.subcategory
    `),

    // 7. Price per sqm vs market
    db.all<{ subcategory: string; agent_avg: number; market_avg: number }>(sql`
      SELECT
        a.subcategory,
        a.agent_avg,
        m.market_avg
      FROM (
        SELECT ${listings.subcategory} as subcategory, AVG(${listings.pricePerSqmConstruction}) as agent_avg
        FROM ${listings}
        WHERE ${listings.sellerName} = ${sellerName} AND ${listings.removedAt} IS NULL AND ${listings.pricePerSqmConstruction} IS NOT NULL
        GROUP BY ${listings.subcategory}
      ) a
      JOIN (
        SELECT ${listings.subcategory} as subcategory, AVG(${listings.pricePerSqmConstruction}) as market_avg
        FROM ${listings}
        WHERE ${listings.removedAt} IS NULL AND ${listings.pricePerSqmConstruction} IS NOT NULL
        GROUP BY ${listings.subcategory}
      ) m ON a.subcategory = m.subcategory
    `),

    // 8. Price drop stats
    db.all<{ drop_count: number; avg_drop_pct: number }>(sql`
      SELECT
        COUNT(*) as drop_count,
        COALESCE(AVG(
          CASE WHEN old_price > price
          THEN ((old_price - price) / old_price) * 100
          END
        ), 0) as avg_drop_pct
      FROM listings
      WHERE seller_name = ${sellerName} AND removed_at IS NULL AND old_price IS NOT NULL AND old_price > price
    `),

    // 9. Market rank
    db.all<{ rank: number; total_sellers: number }>(sql`
      SELECT rank, total_sellers FROM (
        SELECT
          seller_name,
          RANK() OVER (ORDER BY COUNT(*) DESC) as rank,
          (SELECT COUNT(DISTINCT seller_name) FROM listings WHERE seller_name IS NOT NULL AND removed_at IS NULL) as total_sellers
        FROM listings
        WHERE seller_name IS NOT NULL AND removed_at IS NULL
        GROUP BY seller_name
      ) WHERE seller_name = ${sellerName}
    `),

    // 10. Area positions
    db.all<{ location: string; rank: number; market_share: number; listing_count: number }>(sql`
      SELECT
        location,
        rank,
        ROUND(CAST(listing_count AS REAL) / total_in_area * 100, 1) as market_share,
        listing_count
      FROM (
        SELECT
          location,
          COUNT(*) as listing_count,
          (SELECT COUNT(*) FROM listings l2 WHERE l2.location = listings.location AND l2.removed_at IS NULL) as total_in_area,
          RANK() OVER (
            PARTITION BY location
            ORDER BY COUNT(*) DESC
          ) as rank
        FROM listings
        WHERE seller_name = ${sellerName} AND removed_at IS NULL AND location IS NOT NULL
        GROUP BY location
      )
      ORDER BY listing_count DESC
      LIMIT 10
    `),

    // 11. Top competitors
    db.all<{ name: string; overlap_listings: number; avg_price: number }>(sql`
      SELECT
        l2.seller_name as name,
        COUNT(*) as overlap_listings,
        COALESCE(AVG(l2.price), 0) as avg_price
      FROM listings l1
      JOIN listings l2 ON l2.location = l1.location AND l2.seller_name != l1.seller_name AND l2.removed_at IS NULL
      WHERE l1.seller_name = ${sellerName} AND l1.removed_at IS NULL AND l2.seller_name IS NOT NULL
      GROUP BY l2.seller_name
      ORDER BY overlap_listings DESC
      LIMIT 5
    `),

    // 12. Quality score components
    db.all<{
      avg_favorites: number;
      max_market_favorites: number;
      pct_premium: number;
      avg_images: number;
      pct_complete: number;
    }>(sql`
      SELECT
        COALESCE(AVG(favorites_count), 0) as avg_favorites,
        (SELECT COALESCE(MAX(avg_fav), 1) FROM (SELECT AVG(favorites_count) as avg_fav FROM listings WHERE seller_name IS NOT NULL AND removed_at IS NULL GROUP BY seller_name)) as max_market_favorites,
        COALESCE(SUM(CASE WHEN feature_level IN ('premium', 'featured') THEN 1 ELSE 0 END) * 100.0 / MAX(COUNT(*), 1), 0) as pct_premium,
        COALESCE(AVG(image_count), 0) as avg_images,
        COALESCE(
          SUM(CASE WHEN bedrooms IS NOT NULL AND bathrooms IS NOT NULL AND (built_area_sqm IS NOT NULL OR land_area_sqm IS NOT NULL) AND description IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / MAX(COUNT(*), 1),
          0
        ) as pct_complete
      FROM listings
      WHERE seller_name = ${sellerName} AND removed_at IS NULL
    `),

    // 13. Days-on-market distribution
    db.all<{ bucket: string; count: number; sort_order: number }>(sql`
      SELECT
        CASE
          WHEN julianday('now') - julianday(${listings.publishedAt}) < 7 THEN '<7 days'
          WHEN julianday('now') - julianday(${listings.publishedAt}) < 30 THEN '7-30 days'
          WHEN julianday('now') - julianday(${listings.publishedAt}) < 90 THEN '30-90 days'
          ELSE '90+ days'
        END as bucket,
        CASE
          WHEN julianday('now') - julianday(${listings.publishedAt}) < 7 THEN 1
          WHEN julianday('now') - julianday(${listings.publishedAt}) < 30 THEN 2
          WHEN julianday('now') - julianday(${listings.publishedAt}) < 90 THEN 3
          ELSE 4
        END as sort_order,
        COUNT(*) as count
      FROM ${listings}
      WHERE ${listings.sellerName} = ${sellerName} AND ${listings.removedAt} IS NULL AND ${listings.publishedAt} IS NOT NULL
      GROUP BY bucket
      ORDER BY sort_order
    `),

    // 14a. Individual agents within this agency
    db.all<{ agent_name: string; listing_count: number; portfolio_value: number; avg_price: number }>(sql`
      SELECT
        agent_name,
        COUNT(*) as listing_count,
        COALESCE(SUM(price), 0) as portfolio_value,
        COALESCE(AVG(price), 0) as avg_price
      FROM listings
      WHERE seller_name = ${sellerName} AND removed_at IS NULL
        AND agent_name IS NOT NULL AND agent_name != ''
      GROUP BY agent_name
      ORDER BY listing_count DESC
    `),

    // 14. Inventory status counts
    db.select({
      active: sql<number>`COUNT(CASE WHEN ${listings.removedAt} IS NULL THEN 1 END)`,
      stale: sql<number>`COUNT(CASE WHEN ${listings.removedAt} IS NULL AND ${listings.publishedAt} IS NOT NULL AND julianday('now') - julianday(${listings.publishedAt}) > 30 THEN 1 END)`,
      removed: sql<number>`COUNT(CASE WHEN ${listings.removedAt} IS NOT NULL THEN 1 END)`,
      avgDom: sql<number>`COALESCE(AVG(CASE WHEN ${listings.removedAt} IS NULL AND ${listings.publishedAt} IS NOT NULL THEN julianday('now') - julianday(${listings.publishedAt}) END), 0)`,
    }).from(listings).where(allCond),

    // 15. Geographic listings (for map)
    db.select({
      adId: listings.adId,
      title: listings.title,
      price: listings.price,
      currency: listings.currency,
      latitude: listings.latitude,
      longitude: listings.longitude,
      location: listings.location,
    }).from(listings).where(and(
      eq(listings.sellerName, sellerName),
      isNull(listings.removedAt),
      isNotNull(listings.latitude),
      isNotNull(listings.longitude),
    )),

    // 16. Paginated listings for table
    db.select({
      adId: listings.adId,
      title: listings.title,
      price: listings.price,
      currency: listings.currency,
      location: listings.location,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      builtAreaSqm: listings.builtAreaSqm,
      publishedAt: listings.publishedAt,
      favoritesCount: listings.favoritesCount,
      images: listings.images,
      subcategory: listings.subcategory,
      category: listings.category,
    }).from(listings).where(activeCond).orderBy(sql`${listings.publishedAt} DESC`).limit(listingsLimit).offset(listingsOffset),

    // 17. Total listings count for pagination
    db.select({ total: sql<number>`COUNT(*)` }).from(listings).where(activeCond),
  ]);

  const profile = profileResult[0];
  if (!profile || !profile.total_listings) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const metrics = metricsResult[0] || { total: 0, active: 0, portfolio_value: 0, avg_price: 0, avg_price_sqm: 0, total_favorites: 0 };
  const rank = rankResult[0];
  const quality = qualityResult[0] || { avg_favorites: 0, max_market_favorites: 1, pct_premium: 0, avg_images: 0, pct_complete: 0 };
  const inventory = inventoryStatus[0] || { active: 0, stale: 0, removed: 0, avgDom: 0 };
  const drops = priceDropStats[0] || { drop_count: 0, avg_drop_pct: 0 };
  const totalListingsCount = listingsTotal[0]?.total || 0;

  // Compute quality score (0-100 composite)
  const engagementScore = Math.min(100, (quality.avg_favorites / Math.max(quality.max_market_favorites, 1)) * 100);
  const visibilityScore = Math.min(100, quality.pct_premium);
  const presentationScore = Math.min(100, (quality.avg_images / 20) * 100);
  const completenessScore = quality.pct_complete;
  const compositeScore = Math.round(
    (engagementScore * 0.25 + visibilityScore * 0.2 + presentationScore * 0.25 + completenessScore * 0.3)
  );

  // Try to fetch seller contact data
  let whatsapp: string | null = null;
  let phone: string | null = null;
  let profileUrl: string | null = null;
  try {
    const sellerResults = await db.all<{
      whatsapp: string | null;
      phone: string | null;
      profile_url: string | null;
    }>(sql`SELECT whatsapp, phone, profile_url FROM sellers WHERE name = ${sellerName} LIMIT 1`);
    if (sellerResults[0]) {
      whatsapp = sellerResults[0].whatsapp;
      phone = sellerResults[0].phone;
      profileUrl = sellerResults[0].profile_url;
    }
  } catch {
    // sellers table doesn't exist
  }

  return NextResponse.json({
    profile: {
      name: profile.seller_name,
      type: profile.seller_type,
      verified: Boolean(profile.seller_verified),
      whatsapp,
      phone,
      profileUrl,
      activeSince: profile.first_seen,
      totalListings: profile.total_listings,
    },
    metrics: {
      total: metrics.total,
      active: metrics.active,
      portfolioValue: metrics.portfolio_value,
      avgPrice: Math.round(metrics.avg_price),
      avgPriceSqm: Math.round(metrics.avg_price_sqm),
      totalFavorites: metrics.total_favorites,
      rank: rank?.rank || null,
      totalSellers: rank?.total_sellers || null,
    },
    portfolio: {
      categorySplit: categorySplit.map(r => ({ name: r.category, value: r.count })),
      subcategorySplit: subcategorySplit.map(r => ({ name: r.subcategory, value: r.count })),
      priceRanges: priceRanges.map(r => ({ range: r.range_label, count: r.count })),
    },
    pricing: {
      vsMarket: pricingVsMarket.map(r => ({
        subcategory: r.subcategory,
        agentAvg: Math.round(r.agent_avg),
        marketAvg: Math.round(r.market_avg),
      })),
      vsMarketSqm: pricePerSqmVsMarket.map(r => ({
        subcategory: r.subcategory,
        agentAvg: Math.round(r.agent_avg),
        marketAvg: Math.round(r.market_avg),
      })),
      priceDrops: {
        count: drops.drop_count,
        avgPct: Math.round(drops.avg_drop_pct * 10) / 10,
      },
    },
    position: {
      rank: rank?.rank || null,
      totalSellers: rank?.total_sellers || null,
      areaPositions: areaPositions.map(r => ({
        location: r.location,
        rank: r.rank,
        marketShare: r.market_share,
        listingCount: r.listing_count,
      })),
      competitors: competitors.map(r => ({
        name: r.name,
        overlapListings: r.overlap_listings,
        avgPrice: Math.round(r.avg_price),
      })),
    },
    quality: {
      composite: compositeScore,
      engagement: Math.round(engagementScore),
      visibility: Math.round(visibilityScore),
      presentation: Math.round(presentationScore),
      completeness: Math.round(completenessScore),
      raw: {
        avgFavorites: Math.round(quality.avg_favorites * 10) / 10,
        pctPremium: Math.round(quality.pct_premium * 10) / 10,
        avgImages: Math.round(quality.avg_images * 10) / 10,
        pctComplete: Math.round(quality.pct_complete * 10) / 10,
      },
    },
    agents: agencyAgents.map(a => ({
      name: a.agent_name,
      listingCount: a.listing_count,
      portfolioValue: a.portfolio_value,
      avgPrice: Math.round(a.avg_price),
    })),
    inventory: {
      domDistribution: domDistribution.map(r => ({ bucket: r.bucket, count: r.count })),
      active: inventory.active,
      stale: inventory.stale,
      removed: inventory.removed,
      avgDom: Math.round(inventory.avgDom),
    },
    geo: geoListings.map(r => ({
      adId: r.adId,
      title: r.title,
      price: r.price,
      currency: r.currency,
      lat: r.latitude,
      lng: r.longitude,
      location: r.location,
    })),
    listings: {
      data: agentListings.map(r => {
        let thumbnail: string | null = null;
        try {
          const imgs = r.images;
          thumbnail = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
        } catch {}
        return {
          adId: r.adId,
          title: r.title,
          price: r.price,
          currency: r.currency,
          location: r.location,
          bedrooms: r.bedrooms,
          bathrooms: r.bathrooms,
          area: r.builtAreaSqm,
          publishedAt: r.publishedAt,
          favorites: r.favoritesCount,
          thumbnail,
          subcategory: r.subcategory,
          category: r.category,
        };
      }),
      pagination: {
        page: listingsPage,
        limit: listingsLimit,
        total: totalListingsCount,
        totalPages: Math.ceil(totalListingsCount / listingsLimit),
      },
    },
  });
  } catch (e) {
    console.error('[/api/agents/[name]] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
