import type { CheerioAPI } from 'cheerio';
import { safeParseFloat } from '../utils/price.js';

export interface LoopaData {
  productId: string | null;
  price: number | null;
  country: string | null;
  region: string | null;
  parentRegion: string | null;
  bedrooms: number | null;
  size: number | null;
  housingType: string | null;
  saleType: string | null;
  raw: string;
}

/**
 * Extract and parse the loopaData JS object from a detail page.
 */
export function extractLoopaData($: CheerioAPI): LoopaData | null {
  let raw: string | null = null;

  $('script').each((_, el) => {
    const content = $(el).html() || '';
    if (content.includes('loopaData')) {
      // Match: var loopaData = { ... };
      const match = content.match(/var\s+loopaData\s*=\s*(\{[\s\S]*?\});/);
      if (match) {
        raw = match[1];
      }
    }
  });

  if (!raw) return null;

  try {
    const data = JSON.parse(raw);

    return {
      productId: data.ProductId || null,
      price: safeParseFloat(data.Price),
      country: data.Country || null,
      region: data.Region || null,
      parentRegion: data.ParentRegion || null,
      bedrooms: data.Bedrooms ? parseInt(data.Bedrooms, 10) : null,
      size: safeParseFloat(data.Size),
      housingType: data.HousingType || null,
      saleType: data.SaleType || null,
      raw,
    };
  } catch {
    return null;
  }
}
