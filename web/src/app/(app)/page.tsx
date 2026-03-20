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

interface DashboardData {
  stats: {
    totalListings: number;
    newToday: number;
    newThisWeek: number;
    totalFavorites: number;
  };
  marketSummary: {
    activeListings: number;
    removedListings: number;
    avgPrice: number | null;
    activeSellers: number;
  };
  categoryBreakdown: CategoryRow[];
  locationBreakdown: LocationRow[];
  latestListings: ListingItem[];
  savedSearches: Array<{
    id: number;
    name: string;
    filters: string;
    listings: ListingItem[];
  }>;
  lastCrawl: {
    startedAt: string;
    finishedAt: string | null;
    status: string;
    listingsFound: number;
    listingsNew: number;
    durationSecs: number | null;
  } | null;
}

function formatCompactPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price.toFixed(0)}`;
}

export default function DashboardPage() {
  useUser({ or: 'redirect' });
  const [tab, setTab] = useState<'overview' | 'searches'>('overview');
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then(r => r.json()),
  });

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  const savedSearches = data.savedSearches ?? [];
  const lastCrawlStart = data.lastCrawl?.startedAt ?? null;
  const market = data.marketSummary;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Market Overview
        </button>
        <button
          onClick={() => setTab('searches')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'searches'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Saved Searches
          {savedSearches.length > 0 && (
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {savedSearches.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Listings" value={market.activeListings.toLocaleString()} />
            <StatCard label="New This Week" value={data.stats.newThisWeek.toLocaleString()} accent />
            <StatCard label="Avg Price" value={formatCompactPrice(market.avgPrice)} />
            <StatCard label="Active Sellers" value={market.activeSellers.toLocaleString()} />
          </div>

          {/* Location Explorer (with category breakdown per location) */}
          <LocationExplorer rows={data.locationBreakdown} />

          {/* Category Breakdown */}
          <CategoryBreakdown rows={data.categoryBreakdown} />

          {/* Newest Properties */}
          {(data.latestListings ?? []).length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Newest Properties</h2>
                <Link href="/listings?sort=newest" className="text-sm text-blue-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {data.latestListings.map(listing => (
                  <ListingRow key={listing.adId} listing={listing} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'searches' && (
        <div className="space-y-6">
          {savedSearches.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center">
              <p className="text-gray-500">No saved searches yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Save a search from the{' '}
                <Link href="/listings" className="text-blue-600 hover:underline">listings page</Link>
                {' '}to track new matches.
              </p>
            </div>
          ) : (
            savedSearches.map(search => (
              <SavedSearchBox
                key={search.id}
                search={search}
                lastCrawlStart={lastCrawlStart}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Category Breakdown ──────────────────────────────────────────────────── */

function CategoryBreakdown({ rows }: { rows: CategoryRow[] }) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  if (!rows || rows.length === 0) return null;

  // Group by category
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
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium text-gray-900 capitalize">{category}</span>
                  <span className="text-xs text-gray-400">{subcategories.length} subcategories</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">{catTotal.toLocaleString()} active</span>
                  <span className="text-gray-500">{formatCompactPrice(catAvgPrice)} avg</span>
                  {catNewWeek > 0 && (
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                      +{catNewWeek} this week
                    </span>
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
                            <Link
                              href={`/listings?category=${encodeURIComponent(row.category)}&subcategory=${encodeURIComponent(row.subcategory)}`}
                              className="text-blue-600 hover:underline capitalize"
                            >
                              {row.subcategory.replace(/-/g, ' ')}
                            </Link>
                          </td>
                          <td className="text-right px-4 py-2 text-gray-700">{row.active.toLocaleString()}</td>
                          <td className="text-right px-4 py-2 text-gray-700">{formatCompactPrice(row.avgPrice)}</td>
                          <td className="text-right px-4 py-2 text-gray-500 hidden sm:table-cell">{formatCompactPrice(row.minPrice)}</td>
                          <td className="text-right px-4 py-2 text-gray-500 hidden sm:table-cell">{formatCompactPrice(row.maxPrice)}</td>
                          <td className="text-right px-4 py-2">
                            {row.newThisWeek > 0 ? (
                              <span className="text-blue-600 font-medium">+{row.newThisWeek}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
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

  if (!rows || rows.length === 0) return null;

  // Build city → location → category hierarchy
  const cityMap: Record<string, CityData> = {};
  for (const row of rows) {
    if (!cityMap[row.city]) {
      cityMap[row.city] = { totalActive: 0, totalNew: 0, avgPrice: null, locations: {} };
    }
    const city = cityMap[row.city];
    city.totalActive += row.active;
    city.totalNew += row.newThisWeek;

    const locKey = row.location || '_other';
    if (!city.locations[locKey]) {
      city.locations[locKey] = { totalActive: 0, totalNew: 0, avgPrice: null, categories: [] };
    }
    const loc = city.locations[locKey];
    loc.totalActive += row.active;
    loc.totalNew += row.newThisWeek;
    loc.categories.push({
      category: row.category,
      subcategory: row.subcategory,
      active: row.active,
      avgPrice: row.avgPrice,
      newThisWeek: row.newThisWeek,
    });
  }

  // Compute weighted avg prices
  for (const city of Object.values(cityMap)) {
    let cityWeightedSum = 0, cityTotalActive = 0;
    for (const loc of Object.values(city.locations)) {
      const priced = loc.categories.filter(c => c.avgPrice != null);
      if (priced.length > 0) {
        const weightedSum = priced.reduce((s, c) => s + (c.avgPrice! * c.active), 0);
        const totalAct = priced.reduce((s, c) => s + c.active, 0);
        loc.avgPrice = totalAct > 0 ? weightedSum / totalAct : null;
        cityWeightedSum += weightedSum;
        cityTotalActive += totalAct;
      }
    }
    city.avgPrice = cityTotalActive > 0 ? cityWeightedSum / cityTotalActive : null;
  }

  const sortedCities = Object.entries(cityMap).sort((a, b) => b[1].totalActive - a[1].totalActive);
  const [showAllCities, setShowAllCities] = useState(false);
  const visibleCities = showAllCities ? sortedCities : sortedCities.slice(0, 10);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Location Explorer</h2>
      </div>
      <div className="divide-y">
        {visibleCities.map(([cityName, city]) => {
          const cityExpanded = expanded.has(`c:${cityName}`);
          const sortedLocations = Object.entries(city.locations)
            .sort((a, b) => b[1].totalActive - a[1].totalActive);

          return (
            <div key={cityName}>
              {/* City row */}
              <button
                onClick={() => toggle(`c:${cityName}`)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${cityExpanded ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <Link
                    href={`/listings?city=${encodeURIComponent(cityName)}`}
                    onClick={e => e.stopPropagation()}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {cityName}
                  </Link>
                  <span className="text-xs text-gray-400">{sortedLocations.length} areas</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">{city.totalActive.toLocaleString()} active</span>
                  <span className="text-gray-500">{formatCompactPrice(city.avgPrice)} avg</span>
                  {city.totalNew > 0 && (
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                      +{city.totalNew} this week
                    </span>
                  )}
                </div>
              </button>

              {/* Locations within city */}
              {cityExpanded && (() => {
                const showAllAreas = expanded.has(`showAll:${cityName}`);
                const visibleLocations = showAllAreas ? sortedLocations : sortedLocations.slice(0, 10);
                const hiddenCount = sortedLocations.length - 10;

                return (
                <div className="border-t bg-gray-50">
                  {visibleLocations.map(([locKey, loc]) => {
                    const locName = locKey === '_other' ? 'Other' : locKey;
                    const locExpanded = expanded.has(`l:${cityName}:${locKey}`);
                    const sortedCats = [...loc.categories].sort((a, b) => b.active - a.active);

                    return (
                      <div key={locKey} className="border-b border-gray-100 last:border-b-0">
                        {/* Location row */}
                        <button
                          onClick={() => toggle(`l:${cityName}:${locKey}`)}
                          className="w-full flex items-center justify-between px-4 pl-10 py-2.5 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <svg
                              className={`w-3.5 h-3.5 text-gray-400 transition-transform ${locExpanded ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <Link
                              href={`/listings?city=${encodeURIComponent(cityName)}&location=${encodeURIComponent(locKey === '_other' ? '' : locKey)}`}
                              onClick={e => e.stopPropagation()}
                              className="text-sm text-gray-800 hover:text-blue-600"
                            >
                              {locName}
                            </Link>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-600">{loc.totalActive.toLocaleString()}</span>
                            <span className="text-gray-500">{formatCompactPrice(loc.avgPrice)}</span>
                            {loc.totalNew > 0 && (
                              <span className="text-xs text-blue-600 font-medium">+{loc.totalNew}</span>
                            )}
                          </div>
                        </button>

                        {/* Category breakdown within location */}
                        {locExpanded && (
                          <div className="bg-white border-t border-gray-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400 uppercase">
                                  <th className="text-left pl-16 pr-4 py-1.5 font-medium">Type</th>
                                  <th className="text-right px-4 py-1.5 font-medium">Active</th>
                                  <th className="text-right px-4 py-1.5 font-medium">Avg Price</th>
                                  <th className="text-right px-4 py-1.5 font-medium">New</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {sortedCats.map(cat => (
                                  <tr key={`${cat.category}-${cat.subcategory}`} className="hover:bg-gray-50">
                                    <td className="pl-16 pr-4 py-1.5">
                                      <Link
                                        href={`/listings?city=${encodeURIComponent(cityName)}&location=${encodeURIComponent(locKey === '_other' ? '' : locKey)}&category=${encodeURIComponent(cat.category)}&subcategory=${encodeURIComponent(cat.subcategory)}`}
                                        className="text-blue-600 hover:underline capitalize"
                                      >
                                        {cat.subcategory.replace(/-/g, ' ')}
                                      </Link>
                                      <span className="text-gray-400 ml-1 capitalize">({cat.category})</span>
                                    </td>
                                    <td className="text-right px-4 py-1.5 text-gray-700">{cat.active}</td>
                                    <td className="text-right px-4 py-1.5 text-gray-700">{formatCompactPrice(cat.avgPrice)}</td>
                                    <td className="text-right px-4 py-1.5">
                                      {cat.newThisWeek > 0 ? (
                                        <span className="text-blue-600 font-medium">+{cat.newThisWeek}</span>
                                      ) : (
                                        <span className="text-gray-400">0</span>
                                      )}
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
                  {!showAllAreas && hiddenCount > 0 && (
                    <button
                      onClick={() => toggle(`showAll:${cityName}`)}
                      className="w-full py-2.5 pl-10 text-xs text-blue-600 hover:text-blue-800 hover:bg-gray-100 transition-colors text-left"
                    >
                      Show {hiddenCount} more areas
                    </button>
                  )}
                </div>
                );
              })()}
            </div>
          );
        })}
        {!showAllCities && sortedCities.length > 10 && (
          <button
            onClick={() => setShowAllCities(true)}
            className="w-full py-3 text-sm text-blue-600 hover:text-blue-800 hover:bg-gray-50 transition-colors"
          >
            Show {sortedCities.length - 10} more cities
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Saved Searches ──────────────────────────────────────────────────────── */

function SavedSearchBox({ search, lastCrawlStart }: {
  search: { id: number; name: string; filters: string; listings: ListingItem[] };
  lastCrawlStart: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const searchListings = search.listings ?? [];
  const newCount = lastCrawlStart
    ? searchListings.filter(l => l.firstSeenAt >= lastCrawlStart).length
    : 0;
  const visible = expanded ? searchListings : searchListings.slice(0, 5);
  const hasMore = searchListings.length > 5;

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">{search.name}</h2>
        <div className="flex items-center gap-3">
          {newCount > 0 && (
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {newCount} new
            </span>
          )}
          <Link
            href={`/listings?${new URLSearchParams(JSON.parse(search.filters)).toString()}`}
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>
      </div>
      {searchListings.length === 0 ? (
        <p className="text-gray-500 text-sm">No listings match this search.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(listing => (
            <ListingRow
              key={listing.adId}
              listing={listing}
              isNew={!!lastCrawlStart && listing.firstSeenAt >= lastCrawlStart}
            />
          ))}
          {hasMore && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-sm text-blue-600 hover:text-blue-800 py-2"
            >
              Show {searchListings.length - 5} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Shared Components ───────────────────────────────────────────────────── */

function ListingRow({ listing, isNew }: { listing: ListingItem; isNew?: boolean }) {
  return (
    <Link
      href={`/listings/${listing.adId}`}
      className={`flex items-center gap-3 p-2 rounded hover:bg-gray-50 ${isNew ? 'bg-blue-50 border border-blue-200' : ''}`}
    >
      {listing.thumbnail ? (
        <img src={listing.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
      ) : (
        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
          No img
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {listing.title || listing.adId}
        </p>
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
