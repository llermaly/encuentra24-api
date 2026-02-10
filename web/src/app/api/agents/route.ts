import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  await requireUser();

  try {
    const params = request.nextUrl.searchParams;
    const view = params.get('view') || 'agencies'; // 'agencies' or 'agents'
    const search = params.get('search') || '';
    const sort = params.get('sort') || 'listings_desc';
    const page = Math.max(1, Number(params.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, Number(params.get('limit') || '25')));
    const offset = (page - 1) * limit;

    // Sort mapping per view
    const agencySortMap: Record<string, string> = {
      listings_desc: 'listing_count DESC',
      listings_asc: 'listing_count ASC',
      value_desc: 'portfolio_value DESC',
      value_asc: 'portfolio_value ASC',
      avg_price_desc: 'avg_price DESC',
      avg_price_asc: 'avg_price ASC',
      name_asc: 'seller_name ASC',
      name_desc: 'seller_name DESC',
    };
    const agentSortMap: Record<string, string> = {
      ...agencySortMap,
      name_asc: 'name ASC',
      name_desc: 'name DESC',
    };
    const orderBy = (view === 'agents' ? agentSortMap : agencySortMap)[sort] || 'listing_count DESC';

    // Stats query (always unfiltered, always by seller_name)
    const statsResult = await db.all<{
      total_sellers: number;
      total_individual_agents: number;
      total_portfolio_value: number;
      avg_listings_per_seller: number;
    }>(sql`
      SELECT
        COUNT(DISTINCT seller_name) as total_sellers,
        COUNT(DISTINCT CASE WHEN agent_name IS NOT NULL AND agent_name != '' THEN agent_name END) as total_individual_agents,
        COALESCE(SUM(price), 0) as total_portfolio_value,
        CAST(COUNT(*) AS REAL) / MAX(COUNT(DISTINCT seller_name), 1) as avg_listings_per_seller
      FROM listings
      WHERE seller_name IS NOT NULL AND removed_at IS NULL
    `);
    const stats = statsResult[0];

    if (view === 'agents') {
      // Individual agents view — group by agent_name, show agency (seller_name)
      const [agentsData, countData] = await Promise.all([
        db.all<{
          name: string;
          agency: string;
          listing_count: number;
          portfolio_value: number;
          avg_price: number;
        }>(sql.raw(`
          SELECT
            agent_name as name,
            seller_name as agency,
            COUNT(*) as listing_count,
            COALESCE(SUM(price), 0) as portfolio_value,
            COALESCE(AVG(price), 0) as avg_price
          FROM listings
          WHERE agent_name IS NOT NULL AND agent_name != '' AND removed_at IS NULL
          ${search ? `AND agent_name LIKE '%${search.replace(/'/g, "''")}%'` : ''}
          GROUP BY agent_name, seller_name
          ORDER BY ${orderBy}
          LIMIT ${limit} OFFSET ${offset}
        `)),
        db.all<{ total: number }>(sql.raw(`
          SELECT COUNT(*) as total FROM (
            SELECT agent_name
            FROM listings
            WHERE agent_name IS NOT NULL AND agent_name != '' AND removed_at IS NULL
            ${search ? `AND agent_name LIKE '%${search.replace(/'/g, "''")}%'` : ''}
            GROUP BY agent_name, seller_name
          )
        `)),
      ]);

      const total = countData[0]?.total || 0;

      return NextResponse.json({
        view: 'agents',
        stats: {
          totalSellers: stats.total_sellers,
          totalIndividualAgents: stats.total_individual_agents,
          totalPortfolioValue: stats.total_portfolio_value,
          avgListingsPerSeller: Math.round(stats.avg_listings_per_seller * 10) / 10,
        },
        data: agentsData.map((a, i) => ({
          name: a.name,
          agency: a.agency,
          listingCount: a.listing_count,
          portfolioValue: a.portfolio_value,
          avgPrice: Math.round(a.avg_price),
          rank: offset + i + 1,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    // Agencies view (default) — group by seller_name
    const [agenciesData, countData, typesResult] = await Promise.all([
      db.all<{
        seller_name: string;
        seller_type: string | null;
        seller_verified: number | null;
        listing_count: number;
        portfolio_value: number;
        avg_price: number;
        agent_count: number;
      }>(sql.raw(`
        SELECT
          seller_name,
          seller_type,
          MAX(seller_verified) as seller_verified,
          COUNT(*) as listing_count,
          COALESCE(SUM(price), 0) as portfolio_value,
          COALESCE(AVG(price), 0) as avg_price,
          COUNT(DISTINCT CASE WHEN agent_name IS NOT NULL AND agent_name != '' THEN agent_name END) as agent_count
        FROM listings
        WHERE seller_name IS NOT NULL AND removed_at IS NULL
        ${search ? `AND seller_name LIKE '%${search.replace(/'/g, "''")}%'` : ''}
        GROUP BY seller_name
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `)),
      db.all<{ total: number }>(sql.raw(`
        SELECT COUNT(*) as total FROM (
          SELECT seller_name
          FROM listings
          WHERE seller_name IS NOT NULL AND removed_at IS NULL
          ${search ? `AND seller_name LIKE '%${search.replace(/'/g, "''")}%'` : ''}
          GROUP BY seller_name
        )
      `)),
      db.all<{ seller_type: string; count: number }>(sql`
        SELECT seller_type, COUNT(DISTINCT seller_name) as count
        FROM listings
        WHERE seller_name IS NOT NULL AND seller_type IS NOT NULL AND removed_at IS NULL
        GROUP BY seller_type
        ORDER BY count DESC
      `),
    ]);

    const total = countData[0]?.total || 0;

    // Enrich with primary location + seller contact data
    const names = agenciesData.map(a => a.seller_name);
    let locMap = new Map<string, string>();
    let sellerMap = new Map<string, { whatsapp: string | null; phone: string | null; profile_url: string | null }>();

    if (names.length > 0) {
      const namePlaceholders = names.map(n => sql`${n}`);
      const [locResults, sellerResults] = await Promise.all([
        db.all<{ seller_name: string; location: string; cnt: number }>(sql`
          SELECT seller_name, location, COUNT(*) as cnt
          FROM listings
          WHERE seller_name IN (${sql.join(namePlaceholders, sql`, `)}) AND location IS NOT NULL AND removed_at IS NULL
          GROUP BY seller_name, location
          ORDER BY seller_name, cnt DESC
        `),
        db.all<{ name: string; whatsapp: string | null; phone: string | null; profile_url: string | null }>(sql`
          SELECT name, whatsapp, phone, profile_url
          FROM sellers
          WHERE name IN (${sql.join(namePlaceholders, sql`, `)})
        `).catch(() => [] as { name: string; whatsapp: string | null; phone: string | null; profile_url: string | null }[]),
      ]);

      for (const row of locResults) {
        if (!locMap.has(row.seller_name)) locMap.set(row.seller_name, row.location);
      }
      sellerMap = new Map(sellerResults.map(s => [s.name, s]));
    }

    return NextResponse.json({
      view: 'agencies',
      stats: {
        totalSellers: stats.total_sellers,
        totalIndividualAgents: stats.total_individual_agents,
        totalPortfolioValue: stats.total_portfolio_value,
        avgListingsPerSeller: Math.round(stats.avg_listings_per_seller * 10) / 10,
      },
      sellerTypes: typesResult.map(t => ({ value: t.seller_type, count: t.count })),
      data: agenciesData.map((a, i) => {
        const seller = sellerMap.get(a.seller_name);
        return {
          name: a.seller_name,
          type: a.seller_type,
          verified: Boolean(a.seller_verified),
          listingCount: a.listing_count,
          portfolioValue: a.portfolio_value,
          avgPrice: Math.round(a.avg_price),
          agentCount: a.agent_count,
          primaryLocation: locMap.get(a.seller_name) || null,
          whatsapp: seller?.whatsapp || null,
          phone: seller?.phone || null,
          profileUrl: seller?.profile_url || null,
          rank: offset + i + 1,
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error('[/api/agents] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
