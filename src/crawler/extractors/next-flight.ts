import type { CheerioAPI } from 'cheerio';

interface NextAmount {
  value?: number | string | null;
}

interface NextMoney {
  amount?: NextAmount | null;
  currency?: {
    symbol?: string | null;
  } | null;
  discount?: NextAmount | null;
}

interface NextContact {
  company?: string | null;
  license?: string | null;
  whatsapp?: string | null;
  phone1?: {
    number?: string | null;
  } | null;
  phone2?: {
    number?: string | null;
  } | null;
}

interface NextUser {
  name?: string | null;
  verified?: boolean | null;
  contact?: NextContact | null;
}

interface NextLocation {
  address?: string | null;
  locality?: string | null;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  zoom?: number | null;
}

export interface NextAdPayload {
  id?: string | null;
  link?: string | null;
  title?: string | null;
  description?: string | null;
  featured?: string | null;
  fieldset?: string | null;
  images?: string[] | null;
  principalImage?: string | null;
  location?: NextLocation | null;
  price?: NextMoney | string | null;
  rent?: NextMoney | string | null;
  maintenanceCost?: NextMoney | string | null;
  user?: NextUser | null;
  subCategoryType?: string | null;
  rooms?: string | number | null;
  bathrooms?: string | number | null;
  parking?: string | number | null;
  square?: string | number | null;
  lotSize?: string | number | null;
  exactAddress?: string | null;
  pricePerM2Total?: NextMoney | string | null;
  pricePerM2Square?: NextMoney | string | null;
  benefits?: string[] | null;
  roomHeight?: string | number | null;
  age?: string | number | null;
  stories?: string | number | null;
  floor?: string | number | null;
  floorType?: string | null;
  status?: string | null;
  youtubeVideo?: string | null;
  regionName?: string | null;
  dateCreated?: string | null;
  dateUpdated?: string | null;
  price_discount?: number | string | null;
  price_value?: number | string | null;
  projectStatus?: string | null;
  projectModels?: {
    square?: {
      from?: number | null;
      to?: number | null;
    } | null;
    rooms?: {
      from?: number | null;
      to?: number | null;
    } | null;
    bathrooms?: {
      from?: number | null;
      to?: number | null;
    } | null;
    price?: {
      from?: number | null;
      to?: number | null;
    } | null;
  } | null;
  units?: unknown;
}

export interface NextListResults {
  data: NextAdPayload[];
  metadata?: {
    total?: number | null;
    page?: number | null;
    itemsPerPage?: number | null;
    totalPages?: number | null;
  } | null;
}

export interface NextDetailPayload {
  ad: NextAdPayload;
  seoData?: {
    canonical?: string | null;
  } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDecodedFlightSegment(decoded: string): unknown | null {
  const separator = decoded.indexOf(':');
  if (separator === -1) return null;

  try {
    return JSON.parse(decoded.slice(separator + 1));
  } catch {
    return null;
  }
}

function findInTree<T>(value: unknown, predicate: (node: unknown) => node is T): T | null {
  if (predicate(value)) return value;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findInTree(item, predicate);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  for (const item of Object.values(value)) {
    const found = findInTree(item, predicate);
    if (found) return found;
  }

  return null;
}

function decodeNextFlightSegments($: CheerioAPI): string[] {
  const decoded: string[] = [];
  const regex = /self\.__next_f\.push\(\[(\d+),("(?:[^"\\]|\\.)*")\]\)/gms;

  $('script').each((_, el) => {
    const content = $(el).html() || '';
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      try {
        decoded.push(JSON.parse(match[2]) as string);
      } catch {
        // Ignore malformed flight segments.
      }
    }
  });

  return decoded;
}

function isListResultsContainer(node: unknown): node is { initialResults: NextListResults } {
  if (!isRecord(node)) return false;
  if (!isRecord(node.initialResults)) return false;
  return Array.isArray(node.initialResults.data);
}

function isDetailPayload(node: unknown): node is NextDetailPayload {
  return isRecord(node) && isRecord(node.ad) && typeof node.ad.id === 'string';
}

export function extractNextListResults($: CheerioAPI): NextListResults | null {
  for (const decoded of decodeNextFlightSegments($)) {
    if (!decoded.includes('"initialResults"')) continue;

    const parsed = parseDecodedFlightSegment(decoded);
    if (!parsed) continue;

    const container = findInTree(parsed, isListResultsContainer);
    if (container) return container.initialResults;
  }

  return null;
}

export function extractNextDetailPayload($: CheerioAPI): NextDetailPayload | null {
  for (const decoded of decodeNextFlightSegments($)) {
    if (!decoded.includes('"ad":{')) continue;

    const parsed = parseDecodedFlightSegment(decoded);
    if (!parsed) continue;

    const payload = findInTree(parsed, isDetailPayload);
    if (payload) return payload;
  }

  return null;
}
