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

interface DashboardData {
  stats: {
    totalListings: number;
    newToday: number;
    newThisWeek: number;
    totalFavorites: number;
  };
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

export default function DashboardPage() {
  useUser({ or: 'redirect' });
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then(r => r.json()),
  });

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const savedSearches = data.savedSearches ?? [];
  const lastCrawlStart = data.lastCrawl?.startedAt ?? null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Listings" value={data.stats.totalListings.toLocaleString()} />
        <StatCard label="New Today" value={data.stats.newToday.toLocaleString()} accent />
        <StatCard label="New This Week" value={data.stats.newThisWeek.toLocaleString()} />
        <StatCard label="Favorites" value={data.stats.totalFavorites.toLocaleString()} />
      </div>

      {savedSearches.length > 0 && (
        <div className="space-y-6 mb-6">
          {savedSearches.map(search => (
            <SavedSearchBox
              key={search.id}
              search={search}
              lastCrawlStart={lastCrawlStart}
            />
          ))}
        </div>
      )}

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
  );
}

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
