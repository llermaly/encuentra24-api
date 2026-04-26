'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import { formatPrice, formatRelativeDate, formatArea } from '@/lib/formatters';
import Link from 'next/link';

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

interface CategoryRow {
  category: string;
  subcategory: string;
  total: number;
  active: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  newThisWeek: number;
}

interface LocationRow {
  city: string;
  location: string | null;
  category: string;
  subcategory: string;
  active: number;
  avgPrice: number | null;
  newThisWeek: number;
}

interface SavedSearchSummary {
  id: number;
  name: string;
  filters: string;
  lastCheckedAt: string | null;
  newMatchCount: number | null;
}

function formatCompactPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price.toFixed(0)}`;
}

type Tab = 'summary' | 'market' | 'searches';

export default function DashboardPage() {
  useUser({ or: 'redirect' });
  const [tab, setTab] = useState<Tab>('summary');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {([
          { key: 'summary' as Tab, label: 'Summary' },
          { key: 'market' as Tab, label: 'Market Overview' },
          { key: 'searches' as Tab, label: 'Saved Searches' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab />}
      {tab === 'market' && <MarketTab />}
      {tab === 'searches' && <SearchesTab />}
    </div>
  );
}

/* ─── Summary Tab ────────────────────────────────────────────────────────── */

function SummaryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => fetch('/api/dashboard?tab=summary').then(r => r.json()),
  });

  if (isLoading || !data) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  const { stats, latestListings, lastCrawl } = data;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Active Listings" value={stats.activeListings.toLocaleString()} />
        <StatCard label="New This Week" value={stats.newThisWeek.toLocaleString()} accent />
        <StatCard label="Avg Sale Price" value={formatCompactPrice(stats.avgPriceSale)} />
        <StatCard label="Avg Rent Price" value={formatCompactPrice(stats.avgPriceRent)} />
        <StatCard label="Active Sellers" value={stats.activeSellers.toLocaleString()} />
      </div>

      {/* Last crawl */}
      {lastCrawl && (
        <div className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Last Crawl</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            <span>Status: <span className={lastCrawl.status === 'completed' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>{lastCrawl.status}</span></span>
            <span>Started: {formatRelativeDate(lastCrawl.startedAt)}</span>
            {lastCrawl.durationSecs && <span>Duration: {lastCrawl.durationSecs}s</span>}
            {lastCrawl.listingsNew > 0 && <span className="text-green-600 font-medium">+{lastCrawl.listingsNew} new</span>}
            <Link href="/crawl-history" className="text-blue-600 hover:underline">View history</Link>
          </div>
        </div>
      )}

      {/* Newest Properties */}
      {(latestListings ?? []).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Newest Properties</h2>
            <Link href="/listings?sort=newest" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {latestListings.map((listing: ListingItem) => (
              <ListingRow key={listing.adId} listing={listing} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Market Tab ─────────────────────────────────────────────────────────── */

function MarketTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'market'],
    queryFn: () => fetch('/api/dashboard?tab=market').then(r => r.json()),
  });

  if (isLoading || !data) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-64 bg-gray-200 rounded-lg" />
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LocationExplorer rows={data.locationBreakdown} />
      <CategoryBreakdown rows={data.categoryBreakdown} />
    </div>
  );
}

/* ─── Searches Tab ───────────────────────────────────────────────────────── */

function SearchesTab() {
  const { data: savedSearches = [], isLoading } = useQuery<SavedSearchSummary[]>({
    queryKey: ['saved-searches'],
    queryFn: () => fetch('/api/saved-searches').then(r => r.json()),
  });

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;
  }

  if (savedSearches.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <p className="text-gray-500">No saved searches yet.</p>
        <p className="text-sm text-gray-400 mt-1">
          Save a search from the{' '}
          <Link href="/listings" className="text-blue-600 hover:underline">listings page</Link>
          {' '}to track new matches.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {savedSearches.map((search) => (
        <SavedSearchBox key={search.id} search={search} />
      ))}
    </div>
  );
}

/* ─── Category Breakdown ──────────────────────────────────────────────────── */

function CategoryBreakdown({ rows }: { rows: CategoryRow[] }) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  if (!rows || rows.length === 0) return null;

  const grouped: Record<string, CategoryRow[]> = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Category Breakdown</h2>
      </div>
      <div className="divide-y">
        {Object.entries(grouped).map(([category, subcategories]) => {
          const isExpanded = expandedCategories.has(category);
          const catTotal = subcategories.reduce((s, r) => s + r.active, 0);
          const catNewWeek = subcategories.reduce((s, r) => s + r.newThisWeek, 0);
          const prices = subcategories.filter(r => r.avgPrice != null).map(r => r.avgPrice!);
          const catAvgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium text-gray-900 capitalize">{category}</span>
                  <span className="text-xs text-gray-400">{subcategories.length} subcategories</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">{catTotal.toLocaleString()} active</span>
                  <span className="text-gray-500">{formatCompactPrice(catAvgPrice)} avg</span>
                  {catNewWeek > 0 && (
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">+{catNewWeek} this week</span>
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="bg-gray-50 border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase">
                        <th className="text-left px-4 py-2 font-medium">Subcategory</th>
                        <th className="text-right px-4 py-2 font-medium">Active</th>
                        <th className="text-right px-4 py-2 font-medium">Avg Price</th>
                        <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">Min</th>
                        <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">Max</th>
                        <th className="text-right px-4 py-2 font-medium">New</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {subcategories.map(row => (
                        <tr key={row.subcategory} className="hover:bg-gray-100 transition-colors">
                          <td className="px-4 py-2">
                            <Link href={`/listings?category=${encodeURIComponent(row.category)}&subcategory=${encodeURIComponent(row.subcategory)}`} className="text-blue-600 hover:underline capitalize">
                              {row.subcategory.replace(/-/g, ' ')}
                            </Link>
                          </td>
                          <td className="text-right px-4 py-2 text-gray-700">{row.active.toLocaleString()}</td>
                          <td className="text-right px-4 py-2 text-gray-700">{formatCompactPrice(row.avgPrice)}</td>
                          <td className="text-right px-4 py-2 text-gray-500 hidden sm:table-cell">{formatCompactPrice(row.minPrice)}</td>
                          <td className="text-right px-4 py-2 text-gray-500 hidden sm:table-cell">{formatCompactPrice(row.maxPrice)}</td>
                          <td className="text-right px-4 py-2">
                            {row.newThisWeek > 0 ? <span className="text-blue-600 font-medium">+{row.newThisWeek}</span> : <span className="text-gray-400">0</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Location Explorer ───────────────────────────────────────────────────── */

interface CityData {
  totalActive: number;
  totalNew: number;
  avgPrice: number | null;
  locations: Record<string, LocationData>;
}

interface LocationData {
  totalActive: number;
  totalNew: number;
  avgPrice: number | null;
  categories: Array<{ category: string; subcategory: string; active: number; avgPrice: number | null; newThisWeek: number }>;
}

function LocationExplorer({ rows }: { rows: LocationRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAllCities, setShowAllCities] = useState(false);

  if (!rows || rows.length === 0) return null;

  const cityMap: Record<string, CityData> = {};
  for (const row of rows) {
    if (!cityMap[row.city]) cityMap[row.city] = { totalActive: 0, totalNew: 0, avgPrice: null, locations: {} };
    const city = cityMap[row.city];
    city.totalActive += row.active;
    city.totalNew += row.newThisWeek;
    const locKey = row.location || '_other';
    if (!city.locations[locKey]) city.locations[locKey] = { totalActive: 0, totalNew: 0, avgPrice: null, categories: [] };
    const loc = city.locations[locKey];
    loc.totalActive += row.active;
    loc.totalNew += row.newThisWeek;
    loc.categories.push({ category: row.category, subcategory: row.subcategory, active: row.active, avgPrice: row.avgPrice, newThisWeek: row.newThisWeek });
  }

  for (const city of Object.values(cityMap)) {
    let wSum = 0, wTotal = 0;
    for (const loc of Object.values(city.locations)) {
      const priced = loc.categories.filter(c => c.avgPrice != null);
      if (priced.length > 0) {
        const ws = priced.reduce((s, c) => s + (c.avgPrice! * c.active), 0);
        const ta = priced.reduce((s, c) => s + c.active, 0);
        loc.avgPrice = ta > 0 ? ws / ta : null;
        wSum += ws; wTotal += ta;
      }
    }
    city.avgPrice = wTotal > 0 ? wSum / wTotal : null;
  }

  const sortedCities = Object.entries(cityMap).sort((a, b) => b[1].totalActive - a[1].totalActive);
  const visibleCities = showAllCities ? sortedCities : sortedCities.slice(0, 10);

  const toggle = (key: string) => {
    setExpanded(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b"><h2 className="text-lg font-semibold text-gray-900">Location Explorer</h2></div>
      <div className="divide-y">
        {visibleCities.map(([cityName, city]) => {
          const cityExpanded = expanded.has(`c:${cityName}`);
          const sortedLocations = Object.entries(city.locations).sort((a, b) => b[1].totalActive - a[1].totalActive);
          return (
            <div key={cityName}>
              <button onClick={() => toggle(`c:${cityName}`)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${cityExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <Link href={`/listings?city=${encodeURIComponent(cityName)}`} onClick={e => e.stopPropagation()} className="font-medium text-gray-900 hover:text-blue-600">{cityName}</Link>
                  <span className="text-xs text-gray-400">{sortedLocations.length} areas</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">{city.totalActive.toLocaleString()} active</span>
                  <span className="text-gray-500">{formatCompactPrice(city.avgPrice)} avg</span>
                  {city.totalNew > 0 && <span className="text-xs font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">+{city.totalNew} this week</span>}
                </div>
              </button>
              {cityExpanded && (() => {
                const showAll = expanded.has(`showAll:${cityName}`);
                const visible = showAll ? sortedLocations : sortedLocations.slice(0, 10);
                const hidden = sortedLocations.length - 10;
                return (
                  <div className="border-t bg-gray-50">
                    {visible.map(([locKey, loc]) => {
                      const locName = locKey === '_other' ? 'Other' : locKey;
                      const locExpanded = expanded.has(`l:${cityName}:${locKey}`);
                      const sortedCats = [...loc.categories].sort((a, b) => b.active - a.active);
                      return (
                        <div key={locKey} className="border-b border-gray-100 last:border-b-0">
                          <button onClick={() => toggle(`l:${cityName}:${locKey}`)} className="w-full flex items-center justify-between px-4 pl-10 py-2.5 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-2">
                              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${locExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              <Link href={`/listings?city=${encodeURIComponent(cityName)}&location=${encodeURIComponent(locKey === '_other' ? '' : locKey)}`} onClick={e => e.stopPropagation()} className="text-sm text-gray-800 hover:text-blue-600">{locName}</Link>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-gray-600">{loc.totalActive.toLocaleString()}</span>
                              <span className="text-gray-500">{formatCompactPrice(loc.avgPrice)}</span>
                              {loc.totalNew > 0 && <span className="text-xs text-blue-600 font-medium">+{loc.totalNew}</span>}
                            </div>
                          </button>
                          {locExpanded && (
                            <div className="bg-white border-t border-gray-100">
                              <table className="w-full text-xs">
                                <thead><tr className="text-gray-400 uppercase"><th className="text-left pl-16 pr-4 py-1.5 font-medium">Type</th><th className="text-right px-4 py-1.5 font-medium">Active</th><th className="text-right px-4 py-1.5 font-medium">Avg Price</th><th className="text-right px-4 py-1.5 font-medium">New</th></tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                  {sortedCats.map(cat => (
                                    <tr key={`${cat.category}-${cat.subcategory}`} className="hover:bg-gray-50">
                                      <td className="pl-16 pr-4 py-1.5"><Link href={`/listings?city=${encodeURIComponent(cityName)}&location=${encodeURIComponent(locKey === '_other' ? '' : locKey)}&category=${encodeURIComponent(cat.category)}&subcategory=${encodeURIComponent(cat.subcategory)}`} className="text-blue-600 hover:underline capitalize">{cat.subcategory.replace(/-/g, ' ')}</Link><span className="text-gray-400 ml-1 capitalize">({cat.category})</span></td>
                                      <td className="text-right px-4 py-1.5 text-gray-700">{cat.active}</td>
                                      <td className="text-right px-4 py-1.5 text-gray-700">{formatCompactPrice(cat.avgPrice)}</td>
                                      <td className="text-right px-4 py-1.5">{cat.newThisWeek > 0 ? <span className="text-blue-600 font-medium">+{cat.newThisWeek}</span> : <span className="text-gray-400">0</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!showAll && hidden > 0 && (
                      <button onClick={() => toggle(`showAll:${cityName}`)} className="w-full py-2.5 pl-10 text-xs text-blue-600 hover:text-blue-800 hover:bg-gray-100 transition-colors text-left">Show {hidden} more areas</button>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
        {!showAllCities && sortedCities.length > 10 && (
          <button onClick={() => setShowAllCities(true)} className="w-full py-3 text-sm text-blue-600 hover:text-blue-800 hover:bg-gray-50 transition-colors">Show {sortedCities.length - 10} more cities</button>
        )}
      </div>
    </div>
  );
}

/* ─── Saved Searches ──────────────────────────────────────────────────────── */

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

function formatFilterSummary(filtersJson: string): string {
  try {
    const filters = JSON.parse(filtersJson) as Record<string, unknown>;
    const parts: string[] = [];

    if (typeof filters.q === 'string' && filters.q) parts.push(`"${filters.q}"`);
    if (typeof filters.category === 'string' && filters.category) parts.push(filters.category);
    if (typeof filters.subcategory === 'string' && filters.subcategory) parts.push(filters.subcategory);
    if (filters.priceMin || filters.priceMax) parts.push(`$${filters.priceMin || '0'}-${filters.priceMax || '∞'}`);
    if (filters.bedroomsMin) parts.push(`${filters.bedroomsMin}+ bd`);
    if (typeof filters.location === 'string' && filters.location) parts.push(filters.location);
    if (typeof filters.province === 'string' && filters.province) parts.push(filters.province);

    return parts.join(' · ') || 'All listings';
  } catch {
    return 'All listings';
  }
}

function SavedSearchBox({ search }: { search: SavedSearchSummary }) {
  const newCount = search.newMatchCount ?? 0;
  const params = getSearchParams(search.filters);

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{search.name}</h2>
          <p className="text-sm text-gray-500">{formatFilterSummary(search.filters)}</p>
          {search.lastCheckedAt && (
            <p className="text-xs text-gray-400 mt-1">Last checked {formatRelativeDate(search.lastCheckedAt)}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {newCount > 0 && (
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {newCount} new
            </span>
          )}
          <Link href={`/listings?${params.toString()}`} className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Components ───────────────────────────────────────────────────── */

function ListingRow({ listing, isNew }: { listing: ListingItem; isNew?: boolean }) {
  return (
    <Link href={`/listings/${listing.adId}`} className={`flex items-center gap-3 p-2 rounded hover:bg-gray-50 ${isNew ? 'bg-blue-50 border border-blue-200' : ''}`}>
      {listing.thumbnail ? (
        <img src={listing.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
      ) : (
        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No img</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{listing.title || listing.adId}</p>
        <p className="text-xs text-gray-500">{listing.location}</p>
      </div>
      <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
        {listing.bedrooms != null && <span>{listing.bedrooms} bd</span>}
        {listing.bathrooms != null && <span>{listing.bathrooms} ba</span>}
        {listing.builtAreaSqm != null && <span>{formatArea(listing.builtAreaSqm)}</span>}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900">{listing.price ? formatPrice(listing.price) : '—'}</p>
        <p className="text-xs text-gray-400">{formatRelativeDate(listing.firstSeenAt)}</p>
      </div>
    </Link>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? 'text-blue-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
