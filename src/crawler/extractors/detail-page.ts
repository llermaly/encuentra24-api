import { load, type CheerioAPI } from 'cheerio';
import { parseArea, parseFloatSafe, parseIntSafe, safeParseFloat } from '../utils/price.js';
import { extractJsonLd } from './json-ld.js';
import { extractLoopaData } from './loopa-data.js';
import { extractNextDetailPayload } from './next-flight.js';
import {
  extractHtmlFields,
  extractAmenities,
  extractDescription,
  extractImages,
  hasVideoEmbed,
  hasVrView,
} from './html-fields.js';

export interface DetailData {
  // Core
  title: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  oldPrice: number | null;

  // Location
  addressCountry: string | null;
  addressLocality: string | null;
  streetAddress: string | null;
  city: string | null;
  housingType: string | null;
  latitude: number | null;
  longitude: number | null;

  // Property specs
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  builtAreaSqm: number | null;
  landAreaSqm: number | null;
  totalSqm: number | null;
  pricePerSqmConstruction: number | null;
  pricePerSqmLand: number | null;
  yearBuilt: number | null;
  levels: number | null;
  floorNumber: number | null;
  floorType: string | null;
  ceilingHeight: number | null;
  maintenanceCost: number | null;
  titleStatus: string | null;

  // Media
  images: string[];
  hasVideo: boolean;
  hasVr: boolean;

  // Seller
  sellerName: string | null;
  agentName: string | null;
  sellerType: string | null;

  // Amenities
  amenities: string[];

  // Dates
  publishedAt: string | null;

  // Raw data for storage
  rawJsonLd: string | null;
  rawLoopaData: string | null;
  rawRetailRocket: string | null;
}

/**
 * Extract retail rocket data including oldPrice.
 */
function extractRetailRocket($: CheerioAPI): { oldPrice: number | null; categoryPaths: string | null; vendor: string | null; raw: string | null } {
  let raw: string | null = null;
  let oldPrice: number | null = null;
  let categoryPaths: string | null = null;
  let vendor: string | null = null;

  $('script').each((_, el) => {
    const content = $(el).html() || '';
    if (!content.includes('retailrocket')) return;

    const postMatch = content.match(/retailrocket\.products\.post\((\{[\s\S]*?\})\)/);
    if (!postMatch) return;

    raw = postMatch[1];

    try {
      const data = JSON.parse(raw) as {
        oldPrice?: unknown;
        categoryPaths?: string[];
        vendor?: string;
      };

      if (data.oldPrice) {
        oldPrice = safeParseFloat(data.oldPrice);
      }
      if (data.categoryPaths?.[0]) {
        categoryPaths = data.categoryPaths[0];
      }
      if (data.vendor) {
        vendor = data.vendor;
      }
    } catch {
      // Ignore malformed RetailRocket payloads.
    }
  });

  return { oldPrice, categoryPaths, vendor, raw };
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === '$undefined') return null;
  if (/^\$[A-Za-z0-9]+$/.test(trimmed)) return null;

  return trimmed;
}

function parseFlightDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  if (text.startsWith('$D')) {
    return text.slice(2);
  }

  return text;
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

function normalizeCoordinate(value: unknown): number | null {
  const num = safeParseFloat(value);
  if (num === null || num === 0) return null;
  return num;
}

function normalizeDescription(value: unknown): string | null {
  const html = normalizeText(value);
  if (!html) return null;

  const fragment = load(`<div>${html}</div>`);
  fragment('br').replaceWith('\n');

  const text = fragment.root().text()
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text || null;
}

function upgradeImageUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace('/t_or_fh_m/', '/t_or_fh_l/');
}

function normalizeImages(images: unknown, principalImage: unknown): string[] {
  const normalized = new Set<string>();

  if (Array.isArray(images)) {
    for (const image of images) {
      const url = upgradeImageUrl(normalizeText(image));
      if (url) normalized.add(url);
    }
  }

  const fallback = upgradeImageUrl(normalizeText(principalImage));
  if (fallback) normalized.add(fallback);

  return Array.from(normalized);
}

function buildPayloadDetailData($: CheerioAPI): DetailData | null {
  const payload = extractNextDetailPayload($);
  if (!payload?.ad) return null;

  const ad = payload.ad;
  const builtAreaSqm = parseArea(String(ad.square ?? ''));
  const rawLandArea = parseArea(String(ad.lotSize ?? ''));
  const fieldset = normalizeText(ad.fieldset);
  const landAreaSqm = fieldset === 'lot'
    ? rawLandArea
    : rawLandArea !== null && rawLandArea !== builtAreaSqm
      ? rawLandArea
      : null;
  const totalSqm = rawLandArea ?? builtAreaSqm;
  const locationLocality = normalizeText(ad.location?.locality) || normalizeText(ad.regionName);

  return {
    title: normalizeText(ad.title),
    description: normalizeDescription(ad.description) || extractDescription($),
    price: extractMoneyValue(ad.price) ?? extractMoneyValue(ad.rent) ?? safeParseFloat(ad.price_value),
    currency: 'USD',
    oldPrice: null,

    addressCountry: 'Panama',
    addressLocality: locationLocality,
    streetAddress: normalizeText(ad.exactAddress),
    city: normalizeText(ad.location?.city),
    housingType: normalizeText(ad.subCategoryType),
    latitude: normalizeCoordinate(ad.location?.lat),
    longitude: normalizeCoordinate(ad.location?.lon),

    bedrooms: parseIntSafe(String(ad.rooms ?? '')),
    bathrooms: parseFloatSafe(String(ad.bathrooms ?? '')),
    parking: parseIntSafe(String(ad.parking ?? '')),
    builtAreaSqm,
    landAreaSqm,
    totalSqm,
    pricePerSqmConstruction: extractMoneyValue(ad.pricePerM2Square),
    pricePerSqmLand: extractMoneyValue(ad.pricePerM2Total),
    yearBuilt: parseIntSafe(String(ad.age ?? '')),
    levels: parseIntSafe(String(ad.stories ?? '')),
    floorNumber: parseIntSafe(String(ad.floor ?? '')),
    floorType: normalizeText(ad.floorType),
    ceilingHeight: parseFloatSafe(String(ad.roomHeight ?? '')),
    maintenanceCost: extractMoneyValue(ad.maintenanceCost),
    titleStatus: normalizeText(ad.status),

    images: normalizeImages(ad.images, ad.principalImage),
    hasVideo: Boolean(normalizeText(ad.youtubeVideo)),
    hasVr: false,

    sellerName: normalizeText(ad.user?.contact?.company) || normalizeText(ad.user?.name),
    agentName: normalizeText(ad.user?.name),
    sellerType: null,

    amenities: Array.isArray(ad.benefits)
      ? ad.benefits.map((item) => normalizeText(item)).filter((item): item is string => item !== null)
      : [],

    publishedAt: parseFlightDate(ad.dateCreated),

    rawJsonLd: null,
    rawLoopaData: JSON.stringify(ad),
    rawRetailRocket: null,
  };
}

/**
 * Extract and merge all data from a detail page.
 * Priority: Next.js flight payload > JSON-LD > loopaData > HTML fields > RetailRocket
 */
export function extractDetailData($: CheerioAPI): DetailData {
  const payload = buildPayloadDetailData($);
  if (payload) return payload;

  const jsonLd = extractJsonLd($);
  const loopa = extractLoopaData($);
  const html = extractHtmlFields($);
  const rr = extractRetailRocket($);
  const images = extractImages($);
  const amenities = extractAmenities($);
  const description = extractDescription($);

  return {
    title: jsonLd?.name || null,
    description: description || jsonLd?.description || null,
    price: jsonLd?.price ?? loopa?.price ?? html.price,
    currency: jsonLd?.currency || 'USD',
    oldPrice: rr.oldPrice,

    addressCountry: jsonLd?.addressCountry || null,
    addressLocality: jsonLd?.addressLocality || loopa?.region || html.location,
    streetAddress: jsonLd?.streetAddress || html.address || null,
    city: loopa?.parentRegion || null,
    housingType: loopa?.housingType || null,
    latitude: html.latitude,
    longitude: html.longitude,

    bedrooms: html.bedrooms ?? loopa?.bedrooms ?? null,
    bathrooms: html.bathrooms,
    parking: html.parking,
    builtAreaSqm: html.builtAreaSqm ?? loopa?.size ?? null,
    landAreaSqm: html.landAreaSqm,
    totalSqm: html.totalSqm,
    pricePerSqmConstruction: html.pricePerSqmConstruction,
    pricePerSqmLand: html.pricePerSqmLand,
    yearBuilt: html.yearBuilt,
    levels: html.levels,
    floorNumber: html.floorNumber,
    floorType: html.floorType,
    ceilingHeight: html.ceilingHeight,
    maintenanceCost: html.maintenanceCost,
    titleStatus: html.titleStatus,

    images,
    hasVideo: hasVideoEmbed($),
    hasVr: hasVrView($),

    sellerName: rr.vendor || jsonLd?.sellerName || null,
    agentName: $('a.contact_name').first().text().trim() || null,
    sellerType: jsonLd?.sellerType || null,

    amenities,

    publishedAt: html.publishedAt,

    rawJsonLd: jsonLd?.raw || null,
    rawLoopaData: loopa?.raw || null,
    rawRetailRocket: rr.raw || null,
  };
}
