import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

type FacetRow = {
  facet: 'categories' | 'provinces' | 'cities' | 'locations';
  category: string | null;
  subcategory: string | null;
  province: string | null;
  city: string | null;
  location: string | null;
  count: number;
};

export async function GET() {
  const facetRows = await db.all<FacetRow>(sql`
    SELECT
      CASE
        WHEN GROUPING(category) = 0 AND GROUPING(subcategory) = 0 THEN 'categories'
        WHEN GROUPING(province) = 0 AND GROUPING(city) = 1 THEN 'provinces'
        WHEN GROUPING(province) = 0 AND GROUPING(city) = 0 THEN 'cities'
        WHEN GROUPING(location) = 0 THEN 'locations'
      END as facet,
      category,
      subcategory,
      province,
      city,
      location,
      COUNT(*)::int as count
    FROM listings
    WHERE removed_at IS NULL
    GROUP BY GROUPING SETS (
      (category, subcategory),
      (province),
      (province, city),
      (location)
    )
    HAVING NOT (GROUPING(location) = 0 AND location IS NULL)
    ORDER BY facet, category, subcategory, province, city, location
  `);

  const categories = facetRows
    .filter((row) => row.facet === 'categories')
    .map(({ category, subcategory, count }) => ({ category, subcategory, count }));

  const provinces = facetRows
    .filter((row) => row.facet === 'provinces')
    .map(({ province, count }) => ({ province, count }));

  const cities = facetRows
    .filter((row) => row.facet === 'cities')
    .map(({ province, city, count }) => ({ province, city, count }));

  const locations = facetRows
    .filter((row) => row.facet === 'locations')
    .map(({ location, count }) => ({ location, count }));

  return NextResponse.json({ categories, provinces, cities, locations });
}
