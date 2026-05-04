'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import Link from 'next/link';
import { formatRelativeDate } from '@/lib/formatters';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

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

interface SummaryData {
  stats: {
    activeListings: number;
    newToday: number;
    newThisWeek: number;
    totalFavorites: number;
    avgPriceSale: number | null;
    avgPriceRent: number | null;
    activeSellers: number;
  };
  latestListings: ListingItem[];
  lastCrawl: {
    status: string;
    startedAt: string;
    durationSecs: number | null;
    listingsNew: number;
  } | null;
}

interface SavedSearchPreview {
  id: number;
  name: string;
  filters: string;
  listings: ListingItem[];
}

interface SearchesData {
  savedSearches: SavedSearchPreview[];
  lastCrawlStart: string | null;
}

interface TrendsData {
  dailyTrend: Array<{ day: string; added: number; removed: number }>;
  topCities: Array<{ city: string; active: number; newThisWeek: number; avgSale: number | null; avgRent: number | null }>;
  recentCrawls: Array<{ id: number; status: string; startedAt: string; listingsNew: number; durationSecs: number | null }>;
  priceDistribution: Array<{ bucket: string; count: number }>;
  categoryShare: Array<{ category: string; active: number }>;
}

const PALETTE = {
  ink: '#1a1a1a',
  sage: '#6b8e6b',
  sageDeep: '#4a6b4a',
  sageSoft: '#c8dcc7',
  sand: '#c9b896',
  sandSoft: '#ebe4cd',
  slate: '#94a3b8',
  slateSoft: '#cfd8e3',
};

function compactPrice(p: number | null | undefined): string {
  if (p == null) return '—';
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}K`;
  return `$${Math.round(p)}`;
}

function formatDayLabel(iso: unknown): string {
  if (typeof iso !== 'string') return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

function formatFilterSummary(filtersJson: string): Array<{ key: string; label: string }> {
  try {
    const f = JSON.parse(filtersJson) as Record<string, unknown>;
    const chips: Array<{ key: string; label: string }> = [];
    if (typeof f.q === 'string' && f.q) chips.push({ key: 'q', label: `"${f.q}"` });
    if (typeof f.category === 'string' && f.category) chips.push({ key: 'cat', label: f.category });
    if (typeof f.subcategory === 'string' && f.subcategory) chips.push({ key: 'sub', label: f.subcategory.replace(/-/g, ' ') });
    if (f.priceMin || f.priceMax) chips.push({ key: 'price', label: `$${f.priceMin || '0'}–$${f.priceMax || '∞'}` });
    if (f.bedroomsMin) chips.push({ key: 'bd', label: `${f.bedroomsMin}+ bd` });
    if (typeof f.location === 'string' && f.location) chips.push({ key: 'loc', label: f.location });
    if (typeof f.city === 'string' && f.city) chips.push({ key: 'city', label: f.city });
    return chips;
  } catch {
    return [];
  }
}

export default function AuroraDashboard() {
  useUser({ or: 'redirect' });

  const summary = useQuery<SummaryData>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => fetch('/api/dashboard?tab=summary').then((r) => r.json()),
  });
  const trends = useQuery<TrendsData>({
    queryKey: ['dashboard', 'trends'],
    queryFn: () => fetch('/api/dashboard/trends').then((r) => r.json()),
  });
  const searches = useQuery<SearchesData>({
    queryKey: ['dashboard', 'searches'],
    queryFn: () => fetch('/api/dashboard?tab=searches').then((r) => r.json()),
  });

  return (
    <div className="relative min-h-full">
      <div className="px-8 py-10 max-w-[1400px] mx-auto">
        <Header />

        <section className="mt-10">
          <Hero summary={summary.data} loading={summary.isLoading} />
        </section>

        {/* Saved searches — the most-used feature, given hero placement */}
        <section className="mt-10">
          <SavedSearchesBoard data={searches.data} loading={searches.isLoading} />
        </section>

        <section className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2 h-full">
            <TrendChart data={trends.data?.dailyTrend ?? []} loading={trends.isLoading} />
          </div>
          <div className="h-full">
            <CategoryShare data={trends.data?.categoryShare ?? []} loading={trends.isLoading} />
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2 h-full">
            <CityGrid cities={trends.data?.topCities ?? []} loading={trends.isLoading} />
          </div>
          <div className="h-full">
            <FeaturedListings listings={summary.data?.latestListings ?? []} loading={summary.isLoading} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Header() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500 font-medium">{today}</p>
        <h1 className="mt-2 font-serif text-5xl md:text-6xl font-light tracking-tight text-stone-900 leading-[1.05]">
          Good morning.<br />
          <span className="italic text-stone-700">Here&rsquo;s your market.</span>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/listings" className="aurora-pill aurora-pill-primary">
          Browse listings →
        </Link>
        <Link href="/saved-searches" className="aurora-pill aurora-pill-ghost">
          Manage searches
        </Link>
      </div>
    </div>
  );
}

function Hero({ summary, loading }: { summary: SummaryData | undefined; loading: boolean }) {
  if (loading || !summary) {
    return <div className="h-32 rounded-3xl aurora-surface animate-pulse" />;
  }
  const s = summary.stats;

  const heroStats = [
    { label: 'Active inventory', value: s.activeListings.toLocaleString(), accent: PALETTE.sageSoft },
    { label: 'New this week', value: `+${s.newThisWeek.toLocaleString()}`, accent: PALETTE.sageSoft, badge: `+${s.newToday} today` },
    { label: 'Avg sale price', value: compactPrice(s.avgPriceSale), accent: PALETTE.sandSoft },
    { label: 'Avg rent price', value: compactPrice(s.avgPriceRent), accent: PALETTE.slateSoft },
    { label: 'Active sellers', value: s.activeSellers.toLocaleString(), accent: PALETTE.sageSoft },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {heroStats.map((h) => (
        <div
          key={h.label}
          className="group relative overflow-hidden rounded-3xl aurora-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div
            className="absolute -top-12 -right-12 h-28 w-28 rounded-full opacity-50 blur-2xl group-hover:opacity-80 transition-opacity"
            style={{ background: h.accent }}
          />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-medium">{h.label}</p>
            <p className="mt-3 font-serif text-4xl font-light text-stone-900 tracking-tight tabular-nums">{h.value}</p>
            {h.badge && (
              <span className="mt-2 inline-block aurora-chip aurora-chip-mint">
                {h.badge}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SavedSearchesBoard({ data, loading }: { data: SearchesData | undefined; loading: boolean }) {
  const [active, setActive] = useState<number | null>(null);

  if (loading) {
    return <div className="h-72 rounded-3xl aurora-surface animate-pulse" />;
  }

  const searches = data?.savedSearches ?? [];
  const lastCrawlStart = data?.lastCrawlStart ?? null;

  if (searches.length === 0) {
    return (
      <div className="rounded-3xl aurora-surface p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3"
             style={{ background: 'linear-gradient(135deg, #ecf3ec, #ebe4cd)' }}>
          <svg className="w-6 h-6 text-stone-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" />
          </svg>
        </div>
        <p className="font-serif text-2xl text-stone-900">No saved searches yet</p>
        <p className="text-sm text-stone-500 mt-1">
          Save a filter from the{' '}
          <Link href="/listings" className="text-stone-900 underline-offset-4 hover:underline">browse page</Link>{' '}
          to track new matches here.
        </p>
      </div>
    );
  }

  // Default to the search with the most new since last crawl
  const enrichedSearches = searches.map((s) => {
    const newCount = lastCrawlStart
      ? s.listings.filter((l) => l.firstSeenAt >= lastCrawlStart).length
      : 0;
    return { ...s, newCount };
  });
  const activeId = active ?? enrichedSearches[0]?.id ?? null;
  const activeSearch = enrichedSearches.find((s) => s.id === activeId) ?? enrichedSearches[0];
  const activeChips = activeSearch ? formatFilterSummary(activeSearch.filters) : [];
  const activeListings = activeSearch?.listings ?? [];
  const activeListingsVisible = activeListings.slice(0, 6);

  return (
    <div className="rounded-3xl aurora-surface overflow-hidden">
      <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/60">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Watching</p>
          <h2 className="font-serif text-2xl text-stone-900 mt-1">
            <span className="aurora-rule">Latest from your saved searches</span>
          </h2>
        </div>
        <Link href="/saved-searches" className="aurora-pill aurora-pill-ghost">
          Manage all →
        </Link>
      </div>

      {/* Search tabs */}
      <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2">
        {enrichedSearches.map((s) => {
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`aurora-pill ${isActive ? 'aurora-pill-primary' : 'aurora-pill-ghost'}`}
            >
              <span className="truncate max-w-[160px]">{s.name}</span>
              {s.newCount > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
                    isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  +{s.newCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeSearch && (
        <div className="px-6 pt-2 pb-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {activeChips.map((c) => (
              <span key={c.key} className="aurora-chip capitalize">{c.label}</span>
            ))}
            {activeChips.length === 0 && <span className="aurora-chip">All listings</span>}
            <Link
              href={`/listings?${getSearchParams(activeSearch.filters).toString()}`}
              className="ml-auto text-sm text-stone-600 hover:text-stone-900 underline-offset-4 hover:underline"
            >
              View {activeListings.length}+ matches →
            </Link>
          </div>

          {activeListingsVisible.length === 0 ? (
            <p className="text-sm text-stone-500 py-8 text-center italic">No listings match this search yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeListingsVisible.map((listing) => {
                const isNew = !!lastCrawlStart && listing.firstSeenAt >= lastCrawlStart;
                return <SavedSearchListingCard key={listing.adId} listing={listing} isNew={isNew} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SavedSearchListingCard({ listing, isNew }: { listing: ListingItem; isNew: boolean }) {
  return (
    <Link
      href={`/listings/${listing.adId}`}
      className={`group flex gap-3 p-3 rounded-2xl transition-all border ${
        isNew
          ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/60'
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
          {listing.price ? compactPrice(listing.price) : '—'}
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
}

function TrendChart({ data, loading }: { data: TrendsData['dailyTrend']; loading: boolean }) {
  if (loading) {
    return <div className="h-80 lg:h-full min-h-[20rem] rounded-3xl aurora-surface animate-pulse" />;
  }

  const total = data.reduce((s, d) => s + d.added, 0);
  const recent7 = data.slice(-7).reduce((s, d) => s + d.added, 0);
  const prior7 = data.slice(-14, -7).reduce((s, d) => s + d.added, 0);
  const wow = prior7 > 0 ? Math.round(((recent7 - prior7) / prior7) * 100) : 0;

  return (
    <div className="rounded-3xl aurora-surface p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-serif text-2xl text-stone-900">
            <span className="aurora-rule">Inventory flow</span>
          </h2>
          <p className="text-sm text-stone-500 mt-1">New listings discovered over the last 30 days</p>
        </div>
        <div className="text-right">
          <p className="font-serif text-3xl text-stone-900 tabular-nums">{total.toLocaleString()}</p>
          <p className={`text-xs font-medium mt-0.5 ${wow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {wow >= 0 ? '↑' : '↓'} {Math.abs(wow)}% week over week
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="aurora-added" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE.sage} stopOpacity={0.55} />
              <stop offset="100%" stopColor={PALETTE.sage} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="aurora-removed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE.sand} stopOpacity={0.5} />
              <stop offset="100%" stopColor={PALETTE.sand} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey="day" tickFormatter={formatDayLabel} stroke="#a8a29e" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#a8a29e" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #e7e5e4', borderRadius: 12, fontSize: 12 }}
            labelFormatter={formatDayLabel}
          />
          <Area type="monotone" dataKey="removed" stroke={PALETTE.sand} strokeWidth={2} fill="url(#aurora-removed)" />
          <Area type="monotone" dataKey="added" stroke={PALETTE.sageDeep} strokeWidth={2.5} fill="url(#aurora-added)" />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

function CategoryShare({ data, loading }: { data: TrendsData['categoryShare']; loading: boolean }) {
  if (loading) {
    return <div className="h-80 lg:h-full min-h-[20rem] rounded-3xl aurora-surface animate-pulse" />;
  }

  const COLORS = [PALETTE.sageDeep, PALETTE.sand, PALETTE.slate, PALETTE.sageSoft];
  const total = data.reduce((s, d) => s + d.active, 0);

  return (
    <div className="rounded-3xl aurora-surface p-6 h-full flex flex-col">
      <div>
        <h2 className="font-serif text-2xl text-stone-900">
          <span className="aurora-rule">Category mix</span>
        </h2>
        <p className="text-sm text-stone-500 mt-1">Active inventory split</p>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-[180px] py-3">
        <ResponsiveContainer width="100%" height="100%" minHeight={180}>
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={data}
              dataKey="active"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={3}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={d.category} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 capitalize text-stone-700">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {d.category.replace('_', ' ')}
            </span>
            <span className="text-stone-500 tabular-nums">
              {((d.active / total) * 100).toFixed(0)}%
              <span className="text-stone-400 ml-2">{d.active.toLocaleString()}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturedListings({ listings, loading }: { listings: ListingItem[]; loading: boolean }) {
  if (loading) {
    return <div className="h-96 rounded-3xl aurora-surface animate-pulse" />;
  }

  const featured = listings.slice(0, 5);

  return (
    <div className="rounded-3xl aurora-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl text-stone-900">
            <span className="aurora-rule">Newest</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">Across the whole market</p>
        </div>
        <Link href="/listings?sort=newest" className="text-sm text-stone-600 hover:text-stone-900 underline-offset-4 hover:underline">
          See all →
        </Link>
      </div>
      <div className="space-y-2">
        {featured.map((l) => (
          <Link
            key={l.adId}
            href={`/listings/${l.adId}`}
            className="group flex gap-3 p-2 rounded-2xl hover:bg-white/60 transition-all"
          >
            <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-stone-100">
              {l.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-stone-100 to-stone-200" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-serif text-base text-stone-900 leading-tight">{compactPrice(l.price)}</p>
              <p className="text-xs text-stone-700 truncate">{l.title || l.adId}</p>
              <p className="text-[11px] text-stone-500 truncate">{l.location || '—'}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">{formatRelativeDate(l.firstSeenAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CityGrid({ cities, loading }: { cities: TrendsData['topCities']; loading: boolean }) {
  const max = useMemo(() => Math.max(1, ...cities.map((c) => c.active)), [cities]);

  if (loading) {
    return <div className="h-64 rounded-3xl aurora-surface animate-pulse" />;
  }

  return (
    <div className="rounded-3xl aurora-surface p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-serif text-2xl text-stone-900">
            <span className="aurora-rule">Cities at a glance</span>
          </h2>
          <p className="text-sm text-stone-500 mt-1">Where the inventory lives</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cities.map((c) => {
          const pct = (c.active / max) * 100;
          return (
            <Link
              key={c.city}
              href={`/listings?city=${encodeURIComponent(c.city)}`}
              className="group p-4 rounded-2xl bg-white/55 hover:bg-white border border-stone-200/60 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <p className="font-serif text-lg text-stone-900 group-hover:text-stone-700">{c.city}</p>
                {c.newThisWeek > 0 && (
                  <span className="aurora-chip aurora-chip-mint">+{c.newThisWeek}</span>
                )}
              </div>
              <p className="text-2xl font-serif text-stone-900 mt-1.5 tabular-nums">{c.active.toLocaleString()}</p>
              <p className="text-[11px] text-stone-500 uppercase tracking-wider">active</p>
              <div className="mt-2.5 h-1 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(to right, #6b8e6b, #c9b896)',
                  }}
                />
              </div>
              <div className="mt-3 flex justify-between text-[11px] text-stone-500">
                <span>Sale {compactPrice(c.avgSale)}</span>
                <span>Rent {compactPrice(c.avgRent)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
