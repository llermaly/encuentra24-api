'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface NewListing {
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
}

interface UpdatedListing {
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
}

interface CrawlError {
  url: string;
  type: string;
  statusCode: number | null;
  message: string | null;
  occurredAt: string;
}

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
  };
  stats: {
    newListings: number;
    updatedListings: number;
    detailsCrawled: number;
    errors: number;
    removed: number;
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
  newListings: { data: NewListing[]; pagination: Pagination };
  updatedListings: { data: UpdatedListing[]; pagination: Pagination };
  errors: { data: CrawlError[]; pagination: Pagination };
  removedListings: {
    data: {
      adId: string;
      title: string | null;
      price: number | null;
      currency: string | null;
      location: string | null;
      category: string;
      subcategory: string;
      sellerName: string | null;
      removedAt: string;
      lastSeenAt: string;
    }[];
    pagination: Pagination;
  };
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

type Tab = 'new' | 'updated' | 'removed' | 'sellers' | 'errors';

export function CrawlRunDetail({ runId }: { runId: number }) {
  const [tab, setTab] = useState<Tab>('new');
  const [newPage, setNewPage] = useState(1);
  const [updatedPage, setUpdatedPage] = useState(1);
  const [removedPage, setRemovedPage] = useState(1);
  const [errorsPage, setErrorsPage] = useState(1);
  const [cancelling, setCancelling] = useState(false);
  const queryClient = useQueryClient();

  async function handleCancel() {
    if (!confirm('Mark this crawl run as cancelled?')) return;
    setCancelling(true);
    try {
      await fetch('/api/crawl-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, action: 'cancel' }),
      });
      queryClient.invalidateQueries({ queryKey: ['crawl-live', runId] });
    } finally {
      setCancelling(false);
    }
  }

  const { data, isLoading, error } = useQuery<CrawlLiveData>({
    queryKey: ['crawl-live', runId, newPage, updatedPage, removedPage, errorsPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        runId: String(runId),
        newPage: String(newPage),
        updatedPage: String(updatedPage),
        removedPage: String(removedPage),
        errorsPage: String(errorsPage),
      });
      const res = await fetch(`/api/crawl-live?${params}`);
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
        <div className="animate-pulse aurora-surface h-16" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse aurora-surface h-24" />
          ))}
        </div>
        <div className="animate-pulse aurora-surface h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-stone-500 italic">
        <p>Failed to load crawl run data.</p>
        <Link href="/crawl-history" className="text-stone-900 underline-offset-4 hover:underline mt-2 inline-block">Back to history</Link>
      </div>
    );
  }

  const { crawlRun, stats, price, breakdowns, newListings, updatedListings, removedListings, errors: crawlErrors } = data;
  const isRunning = crawlRun.isRunning;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'new', label: 'New listings', count: stats.newListings },
    { key: 'updated', label: 'Updated', count: stats.updatedListings },
    { key: 'removed', label: 'Removed', count: stats.removed },
    { key: 'sellers', label: 'Sellers', count: breakdowns.sellers.length },
    { key: 'errors', label: 'Errors', count: stats.errors },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <Link href="/crawl-history" className="aurora-pill aurora-pill-ghost">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to history
        </Link>
        {isRunning && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="aurora-pill aurora-pill-ghost text-rose-700 hover:text-rose-900"
          >
            {cancelling ? 'Cancelling…' : 'Cancel run'}
          </button>
        )}
      </div>

      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Run detail</p>
        <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
          Crawl <span className="italic">#{crawlRun.id}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className={
            isRunning ? 'aurora-chip aurora-chip-sand' :
            crawlRun.status === 'completed' ? 'aurora-chip aurora-chip-mint' :
            'aurora-chip aurora-chip-warn'
          }>
            {isRunning && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600" />
              </span>
            )}
            {crawlRun.status}
          </span>
          <span className={crawlRun.type === 'full' ? 'aurora-chip aurora-chip-slate capitalize' : 'aurora-chip capitalize'}>
            {crawlRun.type}
          </span>
          {crawlRun.category && (
            <span className="aurora-chip">{crawlRun.category}{crawlRun.subcategory ? ` / ${crawlRun.subcategory}` : ''}</span>
          )}
        </div>
        <p className="text-sm text-stone-500 mt-3">
          Started {new Date(crawlRun.startedAt).toLocaleString()}
          {' · '}
          <ElapsedTimer startedAt={crawlRun.startedAt} isRunning={isRunning} />
          {isRunning && <span className="text-amber-700 ml-1">(polling every 5s)</span>}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="New listings" value={stats.newListings} accent="#4a6b4a" />
        <StatCard label="Details crawled" value={stats.detailsCrawled} accent="#475569" />
        <StatCard label="Updated" value={stats.updatedListings} accent="#8b7949" />
        <StatCard label="Errors" value={stats.errors} accent={stats.errors > 0 ? '#9a3412' : '#94a3b8'} />
      </div>

      {/* Price + Breakdowns row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {price.total > 0 && (
          <div className="aurora-surface rounded-2xl p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-3">Price Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-stone-500">Avg price</span><span className="font-medium tabular-nums">{formatPrice(price.avg)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Min</span><span className="font-medium tabular-nums">{formatPrice(price.min)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Max</span><span className="font-medium tabular-nums">{formatPrice(price.max)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">With price</span><span className="font-medium tabular-nums">{price.total}</span></div>
            </div>
          </div>
        )}

        {breakdowns.categories.length > 0 && (
          <div className="aurora-surface rounded-2xl p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-3">Categories</h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {breakdowns.categories.map((c) => (
                <div key={`${c.category}-${c.subcategory}`} className="flex justify-between text-sm">
                  <span className="text-stone-700 truncate">{c.category} / {c.subcategory}</span>
                  <span className="font-medium text-stone-900 ml-2 tabular-nums">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {breakdowns.locations.length > 0 && (
          <div className="aurora-surface rounded-2xl p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-3">Top Locations</h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {breakdowns.locations.map((l) => (
                <div key={l.location} className="flex justify-between text-sm">
                  <span className="text-stone-700 truncate">{l.location}</span>
                  <span className="font-medium text-stone-900 ml-2 tabular-nums">{l.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="aurora-surface rounded-2xl">
        <div className="border-b border-stone-200/60">
          <nav className="flex -mb-px">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-300'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
                  tab === t.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-0">
          {tab === 'new' && <NewListingsTab data={newListings} onPageChange={setNewPage} />}
          {tab === 'updated' && <UpdatedListingsTab data={updatedListings} onPageChange={setUpdatedPage} />}
          {tab === 'removed' && <RemovedListingsTab data={removedListings} onPageChange={setRemovedPage} />}
          {tab === 'sellers' && <SellersTab sellers={breakdowns.sellers} />}
          {tab === 'errors' && <ErrorsTab data={crawlErrors} onPageChange={setErrorsPage} />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="aurora-surface rounded-2xl p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-medium">{label}</p>
      <p className="font-serif text-3xl font-light mt-2 tabular-nums" style={{ color: accent }}>{value.toLocaleString()}</p>
    </div>
  );
}

function PaginationControls({ pagination, onPageChange }: { pagination: Pagination; onPageChange: (p: number) => void }) {
  if (pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-stone-200/40">
      <span className="text-xs text-stone-500">
        Page <span className="font-serif text-stone-900 text-base">{pagination.page}</span> of {pagination.totalPages} <span className="text-stone-400">({pagination.total.toLocaleString()} total)</span>
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="aurora-pill aurora-pill-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
          className="aurora-pill aurora-pill-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function NewListingsTab({ data, onPageChange }: { data: CrawlLiveData['newListings']; onPageChange: (p: number) => void }) {
  if (data.data.length === 0) {
    return <div className="p-8 text-center text-stone-500 italic">No new listings yet</div>;
  }

  return (
    <>
      <div className="divide-y divide-stone-200/40">
        {data.data.map((l) => (
          <Link
            key={l.adId}
            href={`/listings/${l.adId}`}
            className="flex items-center gap-4 px-5 py-3 hover:bg-white/50 transition-colors"
          >
            <div className="w-16 h-12 flex-shrink-0 rounded-lg bg-stone-100 overflow-hidden">
              {l.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900 truncate">{l.title || l.adId}</p>
              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                <span>{l.subcategory}</span>
                {l.location && <><span>&middot;</span><span>{l.location}</span></>}
                {l.sellerName && <><span>&middot;</span><span>{l.sellerName}</span></>}
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs text-stone-500 flex-shrink-0">
              {l.bedrooms !== null && <span>{l.bedrooms}bd</span>}
              {l.bathrooms !== null && <span>{l.bathrooms}ba</span>}
              {l.area !== null && <span>{l.area}m²</span>}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-stone-900 tabular-nums">{formatPrice(l.price)}</p>
              <p className="text-xs text-stone-400">{formatTimeShort(l.firstSeenAt)}</p>
            </div>
          </Link>
        ))}
      </div>
      <PaginationControls pagination={data.pagination} onPageChange={onPageChange} />
    </>
  );
}

function UpdatedListingsTab({ data, onPageChange }: { data: CrawlLiveData['updatedListings']; onPageChange: (p: number) => void }) {
  if (data.data.length === 0) {
    return <div className="p-8 text-center text-stone-500 italic">No updated listings yet</div>;
  }

  return (
    <>
      <div className="divide-y divide-stone-200/40">
        {data.data.map((l) => (
          <Link
            key={l.adId}
            href={`/listings/${l.adId}`}
            className="flex items-center gap-4 px-5 py-3 hover:bg-white/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900 truncate">{l.title || l.adId}</p>
              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                <span>{l.subcategory}</span>
                {l.location && <><span>&middot;</span><span>{l.location}</span></>}
                {l.sellerName && <><span>&middot;</span><span>{l.sellerName}</span></>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {l.detailCrawled && (
                <span className="aurora-chip aurora-chip-slate">detail</span>
              )}
              <span className="text-sm font-semibold text-stone-900 tabular-nums">{formatPrice(l.price)}</span>
              <span className="text-xs text-stone-400">{formatTimeShort(l.updatedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
      <PaginationControls pagination={data.pagination} onPageChange={onPageChange} />
    </>
  );
}

function SellersTab({ sellers }: { sellers: CrawlLiveData['breakdowns']['sellers'] }) {
  if (sellers.length === 0) {
    return <div className="p-8 text-center text-stone-500 italic">No sellers found yet</div>;
  }

  const maxCount = Math.max(...sellers.map((s) => s.count), 1);

  return (
    <div className="divide-y divide-stone-200/40">
      {sellers.map((s) => (
        <Link
          key={s.name}
          href={`/agents/${encodeURIComponent(s.name)}`}
          className="flex items-center gap-4 px-5 py-3 hover:bg-white/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-900">{s.name}</p>
            <div className="mt-1.5 h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(s.count / maxCount) * 100}%`,
                  background: 'linear-gradient(to right, #4a6b4a, #6b8e6b)',
                }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-stone-900 tabular-nums flex-shrink-0">{s.count}</span>
        </Link>
      ))}
    </div>
  );
}

function RemovedListingsTab({ data, onPageChange }: { data: CrawlLiveData['removedListings']; onPageChange: (p: number) => void }) {
  if (data.data.length === 0) {
    return <div className="p-8 text-center text-stone-500 italic">No removed listings detected</div>;
  }

  return (
    <>
      <div className="divide-y divide-stone-200/40">
        {data.data.map((l) => (
          <Link
            key={l.adId}
            href={`/listings/${l.adId}`}
            className="flex items-center gap-4 px-5 py-3 hover:bg-rose-50/40 transition-colors bg-rose-50/20"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-rose-800 truncate">{l.title || l.adId}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>{l.subcategory}</span>
                {l.location && <><span>&middot;</span><span>{l.location}</span></>}
                {l.sellerName && <><span>&middot;</span><span>{l.sellerName}</span></>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-stone-900 tabular-nums">{formatPrice(l.price)}</p>
              <p className="text-xs text-rose-500">Removed {formatTimeShort(l.removedAt)}</p>
            </div>
          </Link>
        ))}
      </div>
      <PaginationControls pagination={data.pagination} onPageChange={onPageChange} />
    </>
  );
}

function ErrorsTab({ data, onPageChange }: { data: CrawlLiveData['errors']; onPageChange: (p: number) => void }) {
  if (data.data.length === 0) {
    return <div className="p-8 text-center text-stone-500 italic">No errors</div>;
  }

  return (
    <>
      <div className="divide-y divide-stone-200/40">
        {data.data.map((e, i) => (
          <div key={i} className="px-5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={
                e.type === 'blocked' ? 'aurora-chip aurora-chip-warn' :
                e.type === 'http_error' ? 'aurora-chip aurora-chip-warn' :
                'aurora-chip aurora-chip-slate'
              }>
                {e.type}{e.statusCode ? ` · ${e.statusCode}` : ''}
              </span>
              <span className="text-xs text-stone-400">{formatTimeShort(e.occurredAt)}</span>
            </div>
            <p className="text-sm text-stone-700 truncate">{e.url}</p>
            {e.message && <p className="text-xs text-stone-500 truncate mt-0.5">{e.message}</p>}
          </div>
        ))}
      </div>
      <PaginationControls pagination={data.pagination} onPageChange={onPageChange} />
    </>
  );
}
