'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CrawlLiveData {
  crawlRun: {
    id: number;
    type: string;
    status: string;
    category: string | null;
    subcategory: string | null;
    startedAt: string;
    finishedAt: string | null;
    elapsedSecs: number;
    isRunning: boolean;
    listingsNew: number;
    listingsUpdated: number;
    detailsCrawled: number;
    errors: number;
    durationSecs: number | null;
  };
  stats: {
    newListings: number;
    updatedListings: number;
    detailsCrawled: number;
    errors: number;
  };
  price: {
    total: number;
    avg: number;
    min: number;
    max: number;
  };
  breakdowns: {
    categories: { category: string; subcategory: string; count: number }[];
    locations: { location: string; count: number }[];
    sellers: { name: string; count: number }[];
  };
  newListings: {
    adId: string;
    title: string | null;
    price: number | null;
    currency: string | null;
    location: string | null;
    province: string | null;
    city: string | null;
    category: string;
    subcategory: string;
    bedrooms: number | null;
    bathrooms: number | null;
    area: number | null;
    sellerName: string | null;
    thumbnail: string | null;
    firstSeenAt: string;
  }[];
  updatedListings: {
    adId: string;
    title: string | null;
    price: number | null;
    currency: string | null;
    location: string | null;
    category: string;
    subcategory: string;
    sellerName: string | null;
    detailCrawled: boolean;
    updatedAt: string;
  }[];
  errors: {
    url: string;
    type: string;
    statusCode: number | null;
    message: string | null;
    occurredAt: string;
  }[];
}

function formatDuration(secs: number | null): string {
  if (secs === null || secs === undefined) return '-';
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatPrice(price: number | null): string {
  if (price === null || price === 0) return '-';
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price.toLocaleString()}`;
}

function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ElapsedTimer({ startedAt, isRunning }: { startedAt: string; isRunning: boolean }) {
  const [elapsed, setElapsed] = useState(
    Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
  );

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt, isRunning]);

  return <span className="font-mono">{formatDuration(elapsed)}</span>;
}

type Tab = 'new' | 'updated' | 'sellers' | 'errors';

export function CrawlRunDetail({ runId }: { runId: number }) {
  const [tab, setTab] = useState<Tab>('new');

  const { data, isLoading, error } = useQuery<CrawlLiveData>({
    queryKey: ['crawl-live', runId],
    queryFn: async () => {
      const res = await fetch(`/api/crawl-live?runId=${runId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: (query) => {
      return query.state.data?.crawlRun?.isRunning ? 5000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-200 rounded-lg h-16" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-24" />
          ))}
        </div>
        <div className="animate-pulse bg-gray-200 rounded-lg h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Failed to load crawl run data.</p>
        <Link href="/crawl-history" className="text-blue-600 hover:underline mt-2 inline-block">Back to history</Link>
      </div>
    );
  }

  const { crawlRun, stats, price, breakdowns, newListings, updatedListings, errors: crawlErrors } = data;
  const isRunning = crawlRun.isRunning;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'new', label: 'New Listings', count: stats.newListings },
    { key: 'updated', label: 'Updated', count: stats.updatedListings },
    { key: 'sellers', label: 'Sellers', count: breakdowns.sellers.length },
    { key: 'errors', label: 'Errors', count: stats.errors },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/crawl-history" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Crawl #{crawlRun.id}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                isRunning ? 'bg-yellow-100 text-yellow-800 animate-pulse' :
                crawlRun.status === 'completed' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {isRunning && (
                  <span className="relative flex h-2 w-2 mr-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                  </span>
                )}
                {crawlRun.status}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                crawlRun.type === 'full' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {crawlRun.type}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Started {new Date(crawlRun.startedAt).toLocaleString()}
              {crawlRun.category && <> &middot; {crawlRun.category}{crawlRun.subcategory ? ` / ${crawlRun.subcategory}` : ''}</>}
              {' '}&middot;{' '}
              <ElapsedTimer startedAt={crawlRun.startedAt} isRunning={isRunning} />
              {isRunning && <span className="text-yellow-600 ml-1">(polling every 5s)</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="New Listings" value={stats.newListings} color="text-green-600" />
        <StatCard label="Details Crawled" value={stats.detailsCrawled} color="text-blue-600" />
        <StatCard label="Updated" value={stats.updatedListings} color="text-indigo-600" />
        <StatCard label="Errors" value={stats.errors} color={stats.errors > 0 ? 'text-red-600' : 'text-gray-400'} />
      </div>

      {/* Price + Breakdowns row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Price summary */}
        {price.total > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Price Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Avg Price</span><span className="font-medium">{formatPrice(price.avg)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Min</span><span className="font-medium">{formatPrice(price.min)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Max</span><span className="font-medium">{formatPrice(price.max)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">With Price</span><span className="font-medium">{price.total}</span></div>
            </div>
          </div>
        )}

        {/* Categories */}
        {breakdowns.categories.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Categories</h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {breakdowns.categories.map((c) => (
                <div key={`${c.category}-${c.subcategory}`} className="flex justify-between text-sm">
                  <span className="text-gray-700 truncate">{c.subcategory}</span>
                  <span className="font-medium text-gray-900 ml-2">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locations */}
        {breakdowns.locations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Top Locations</h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {breakdowns.locations.map((l) => (
                <div key={l.location} className="flex justify-between text-sm">
                  <span className="text-gray-700 truncate">{l.location}</span>
                  <span className="font-medium text-gray-900 ml-2">{l.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                  tab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-0">
          {tab === 'new' && <NewListingsTab listings={newListings} />}
          {tab === 'updated' && <UpdatedListingsTab listings={updatedListings} />}
          {tab === 'sellers' && <SellersTab sellers={breakdowns.sellers} />}
          {tab === 'errors' && <ErrorsTab errors={crawlErrors} />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function NewListingsTab({ listings }: { listings: CrawlLiveData['newListings'] }) {
  if (listings.length === 0) {
    return <div className="p-8 text-center text-gray-500">No new listings yet</div>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {listings.map((l) => (
        <Link
          key={l.adId}
          href={`/listings/${l.adId}`}
          className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
        >
          {/* Thumbnail */}
          <div className="w-16 h-12 flex-shrink-0 rounded bg-gray-100 overflow-hidden">
            {l.thumbnail ? (
              <img src={l.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{l.title || l.adId}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              <span>{l.subcategory}</span>
              {l.location && <><span>&middot;</span><span>{l.location}</span></>}
              {l.sellerName && <><span>&middot;</span><span>{l.sellerName}</span></>}
            </div>
          </div>

          {/* Specs */}
          <div className="hidden md:flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
            {l.bedrooms !== null && <span>{l.bedrooms}bd</span>}
            {l.bathrooms !== null && <span>{l.bathrooms}ba</span>}
            {l.area !== null && <span>{l.area}m²</span>}
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-semibold text-gray-900">{formatPrice(l.price)}</p>
            <p className="text-xs text-gray-400">{formatTimeShort(l.firstSeenAt)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function UpdatedListingsTab({ listings }: { listings: CrawlLiveData['updatedListings'] }) {
  if (listings.length === 0) {
    return <div className="p-8 text-center text-gray-500">No updated listings yet</div>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {listings.map((l) => (
        <Link
          key={l.adId}
          href={`/listings/${l.adId}`}
          className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{l.title || l.adId}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              <span>{l.subcategory}</span>
              {l.location && <><span>&middot;</span><span>{l.location}</span></>}
              {l.sellerName && <><span>&middot;</span><span>{l.sellerName}</span></>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {l.detailCrawled && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700">detail</span>
            )}
            <span className="text-sm font-semibold text-gray-900">{formatPrice(l.price)}</span>
            <span className="text-xs text-gray-400">{formatTimeShort(l.updatedAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function SellersTab({ sellers }: { sellers: CrawlLiveData['breakdowns']['sellers'] }) {
  if (sellers.length === 0) {
    return <div className="p-8 text-center text-gray-500">No sellers found yet</div>;
  }

  const maxCount = Math.max(...sellers.map((s) => s.count), 1);

  return (
    <div className="divide-y divide-gray-100">
      {sellers.map((s) => (
        <Link
          key={s.name}
          href={`/agents/${encodeURIComponent(s.name)}`}
          className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{s.name}</p>
            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{s.count} listings</span>
        </Link>
      ))}
    </div>
  );
}

function ErrorsTab({ errors }: { errors: CrawlLiveData['errors'] }) {
  if (errors.length === 0) {
    return <div className="p-8 text-center text-gray-500">No errors</div>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {errors.map((e, i) => (
        <div key={i} className="px-5 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              e.type === 'blocked' ? 'bg-red-100 text-red-700' :
              e.type === 'http_error' ? 'bg-orange-100 text-orange-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {e.type}{e.statusCode ? ` ${e.statusCode}` : ''}
            </span>
            <span className="text-xs text-gray-400">{formatTimeShort(e.occurredAt)}</span>
          </div>
          <p className="text-sm text-gray-700 truncate">{e.url}</p>
          {e.message && <p className="text-xs text-gray-500 truncate mt-0.5">{e.message}</p>}
        </div>
      ))}
    </div>
  );
}
