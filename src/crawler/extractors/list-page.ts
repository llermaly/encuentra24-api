import type { CheerioAPI } from 'cheerio';
import { parseArea, parseFloatSafe, parseIntSafe, parsePrice, safeParseFloat } from '../utils/price.js';
import { toAbsoluteUrl, extractAdIdFromUrl, extractSlugFromUrl, normalizeFeatureLevel } from '../utils/url.js';
import { extractNextListResults, type NextAdPayload } from './next-flight.js';

export interface ListingCard {
  adId: string;
  slug: string | null;
  url: string;
  title: string | null;
  price: number | null;
  location: string | null;
  shortDescription: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  areaSqm: number | null;
  sellerName: string | null;
  sellerVerified: boolean;
  featureLevel: string | null;
  discountPct: number | null;
  favoritesCount: number | null;
  imageUrl: string | null;
  ga4Data: Ga4AdData | null;
}

interface Ga4AdData {
  category: string;
  subcategory: string;
  country: string;
  province: string;
  location: string;
  feature: string;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === '$undefined') return null;
  if (/^\$[A-Za-z0-9]+$/.test(trimmed)) return null;

  return trimmed;
}

function extractMoneyValue(value: unknown): number | null {
  if (typeof value === 'number' || typeof value === 'string') {
    return safeParseFloat(value);
  }

  if (value && typeof value === 'object' && 'amount' in value) {
    const amount = value.amount;
    if (amount && typeof amount === 'object' && 'value' in amount) {
      return safeParseFloat(amount.value);
    }
  }

  return null;
}

function upgradeImageUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace('/t_or_fh_m/', '/t_or_fh_l/');
}

function normalizeFeatureLevelFromPayload(feature: string | null): string | null {
  if (!feature) return 'basic';

  const normalized = feature.toLowerCase();
  if (normalized === 'plat') return 'platinum';
  if (normalized === 'super') return 'super';
  if (normalized === 'gold' || normalized === 'silver' || normalized === 'platinum') {
    return normalized;
  }

  return normalizeFeatureLevel(feature) || 'basic';
}

function buildLocation(item: NextAdPayload): string | null {
  const locality = normalizeText(item.location?.locality) || normalizeText(item.regionName);
  const city = normalizeText(item.location?.city);

  if (locality && city) return `${locality}, ${city}`;
  return locality || city || null;
}

function mapPayloadCard(item: NextAdPayload): ListingCard | null {
  const href = normalizeText(item.link);
  if (!href) return null;

  const url = toAbsoluteUrl(href);
  const adId = normalizeText(item.id) || extractAdIdFromUrl(url);
  if (!adId) return null;

  const imageUrl = upgradeImageUrl(
    Array.isArray(item.images) && item.images.length > 0
      ? item.images[0]
      : normalizeText(item.principalImage),
  );

  return {
    adId,
    slug: extractSlugFromUrl(url),
    url,
    title: normalizeText(item.title),
    price: extractMoneyValue(item.price) ?? extractMoneyValue(item.rent) ?? safeParseFloat(item.price_value),
    location: buildLocation(item),
    shortDescription: normalizeText(item.description),
    bedrooms: parseIntSafe(String(item.rooms ?? '')),
    bathrooms: parseFloatSafe(String(item.bathrooms ?? '')),
    parking: parseIntSafe(String(item.parking ?? '')),
    areaSqm: parseArea(String(item.square ?? item.lotSize ?? '')),
    sellerName: normalizeText(item.user?.contact?.company) || normalizeText(item.user?.name),
    sellerVerified: Boolean(item.user?.verified),
    featureLevel: normalizeFeatureLevelFromPayload(normalizeText(item.featured)),
    discountPct: safeParseFloat(item.price_discount),
    favoritesCount: null,
    imageUrl,
    ga4Data: null,
  };
}

function extractListingCardsFromPayload($: CheerioAPI): ListingCard[] {
  const results = extractNextListResults($);
  if (!results?.data?.length) return [];

  return results.data
    .map(mapPayloadCard)
    .filter((card): card is ListingCard => card !== null);
}

function extractListingCardsFromLegacyDom($: CheerioAPI): ListingCard[] {
  const cards: ListingCard[] = [];

  $('.d3-ad-tile').each((_, el) => {
    const $tile = $(el);
    const detailHref = $tile.find('.d3-ad-tile__description').attr('href')
      || $tile.find('.d3-ad-tile__cover a').attr('href');

    if (!detailHref) return;

    const url = toAbsoluteUrl(detailHref);
    const adId = extractAdIdFromUrl(url);
    if (!adId) return;

    let bedrooms: number | null = null;
    let bathrooms: number | null = null;
    let parking: number | null = null;
    let areaSqm: number | null = null;

    $tile.find('.d3-ad-tile__details-item').each((_, specEl) => {
      const $spec = $(specEl);
      const iconUse = $spec.find('svg use').attr('xlink:href') || '';
      const text = $spec.text().trim();

      if (iconUse.includes('#bed')) {
        bedrooms = parseIntSafe(text);
      } else if (iconUse.includes('#bath')) {
        bathrooms = parseFloatSafe(text);
      } else if (iconUse.includes('#parking')) {
        parking = parseIntSafe(text);
      } else if (iconUse.includes('#resize')) {
        areaSqm = parseArea(text);
      }
    });

    cards.push({
      adId,
      slug: extractSlugFromUrl(url),
      url,
      title: normalizeText($tile.find('.d3-ad-tile__title').text()),
      price: parsePrice($tile.find('.d3-ad-tile__price').text()),
      location: normalizeText($tile.find('.d3-ad-tile__location span').text()),
      shortDescription: normalizeText($tile.find('.d3-ad-tile__short-description').text()),
      bedrooms,
      bathrooms,
      parking,
      areaSqm,
      sellerName: normalizeText($tile.find('.d3-ad-tile__seller > span').first().text()),
      sellerVerified: $tile.find('.d3-ad-tile__verified').length > 0,
      featureLevel: 'basic',
      discountPct: null,
      favoritesCount: null,
      imageUrl: upgradeImageUrl($tile.find('img.d3-ad-tile__photo').attr('data-original') || null),
      ga4Data: null,
    });
  });

  return cards;
}

/**
 * Extract all listing cards from a search results page.
 */
export function extractListingCards($: CheerioAPI): ListingCard[] {
  const cards = extractListingCardsFromPayload($);
  if (cards.length > 0) return cards;

  return extractListingCardsFromLegacyDom($);
}

/**
 * Extract ga4addata from inline scripts on the page.
 */
export function extractGa4Data($: CheerioAPI): Record<string, Ga4AdData> {
  const data: Record<string, Ga4AdData> = {};

  $('script').each((_, el) => {
    const content = $(el).html() || '';
    if (!content.includes('ga4addata[')) return;

    const regex = /ga4addata\[(\d+)\]\s*=\s*(\{[^}]+\})/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      try {
        const adId = match[1];
        const parsed = JSON.parse(match[2]) as Ga4AdData;
        data[adId] = parsed;
      } catch {
        // Ignore malformed GA4 entries.
      }
    }
  });

  return data;
}

/**
 * Extract pagination info: available page numbers.
 */
export function extractPagination($: CheerioAPI): number[] {
  const results = extractNextListResults($);
  const totalPages = results?.metadata?.totalPages;
  if (typeof totalPages === 'number' && totalPages > 0) {
    return [totalPages];
  }

  const pages: number[] = [];

  $('button[aria-label^="Página "]').each((_, el) => {
    const label = $(el).attr('aria-label') || '';
    const match = label.match(/Página\s+(\d+)/);
    if (!match) return;

    const page = parseInt(match[1], 10);
    if (!Number.isNaN(page) && !pages.includes(page)) {
      pages.push(page);
    }
  });

  $('.d3-pagination__page').each((_, el) => {
    const page = $(el).attr('data-page');
    if (!page) return;

    const num = parseInt(page, 10);
    if (!Number.isNaN(num) && !pages.includes(num)) {
      pages.push(num);
    }
  });

  return pages.sort((a, b) => a - b);
}

/**
 * Extract total results count from the header text.
 */
export function extractResultsCount($: CheerioAPI): number | null {
  const total = extractNextListResults($)?.metadata?.total;
  if (typeof total === 'number' && total >= 0) {
    return total;
  }

  const description = $('meta[name="description"]').attr('content') || '';
  const metaMatch = description.match(/tenemos\s+([\d,]+)/i);
  if (metaMatch) {
    return parseInt(metaMatch[1].replace(/,/g, ''), 10);
  }

  const text = $('.d3-category-list__results').text();
  const match = text.match(/([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ''), 10) : null;
}

/**
 * Merge ga4 data into listing cards.
 */
export function mergeGa4DataIntoCards(cards: ListingCard[], ga4: Record<string, Ga4AdData>): void {
  for (const card of cards) {
    const data = ga4[card.adId];
    if (data) {
      card.ga4Data = data;
      card.featureLevel = normalizeFeatureLevel(data.feature) || card.featureLevel;
    }
  }
}
