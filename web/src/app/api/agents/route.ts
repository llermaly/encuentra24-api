import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { ilike } from '@/db/sql-helpers';

export async function GET(request: NextRequest) {
  await requireUser();

  try {
    const params = request.nextUrl.searchParams;
    const view = params.get('view') || 'agencies';
    const search = params.get('search') || '';
    const location = params.get('location') || '';
    const sort = params.get('sort') || 'listings_desc';
    const page = Math.max(1, Number(params.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, Number(params.get('limit') || '25')));
    const offset = (page - 1) * limit;

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

    // Stats (always unfiltered)
    const statsResult = await db.all<{
      total_sellers: number;
      total_individual_agents: number;
      total_portfolio_value: number;
      avg_listings_per_seller: number;
    }>(sql.raw(`
      SELECT
        COUNT(DISTINCT seller_name) as total_sellers,
        COUNT(DISTINCT CASE WHEN agent_name IS NOT NULL AND agent_name != '' THEN agent_name END) as total_individual_agents,
        COALESCE(SUM(price), 0) as total_portfolio_value,
        CAST(COUNT(*) AS DOUBLE PRECISION) / GREATEST(COUNT(DISTINCT seller_name), 1) as avg_listings_per_seller
      FROM listings
      WHERE seller_name IS NOT NULL AND removed_at IS NULL
    `));
    const stats = statsResult[0];

    // CTE: compute primary area per seller
    const primaryAreaCte = `
      primary_areas AS (
        SELECT seller_name, location as primary_location FROM (
          SELECT seller_name, location,
            ROW_NUMBER() OVER (PARTITION BY seller_name ORDER BY COUNT(*) DESC) as rn
          FROM listings
          WHERE seller_name IS NOT NULL AND removed_at IS NULL AND location IS NOT NULL
          GROUP BY seller_name, location
        ) sub WHERE rn = 1
      )
    `;
    const locationJoin = 'JOIN primary_areas pa ON pa.seller_name = l.seller_name';
    const locationWhere = location
      ? `AND pa.primary_location = '${location.replace(/'/g, "''")}'`
      : '';

    if (view === 'agents') {
      const searchFilter = search ? `AND ${ilike('l.agent_name', search)}` : '';
      const [agentsData, countData] = await Promise.all([
        db.all<{
          name: string;
          agency: string;
          listing_count: number;
          portfolio_value: number;
          avg_price: number;
          primary_location: string | null;
        }>(sql.raw(`
          WITH ${primaryAreaCte}
          SELECT
            l.agent_name as name,
            l.seller_name as agency,
            COUNT(*) as listing_count,
            COALESCE(SUM(l.price), 0) as portfolio_value,
            COALESCE(AVG(l.price), 0) as avg_price,
            pa.primary_location
          FROM listings l
          ${locationJoin}
          WHERE l.agent_name IS NOT NULL AND l.agent_name != '' AND l.removed_at IS NULL
          ${searchFilter}
          ${locationWhere}
          GROUP BY l.agent_name, l.seller_name, pa.primary_location
          ORDER BY ${orderBy}
          LIMIT ${limit} OFFSET ${offset}
        `)),
        db.all<{ total: number }>(sql.raw(`
          WITH ${primaryAreaCte}
          SELECT COUNT(*) as total FROM (
            SELECT l.agent_name
            FROM listings l
            ${locationJoin}
            WHERE l.agent_name IS NOT NULL AND l.agent_name != '' AND l.removed_at IS NULL
            ${searchFilter}
            ${locationWhere}
            GROUP BY l.agent_name, l.seller_name
          ) sub
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
          primaryLocation: a.primary_location,
          rank: offset + i + 1,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    // Agencies view
    const searchFilter = search ? `AND ${ilike('l.seller_name', search)}` : '';
    const [agenciesData, countData, typesResult, locationsResult] = await Promise.all([
      db.all<{
        seller_name: string;
        seller_type: string | null;
        seller_verified: number | null;
        listing_count: number;
        portfolio_value: number;
        avg_price: number;
        agent_count: number;
        primary_location: string | null;
      }>(sql.raw(`
        WITH ${primaryAreaCte}
        SELECT
          l.seller_name,
          MAX(l.seller_type) as seller_type,
          MAX(CASE WHEN l.seller_verified THEN 1 ELSE 0 END) as seller_verified,
          COUNT(*) as listing_count,
          COALESCE(SUM(l.price), 0) as portfolio_value,
          COALESCE(AVG(l.price), 0) as avg_price,
          COUNT(DISTINCT CASE WHEN l.agent_name IS NOT NULL AND l.agent_name != '' THEN l.agent_name END) as agent_count,
          pa.primary_location
        FROM listings l
        ${locationJoin}
        WHERE l.seller_name IS NOT NULL AND l.removed_at IS NULL
        ${searchFilter}
        ${locationWhere}
        GROUP BY l.seller_name, pa.primary_location
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `)),
      db.all<{ total: number }>(sql.raw(`
        WITH ${primaryAreaCte}
        SELECT COUNT(*) as total FROM (
          SELECT l.seller_name
          FROM listings l
          ${locationJoin}
          WHERE l.seller_name IS NOT NULL AND l.removed_at IS NULL
          ${searchFilter}
          ${locationWhere}
          GROUP BY l.seller_name
        ) sub
      `)),
      db.all<{ seller_type: string; count: number }>(sql`
        SELECT seller_type, COUNT(DISTINCT seller_name) as count
        FROM listings
        WHERE seller_name IS NOT NULL AND seller_type IS NOT NULL AND removed_at IS NULL
        GROUP BY seller_type
        ORDER BY count DESC
      `),
      // Locations ranked by how many sellers have it as primary area
      db.all<{ location: string; count: number }>(sql.raw(`
        WITH ${primaryAreaCte}
        SELECT primary_location as location, COUNT(*) as count
        FROM primary_areas
        GROUP BY primary_location
        ORDER BY count DESC
      `)),
    ]);

    const total = countData[0]?.total || 0;

    // Enrich with seller contact data
    const names = agenciesData.map((a: any) => a.seller_name);
    let sellerMap = new Map<string, { whatsapp: string | null; phone: string | null; profile_url: string | null }>();

    if (names.length > 0) {
      const namePlaceholders = names.map(n => sql`${n}`);
      const sellerResults = await db.all<{
        name: string; whatsapp: string | null; phone: string | null; profile_url: string | null;
      }>(sql`
        SELECT name, whatsapp, phone, profile_url
        FROM sellers
        WHERE name IN (${sql.join(namePlaceholders, sql`, `)})
      `).catch(() => [] as any[]);

      sellerMap = new Map(sellerResults.map((s: any) => [s.name, s]));
    }

    return NextResponse.json({
      view: 'agencies',
      stats: {
        totalSellers: stats.total_sellers,
        totalIndividualAgents: stats.total_individual_agents,
        totalPortfolioValue: stats.total_portfolio_value,
        avgListingsPerSeller: Math.round(stats.avg_listings_per_seller * 10) / 10,
      },
      sellerTypes: typesResult.map((t: any) => ({ value: t.seller_type, count: t.count })),
      locations: locationsResult.map((l: any) => ({ value: l.location, count: Number(l.count) })),
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
          primaryLocation: a.primary_location,
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
