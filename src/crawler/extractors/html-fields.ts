import type { CheerioAPI } from 'cheerio';
import { parsePrice, parseArea, parseIntSafe, parseFloatSafe } from '../utils/price.js';

export interface HtmlFields {
  price: number | null;
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
  publishedAt: string | null;
  location: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Map of Spanish labels to field names
const LABEL_MAP: Record<string, keyof HtmlFields> = {
  'precio': 'price',
  'recamaras': 'bedrooms',
  'banos': 'bathrooms',
  'baños': 'bathrooms',
  'parking': 'parking',
  'area construida (m2)': 'builtAreaSqm',
  'area construida': 'builtAreaSqm',
  'area total del terreno (m2)': 'landAreaSqm',
  'area total del terreno': 'landAreaSqm',
  'm2 totales': 'totalSqm',
  'precio/m2 de construccion': 'pricePerSqmConstruction',
  'precio/m2 de terreno': 'pricePerSqmLand',
  'ano de construccion': 'yearBuilt',
  'año de construccion': 'yearBuilt',
  'año de construcción': 'yearBuilt',
  'niveles': 'levels',
  'piso numero': 'floorNumber',
  'tipo de pisos': 'floorType',
  'altura': 'ceilingHeight',
  'costos de mantenimiento': 'maintenanceCost',
  'titulacion': 'titleStatus',
  'titulación': 'titleStatus',
  'publicado': 'publishedAt',
  'localizacion': 'location',
  'localización': 'location',
  'direccion exacta': 'address',
  'dirección exacta': 'address',
};

/**
 * Parse a DD/MM/YYYY date string into ISO format (YYYY-MM-DD).
 */
function parseDateDMY(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Parse a label/value pair and set the corresponding field.
 */
function applyField(fields: HtmlFields, label: string, value: string): void {
  // Normalize: lowercase + strip accents
  const normalized = label.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Try both normalized and original lowercase
  const fieldName = LABEL_MAP[normalized] || LABEL_MAP[label.toLowerCase()];
  if (!fieldName) return;

  switch (fieldName) {
    case 'price':
    case 'pricePerSqmConstruction':
    case 'pricePerSqmLand':
    case 'maintenanceCost':
      fields[fieldName] = parsePrice(value);
      break;
    case 'bedrooms':
    case 'parking':
    case 'yearBuilt':
    case 'levels':
    case 'floorNumber':
      fields[fieldName] = parseIntSafe(value);
      break;
    case 'bathrooms':
    case 'ceilingHeight':
      fields[fieldName] = parseFloatSafe(value);
      break;
    case 'builtAreaSqm':
    case 'landAreaSqm':
    case 'totalSqm':
      fields[fieldName] = parseArea(value);
      break;
    case 'publishedAt':
      fields[fieldName] = parseDateDMY(value);
      break;
    case 'floorType':
    case 'titleStatus':
    case 'location':
    case 'address':
      fields[fieldName] = value;
      break;
  }
}

/**
 * Extract structured property fields from the detail page.
 * The site uses two patterns:
 *   1. div.d3-property-details__detail-label > p.d3-property-details__detail (primary)
 *   2. dl > dt + dd (fallback)
 */
export function extractHtmlFields($: CheerioAPI): HtmlFields {
  const fields: HtmlFields = {
    price: null,
    bedrooms: null,
    bathrooms: null,
    parking: null,
    builtAreaSqm: null,
    landAreaSqm: null,
    totalSqm: null,
    pricePerSqmConstruction: null,
    pricePerSqmLand: null,
    yearBuilt: null,
    levels: null,
    floorNumber: null,
    floorType: null,
    ceilingHeight: null,
    maintenanceCost: null,
    titleStatus: null,
    publishedAt: null,
    location: null,
    address: null,
    latitude: null,
    longitude: null,
  };

  // Primary pattern: div.d3-property-details__detail-label with nested p.d3-property-details__detail
  // Structure: <div class="d3-property-details__detail-label">LabelText<p class="...">Value</p></div>
  $('.d3-property-details__detail-label').each((_, el) => {
    const $el = $(el);
    const $value = $el.find('.d3-property-details__detail');
    if (!$value.length) return;

    const value = $value.text().trim();
    if (!value) return;

    // The label is the text node directly inside the div, excluding the nested p
    const $clone = $el.clone();
    $clone.find('.d3-property-details__detail').remove();
    const label = $clone.text().trim();
    if (!label) return;

    applyField(fields, label, value);
  });

  // Fallback pattern: dt/dd pairs (some pages may use this)
  $('dl dt').each((_, dtEl) => {
    const $dt = $(dtEl);
    const $dd = $dt.next('dd');
    if (!$dd.length) return;

    const label = $dt.text().trim();
    const value = $dd.text().trim();
    if (!label || !value) return;

    applyField(fields, label, value);
  });

  // Extract coordinates from Google Maps iframe
  const coords = extractCoordinates($);
  fields.latitude = coords.latitude;
  fields.longitude = coords.longitude;

  return fields;
}

/**
 * Extract latitude/longitude from the Google Maps embed iframe.
 * Pattern: <section class="d3-property__map"><iframe src="...?q=LAT,LNG&zoom=15"></iframe></section>
 */
export function extractCoordinates($: CheerioAPI): { latitude: number | null; longitude: number | null } {
  const iframe = $('.d3-property__map iframe').attr('src') || '';

  // Match q=LAT,LNG in the URL
  const match = iframe.match(/[?&]q=([-\d.]+),([-\d.]+)/);
  if (!match) return { latitude: null, longitude: null };

  const latitude = parseFloat(match[1]);
  const longitude = parseFloat(match[2]);

  return {
    latitude: isNaN(latitude) ? null : latitude,
    longitude: isNaN(longitude) ? null : longitude,
  };
}

/**
 * Extract amenities from the benefits/amenities section.
 */
export function extractAmenities($: CheerioAPI): string[] {
  const amenities: string[] = [];

  // Look for common amenity container patterns
  // The site uses various class names for amenities sections
  const selectors = [
    '.d3-property-benefits li',
    '.d3-property-amenities li',
    '.d3-benefits li',
    '.amenities li',
    '[class*="benefit"] li',
    '[class*="ameniti"] li',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      if (text && !amenities.includes(text)) {
        amenities.push(text);
      }
    });

    if (amenities.length > 0) break;
  }

  return amenities;
}

/**
 * Extract the full description text.
 */
export function extractDescription($: CheerioAPI): string | null {
  const $about = $('.d3-property-about');
  if (!$about.length) return null;

  // Remove the "Leer mas" button text
  const $clone = $about.clone();
  $clone.find('button').remove();
  return $clone.text().trim() || null;
}

/**
 * Extract image URLs from the Swiper gallery.
 */
export function extractImages($: CheerioAPI): string[] {
  const images: string[] = [];

  $('.swiper-slide').each((_, el) => {
    const $slide = $(el);
    const imgSrc = $slide.find('img').attr('src');

    if (imgSrc && !imgSrc.includes('data:image') && !imgSrc.includes('no-image')) {
      // Upgrade to full-size image by replacing transform
      const fullSize = imgSrc.replace(/t_or_cvr_th/, 't_or_fh_l');
      images.push(fullSize);
    }
  });

  return images;
}

/**
 * Check if the listing has a video embed.
 */
export function hasVideoEmbed($: CheerioAPI): boolean {
  return $('iframe[src*="youtube"]').length > 0
    || $('iframe[src*="vimeo"]').length > 0
    || $('[class*="video"]').length > 0;
}

/**
 * Check if the listing has a VR/360 view.
 */
export function hasVrView($: CheerioAPI): boolean {
  return $('[class*="360"]').length > 0
    || $('iframe[src*="360"]').length > 0
    || $('[class*="vr"]').length > 0;
}
