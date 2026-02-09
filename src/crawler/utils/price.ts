/**
 * Parse a price string like "$105,000" or "105000" into a number.
 * Returns null if unparseable.
 */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;

  // Remove currency symbols, whitespace, commas
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse an area string like "350 m2" or "350" into a number.
 */
export function parseArea(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const match = raw.match(/([\d,.]+)/);
  if (!match) return null;

  const cleaned = match[1].replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse an integer from a string. Returns null if not a number.
 */
export function parseIntSafe(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[^0-9]/g, '');
  if (!cleaned) return null;

  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * Parse a float from a string (for bathrooms like "2.5").
 */
export function parseFloatSafe(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const match = raw.match(/([\d.]+)/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  return isNaN(num) ? null : num;
}

/**
 * Parse discount percentage from badge text like "-3%" or "-14%".
 */
export function parseDiscount(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const match = raw.match(/-?\s*(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;

  return -Math.abs(parseFloat(match[1]));
}

/**
 * Parse favorites count from title text like "10 Favoritos".
 */
export function parseFavorites(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const match = raw.match(/(\d+)/);
  if (!match) return null;

  return parseInt(match[1], 10);
}
