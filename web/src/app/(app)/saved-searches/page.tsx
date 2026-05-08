'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import { formatRelativeDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SavedSearchMeta {
  id: number;
  name: string;
  filters: string;
  lastCheckedAt: string | null;
  newMatchCount: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ListingItem {
  adId: string;
  title: string | null;
  price: number | null;
  location: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaSqm: number | null;
  thumbnail: string | null;
  firstSeenAt: string;
}

interface SavedSearchPreview {
  id: number;
  name: string;
  filters: string;
  listings: ListingItem[];
}

interface DashboardSearchesData {
  savedSearches: SavedSearchPreview[];
  lastCrawlStart: string | null;
}

function compactPrice(p: number | null | undefined): string {
  if (p == null) return '—';
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}K`;
  return `$${Math.round(p)}`;
}

function getSearchParams(filtersJson: string): URLSearchParams {
  const params = new URLSearchParams();
  try {
    const filters = JSON.parse(filtersJson) as Record<string, unknown>;
    for (const [key, value] of Object.entries(filters)) {
      if (value != null && value !== '') params.set(key, String(value));
    }
  } catch {
    return params;
  }
  return params;
}

function filterChips(filtersJson: string): Array<{ key: string; label: string }> {
  try {
    const f = JSON.parse(filtersJson) as Record<string, unknown>;
    const chips: Array<{ key: string; label: string }> = [];
    if (typeof f.q === 'string' && f.q) chips.push({ key: 'q', label: `"${f.q}"` });
    if (typeof f.category === 'string' && f.category) chips.push({ key: 'cat', label: f.category });
    if (typeof f.subcategory === 'string' && f.subcategory) chips.push({ key: 'sub', label: f.subcategory.replace(/-/g, ' ') });
    if (f.priceMin || f.priceMax) chips.push({ key: 'price', label: `$${f.priceMin || '0'}–$${f.priceMax || '∞'}` });
    if (f.bedroomsMin) chips.push({ key: 'bd', label: `${f.bedroomsMin}+ bd` });
    if (f.bathroomsMin) chips.push({ key: 'ba', label: `${f.bathroomsMin}+ ba` });
    if (typeof f.location === 'string' && f.location) chips.push({ key: 'loc', label: f.location });
    if (typeof f.city === 'string' && f.city) chips.push({ key: 'city', label: f.city });
    if (typeof f.province === 'string' && f.province) chips.push({ key: 'prov', label: f.province });
    return chips;
  } catch {
    return [];
  }
}

export default function SavedSearchesPage() {
  useUser({ or: 'redirect' });
  const queryClient = useQueryClient();
  const router = useRouter();

  const meta = useQuery<SavedSearchMeta[]>({
    queryKey: ['saved-searches'],
    queryFn: () => fetch('/api/saved-searches').then(r => r.json()),
  });

  const previews = useQuery<DashboardSearchesData>({
    queryKey: ['dashboard', 'searches'],
    queryFn: () => fetch('/api/dashboard?tab=searches').then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/saved-searches/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'searches'] });
    },
  });

  function applySearch(filtersJson: string) {
    const params = getSearchParams(filtersJson);
    router.push(`/listings?${params.toString()}`);
  }

  const isLoading = meta.isLoading || previews.isLoading;
  const searches = meta.data ?? [];
  const previewByid = new Map<number, SavedSearchPreview>();
  for (const s of previews.data?.savedSearches ?? []) previewByid.set(s.id, s);
  const lastCrawlStart = previews.data?.lastCrawlStart ?? null;

  const totalNew = searches.reduce((s, x) => s + (x.newMatchCount ?? 0), 0);

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1300px] mx-auto">
      {/* Hero */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Watching</p>
          <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
            Saved <span className="italic">searches</span>
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            {isLoading ? 'Loading…' : searches.length === 0
              ? 'Save filters from the browse page to follow new matches.'
              : (
                <>
                  {searches.length} active {searches.length === 1 ? 'search' : 'searches'}
                  {totalNew > 0 && (
                    <span className="ml-2 aurora-chip aurora-chip-mint">+{totalNew} new since last check</span>
                  )}
                </>
              )}
          </p>
        </div>
        <Link href="/notifications/daily-summary" className="aurora-pill aurora-pill-ghost">
          Preview notifications →
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 rounded-3xl aurora-surface animate-pulse" />
          ))}
        </div>
      ) : searches.length === 0 ? (
        <div className="text-center py-16 rounded-3xl aurora-surface">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: 'linear-gradient(135deg, #ecf3ec, #ebe4cd)' }}
          >
            <svg className="w-7 h-7 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" />
            </svg>
          </div>
          <p className="font-serif text-2xl text-stone-900">No saved searches yet</p>
          <p className="text-sm text-stone-500 mt-1">
            Use the{' '}
            <Link href="/listings" className="text-stone-800 underline-offset-4 hover:underline">browse page</Link>
            {' '}and tap <em>Save search</em> after applying filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {searches.map(search => {
            const preview = previewByid.get(search.id);
            const listings = preview?.listings ?? [];
            const newSinceCrawl = lastCrawlStart
              ? listings.filter(l => l.firstSeenAt >= lastCrawlStart).length
              : 0;
            const chips = filterChips(search.filters);
            return (
              <div
                key={search.id}
                className="rounded-3xl aurora-surface overflow-hidden"
              >
                {/* Header */}
                <div className="px-6 py-5 flex flex-wrap items-start justify-between gap-3 border-b border-stone-200/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-serif text-2xl text-stone-900">{search.name}</h2>
                      {newSinceCrawl > 0 && (
                        <span className="aurora-chip aurora-chip-ink">
                          +{newSinceCrawl} new
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {chips.length > 0 ? chips.map(c => (
                        <span key={c.key} className="aurora-chip capitalize">{c.label}</span>
                      )) : (
                        <span className="aurora-chip">All listings</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-2.5">
                      <span>Saved {formatRelativeDate(search.createdAt)}</span>
                      {search.lastCheckedAt && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-stone-300" />
                          <span>Checked {formatRelativeDate(search.lastCheckedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() => applySearch(search.filters)}
                      className="aurora-pill aurora-pill-primary"
                    >
                      Run →
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(search.id)}
                      className="aurora-pill aurora-pill-ghost hover:text-stone-900"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Listings preview */}
                <div className="px-6 py-5">
                  {listings.length === 0 ? (
                    <p className="text-sm text-stone-500 italic py-6 text-center">No listings match this search yet.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {listings.slice(0, 6).map(listing => {
                          const isNew = !!lastCrawlStart && listing.firstSeenAt >= lastCrawlStart;
                          return (
                            <Link
                              key={listing.adId}
                              href={`/listings/${listing.adId}`}
                              className={`group flex gap-3 p-3 rounded-2xl transition-all border ${
                                isNew
                                  ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                                  : 'border-transparent hover:bg-white/60'
                              }`}
                            >
                              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
                                {listing.thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={listing.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-stone-100 to-stone-200" />
                                )}
                                {isNew && (
                                  <span className="absolute top-1 left-1 aurora-chip aurora-chip-mint text-[9px] px-1.5 py-0">
                                    New
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-serif text-lg text-stone-900 leading-tight">
                                  {compactPrice(listing.price)}
                                </p>
                                <p className="text-xs text-stone-700 truncate mt-0.5">{listing.title || listing.adId}</p>
                                <p className="text-[11px] text-stone-500 truncate">{listing.location || '—'}</p>
                                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-stone-500">
                                  {listing.bedrooms != null && <span>{listing.bedrooms}bd</span>}
                                  {listing.bathrooms != null && <span>{listing.bathrooms}ba</span>}
                                  {listing.builtAreaSqm != null && <span>{Math.round(listing.builtAreaSqm)}m²</span>}
                                  <span className="ml-auto text-stone-400">{formatRelativeDate(listing.firstSeenAt)}</span>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                      {listings.length > 6 && (
                        <div className="mt-4 text-center">
                          <Link
                            href={`/listings?${getSearchParams(search.filters).toString()}`}
                            className="text-sm text-stone-700 hover:text-stone-900 underline-offset-4 hover:underline"
                          >
                            View all {listings.length}+ matches →
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
