import type { CheerioAPI } from 'cheerio';
import { safeParseFloat } from '../utils/price.js';
import { extractJsonLd } from './json-ld.js';
import { extractLoopaData } from './loopa-data.js';
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

    // Look for retailrocket.products.post({ ... })
    const postMatch = content.match(/retailrocket\.products\.post\((\{[\s\S]*?\})\)/);
    if (postMatch) {
      raw = postMatch[1];
      try {
        const data = JSON.parse(raw);
        if (data.oldPrice) {
          oldPrice = safeParseFloat(data.oldPrice);
        }
        if (data.categoryPaths && data.categoryPaths[0]) {
          categoryPaths = data.categoryPaths[0];
        }
        if (data.vendor) {
          vendor = data.vendor;
        }
      } catch {
        // ignore parse errors
      }
    }
  });

  return { oldPrice, categoryPaths, vendor, raw };
}

/**
 * Extract and merge all data from a detail page.
 * Priority: JSON-LD > loopaData > HTML fields > RetailRocket
 */
export function extractDetailData($: CheerioAPI): DetailData {
  const jsonLd = extractJsonLd($);
  const loopa = extractLoopaData($);
  const html = extractHtmlFields($);
  const rr = extractRetailRocket($);
  const images = extractImages($);
  const amenities = extractAmenities($);
  const description = extractDescription($);

  return {
    // Core — JSON-LD priority, fallback to loopaData
    title: jsonLd?.name || null,
    description: description || jsonLd?.description || null,
    price: jsonLd?.price ?? loopa?.price ?? html.price,
    currency: jsonLd?.currency || 'USD',
    oldPrice: rr.oldPrice,

    // Location — JSON-LD for country/locality, loopaData for city
    addressCountry: jsonLd?.addressCountry || null,
    addressLocality: jsonLd?.addressLocality || loopa?.region || html.location,
    streetAddress: jsonLd?.streetAddress || html.address || null,
    city: loopa?.parentRegion || null,
    housingType: loopa?.housingType || null,
    latitude: html.latitude,
    longitude: html.longitude,

    // Property specs — HTML fields are most detailed, fallback to loopaData
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

    // Media
    images,
    hasVideo: hasVideoEmbed($),
    hasVr: hasVrView($),

    // Seller — RetailRocket vendor is cleanest, JSON-LD is prefixed
    sellerName: rr.vendor || jsonLd?.sellerName || null,
    sellerType: jsonLd?.sellerType || null,

    // Amenities
    amenities,

    // Dates
    publishedAt: html.publishedAt,

    // Raw data
    rawJsonLd: jsonLd?.raw || null,
    rawLoopaData: loopa?.raw || null,
    rawRetailRocket: rr.raw || null,
  };
}
