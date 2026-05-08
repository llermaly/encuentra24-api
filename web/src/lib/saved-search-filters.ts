import { parseFiltersFromParams, type ListingFilters } from '@/types/filters';

export function parseSavedSearchFilters(filtersJson: string): ListingFilters {
  const params = new URLSearchParams();

  try {
    const rawFilters = JSON.parse(filtersJson) as Record<string, unknown>;
    for (const [key, value] of Object.entries(rawFilters)) {
      if (value != null && value !== '') params.set(key, String(value));
    }
  } catch {
    return { status: 'active' };
  }

  const filters = parseFiltersFromParams(params);
  if (!filters.status) filters.status = 'active';
  return filters;
}
