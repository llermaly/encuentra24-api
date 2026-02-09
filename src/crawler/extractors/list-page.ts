import type { CheerioAPI } from 'cheerio';
import { parsePrice, parseArea, parseIntSafe, parseFavorites } from '../utils/price.js';
import { toAbsoluteUrl, extractAdIdFromUrl, extractSlugFromUrl, extractFeatureLevel, normalizeFeatureLevel } from '../utils/url.js';

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

/**
 * Extract all listing cards from a search results page.
 */
export function extractListingCards($: CheerioAPI): ListingCard[] {
  const cards: ListingCard[] = [];

  $('.d3-ad-tile').each((_, el) => {
    const $tile = $(el);

    // Get detail URL from the description link
    const detailHref = $tile.find('.d3-ad-tile__description').attr('href')
      || $tile.find('.d3-ad-tile__cover a').attr('href');

    if (!detailHref) return; // skip if no link

    const url = toAbsoluteUrl(detailHref);
    const adId = extractAdIdFromUrl(url);
    if (!adId) return; // skip if no ad ID

    // Get data from favorite button attributes (reliable source for adId and price)
    const $fav = $tile.find('.tool-favorite[data-adid]').first();
    const dataPrice = $fav.attr('data-price');

    // Specs: identified by SVG sprite icon IDs
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
        bathrooms = parseIntSafe(text);
      } else if (iconUse.includes('#parking')) {
        parking = parseIntSafe(text);
      } else if (iconUse.includes('#resize')) {
        areaSqm = parseArea(text);
      }
    });

    // Feature level from CSS classes
    const classes = $tile.attr('class') || '';
    const featureLevel = extractFeatureLevel(classes);

    const card: ListingCard = {
      adId,
      slug: extractSlugFromUrl(url),
      url,
      title: $tile.find('.d3-ad-tile__title').text().trim() || null,
      price: dataPrice ? parsePrice(dataPrice) : parsePrice($tile.find('.d3-ad-tile__price').text()),
      location: $tile.find('.d3-ad-tile__location span').text().trim().replace(/\s+/g, ' ') || null,
      shortDescription: $tile.find('.d3-ad-tile__short-description').text().trim() || null,
      bedrooms,
      bathrooms,
      parking,
      areaSqm,
      sellerName: $tile.find('.d3-ad-tile__seller > span').first().text().trim() || null,
      sellerVerified: $tile.find('.d3-ad-tile__verified').length > 0,
      featureLevel: featureLevel || 'basic',
      discountPct: null, // Will be populated if discount badge exists
      favoritesCount: parseFavorites($fav.attr('title')),
      imageUrl: $tile.find('img.d3-ad-tile__photo').attr('data-original') || null,
      ga4Data: null,
    };

    cards.push(card);
  });

  return cards;
}

/**
 * Extract ga4addata from inline scripts on the page.
 */
export function extractGa4Data($: CheerioAPI): Record<string, Ga4AdData> {
  const data: Record<string, Ga4AdData> = {};

  $('script').each((_, el) => {
    const content = $(el).html() || '';
    if (!content.includes('ga4addata[')) return;

    // Match: ga4addata[31871394] = { ... }
    const regex = /ga4addata\[(\d+)\]\s*=\s*(\{[^}]+\})/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      try {
        const adId = match[1];
        const parsed = JSON.parse(match[2]);
        data[adId] = parsed;
      } catch {
        // skip malformed JSON
      }
    }
  });

  return data;
}

/**
 * Extract pagination info: available page numbers.
 */
export function extractPagination($: CheerioAPI): number[] {
  const pages: number[] = [];

  $('.d3-pagination__page').each((_, el) => {
    const page = $(el).attr('data-page');
    if (page) {
      const num = parseInt(page, 10);
      if (!isNaN(num) && !pages.includes(num)) {
        pages.push(num);
      }
    }
  });

  return pages.sort((a, b) => a - b);
}

/**
 * Extract total results count from the header text.
 */
export function extractResultsCount($: CheerioAPI): number | null {
  const text = $('.d3-category-list__results').text();
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
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
