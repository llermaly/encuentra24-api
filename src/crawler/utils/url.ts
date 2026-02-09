import { BASE_URL } from '../../config.js';

/**
 * Ensure a URL is absolute (prepend base if relative).
 */
export function toAbsoluteUrl(href: string): string {
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `https://www.encuentra24.com${href}`;
  return `${BASE_URL}/${href}`;
}

/**
 * Extract the ad ID from a detail page URL.
 * URL pattern: /panama-es/{category-slug}/{title-slug}/{adId}
 */
export function extractAdIdFromUrl(url: string): string | null {
  const match = url.match(/\/(\d+)(?:\?.*)?$/);
  return match ? match[1] : null;
}

/**
 * Extract the slug from a detail page URL.
 * URL pattern: /panama-es/{category-slug}/{title-slug}/{adId}
 */
export function extractSlugFromUrl(url: string): string | null {
  const match = url.match(/\/([^/]+)\/\d+(?:\?.*)?$/);
  return match ? match[1] : null;
}

/**
 * Get the maximum page number from pagination links.
 */
export function getMaxPage(pageNumbers: number[]): number {
  if (pageNumbers.length === 0) return 1;
  return Math.max(...pageNumbers);
}

/**
 * Extract the feature level from CSS classes.
 * Classes: d3-ad-tile--feat-gold, d3-ad-tile--feat-silver, d3-ad-tile--feat-plat
 */
export function extractFeatureLevel(classes: string): string | null {
  const match = classes.match(/d3-ad-tile--feat-(\w+)/);
  if (!match) return null;

  const level = match[1];
  const MAP: Record<string, string> = {
    plat: 'platinum',
    gold: 'gold',
    silver: 'silver',
  };
  return MAP[level] || level;
}

/**
 * Map ga4addata feature string to a normalized feature level.
 */
export function normalizeFeatureLevel(feature: string | null | undefined): string | null {
  if (!feature) return 'basic';

  const MAP: Record<string, string> = {
    AD_FEATGOLD: 'gold',
    AD_FEATSILVER: 'silver',
    AD_FEATPLAT: 'platinum',
    AD_FEATBASIC: 'basic',
  };
  return MAP[feature] || 'basic';
}
