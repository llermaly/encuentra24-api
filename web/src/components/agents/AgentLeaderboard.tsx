'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { formatPrice } from '@/lib/formatters';

interface AgencyRow {
  name: string;
  type: string | null;
  verified: boolean;
  listingCount: number;
  totalListingCount: number;
  portfolioValue: number;
  avgPrice: number;
  agentCount: number;
  primaryLocation: string | null;
  whatsapp: string | null;
  rank: number;
}

interface AgentRow {
  name: string;
  agency: string;
  listingCount: number;
  portfolioValue: number;
  avgPrice: number;
  rank: number;
}

interface ApiResponse {
  view: string;
  stats: {
    totalSellers: number;
    totalIndividualAgents: number;
    totalPortfolioValue: number;
    avgListingsPerSeller: number;
  };
  data: (AgencyRow | AgentRow)[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  locations?: { value: string; count: number }[];
}

const SORT_OPTIONS = [
  { value: 'listings_desc', label: 'Most listings' },
  { value: 'listings_asc', label: 'Fewest listings' },
  { value: 'value_desc', label: 'Highest portfolio value' },
  { value: 'avg_price_desc', label: 'Highest avg price' },
  { value: 'name_asc', label: 'Name A–Z' },
];

function compactPrice(p: number | null | undefined): string {
  if (p == null) return '—';
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}K`;
  return `$${Math.round(p)}`;
}

export function AgentLeaderboard() {
  const [view, setView] = useState<'agencies' | 'agents'>('agencies');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [location, setLocation] = useState('');
  const [sort, setSort] = useState('listings_desc');
  const [page, setPage] = useState(1);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (search === debouncedSearch) return;
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const queryString = new URLSearchParams({
    view,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(location && { location }),
    sort,
    page: String(page),
    limit: '25',
  }).toString();

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['agents', queryString],
    queryFn: () => fetch(`/api/agents?${queryString}`).then(r => r.json()),
  });

  const stats = data?.stats;
  const rows = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Agencies / sellers" value={stats ? stats.totalSellers.toLocaleString() : '—'} />
        <StatCard label="Individual agents" value={stats ? stats.totalIndividualAgents.toLocaleString() : '—'} />
        <StatCard label="Total portfolio value" value={stats ? compactPrice(stats.totalPortfolioValue) : '—'} />
        <StatCard label="Avg listings / seller" value={stats ? String(stats.avgListingsPerSeller) : '—'} />
      </div>

      {/* Top performers — only on first page, no search/filter */}
      {!isLoading && rows.length > 0 && page === 1 && !debouncedSearch && view === 'agencies' && (
        <div className="mb-6">
          <h2 className="font-serif text-xl text-stone-900 mb-3">
            <span className="aurora-rule">Top performers</span>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {(rows as AgencyRow[]).slice(0, 5).map((agent, i) => (
              <Link
                key={agent.name}
                href={`/agents/${encodeURIComponent(agent.name)}`}
                className="group relative rounded-2xl aurora-surface p-4 overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all"
              >
                <div
                  className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-50 blur-2xl group-hover:opacity-80 transition-opacity"
                  style={{ background: i === 0 ? '#c8dcc7' : i === 1 ? '#ebe4cd' : i === 2 ? '#cfd8e3' : '#e7e5e4' }}
                />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-serif text-stone-900 text-2xl">
                      {i === 0 ? '①' : i === 1 ? '②' : i === 2 ? '③' : `#${i + 1}`}
                    </span>
                  </div>
                  <p className="font-serif text-base text-stone-900 truncate">{agent.name}</p>
                  <p className="text-xs text-stone-500 truncate mt-0.5">{agent.primaryLocation || 'Various areas'}</p>
                  <div className="mt-3 flex items-baseline gap-3 text-stone-700">
                    <span className="font-serif text-xl tabular-nums">{agent.listingCount}</span>
                    <span className="text-[10px] uppercase tracking-wider text-stone-500">listings</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5 tabular-nums">{compactPrice(agent.portfolioValue)} portfolio</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="aurora-surface rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex bg-white/70 rounded-full p-0.5 border border-stone-200/60">
          <button
            onClick={() => { setView('agencies'); setPage(1); setSearch(''); setDebouncedSearch(''); setLocation(''); }}
            className={`px-3.5 py-1.5 text-sm rounded-full transition-colors ${
              view === 'agencies' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Agencies
          </button>
          <button
            onClick={() => { setView('agents'); setPage(1); setSearch(''); setDebouncedSearch(''); setLocation(''); }}
            className={`px-3.5 py-1.5 text-sm rounded-full transition-colors ${
              view === 'agents' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Individual agents
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={view === 'agencies' ? 'Search agencies…' : 'Search agents…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="aurora-input w-full pl-9"
          />
        </div>

        <LocationCombobox
          locations={data?.locations || []}
          value={location}
          onChange={(val) => { setLocation(val); setPage(1); }}
        />

        <select
          value={sort}
          onChange={e => { setSort(e.target.value); setPage(1); }}
          className="aurora-input"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl aurora-surface overflow-hidden">
        <div className="overflow-x-auto">
          {view === 'agencies' ? (
            <AgenciesTable rows={rows as AgencyRow[]} isLoading={isLoading} />
          ) : (
            <AgentsTable rows={rows as AgentRow[]} isLoading={isLoading} />
          )}
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="aurora-pill aurora-pill-ghost disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <div className="aurora-surface px-4 py-2 rounded-full text-sm text-stone-700">
            <span className="font-serif text-stone-900">{pagination.page}</span>
            <span className="text-stone-400 mx-2">/</span>
            <span className="text-stone-500">{pagination.totalPages}</span>
          </div>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="aurora-pill aurora-pill-ghost disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function AgenciesTable({ rows, isLoading }: { rows: AgencyRow[]; isLoading: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200/60">
          <th className="px-4 py-3 w-12">#</th>
          <th className="px-4 py-3 font-medium">Name</th>
          <th className="px-4 py-3 font-medium">Type</th>
          <th className="px-4 py-3 text-right font-medium">Agents</th>
          <th className="px-4 py-3 text-right font-medium">Listings</th>
          <th className="px-4 py-3 text-right font-medium">Portfolio</th>
          <th className="px-4 py-3 text-right font-medium">Avg price</th>
          <th className="px-4 py-3 font-medium">Primary area</th>
          <th className="px-4 py-3 text-center font-medium">✓</th>
          <th className="px-4 py-3 text-center font-medium">WA</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <tr key={i} className="border-b border-stone-200/40">
              <td colSpan={10} className="px-4 py-3"><div className="h-4 bg-stone-200/60 rounded animate-pulse" /></td>
            </tr>
          ))
        ) : rows.length === 0 ? (
          <tr><td colSpan={10} className="px-4 py-12 text-center text-stone-500 italic">No results found</td></tr>
        ) : rows.map(row => (
          <tr key={row.name} className="border-b border-stone-200/40 last:border-0 hover:bg-white/50 transition-colors">
            <td className="px-4 py-3 text-stone-400 tabular-nums">{row.rank}</td>
            <td className="px-4 py-3">
              <Link href={`/agents/${encodeURIComponent(row.name)}`} className="font-medium text-stone-900 underline-offset-4 hover:underline">
                {row.name}
              </Link>
            </td>
            <td className="px-4 py-3">
              {row.type && <span className="aurora-chip capitalize">{row.type}</span>}
            </td>
            <td className="px-4 py-3 text-right text-stone-600 tabular-nums">{row.agentCount || '—'}</td>
            <td className="px-4 py-3 text-right font-medium text-stone-900 tabular-nums">
              {row.listingCount}
              {row.totalListingCount > row.listingCount && (
                <span className="text-xs text-stone-400 ml-1">/ {row.totalListingCount}</span>
              )}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-stone-700">{compactPrice(row.portfolioValue)}</td>
            <td className="px-4 py-3 text-right tabular-nums text-stone-700">{compactPrice(row.avgPrice)}</td>
            <td className="px-4 py-3 text-stone-600 text-xs truncate max-w-[180px]">{row.primaryLocation || '—'}</td>
            <td className="px-4 py-3 text-center">{row.verified && <span className="text-emerald-600">✓</span>}</td>
            <td className="px-4 py-3 text-center">{row.whatsapp && <span className="text-emerald-600">✓</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AgentsTable({ rows, isLoading }: { rows: AgentRow[]; isLoading: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200/60">
          <th className="px-4 py-3 w-12">#</th>
          <th className="px-4 py-3 font-medium">Agent name</th>
          <th className="px-4 py-3 font-medium">Agency</th>
          <th className="px-4 py-3 text-right font-medium">Listings</th>
          <th className="px-4 py-3 text-right font-medium">Portfolio</th>
          <th className="px-4 py-3 text-right font-medium">Avg price</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <tr key={i} className="border-b border-stone-200/40">
              <td colSpan={6} className="px-4 py-3"><div className="h-4 bg-stone-200/60 rounded animate-pulse" /></td>
            </tr>
          ))
        ) : rows.length === 0 ? (
          <tr><td colSpan={6} className="px-4 py-12 text-center text-stone-500 italic">No results found</td></tr>
        ) : rows.map(row => (
          <tr key={`${row.name}-${row.agency}`} className="border-b border-stone-200/40 last:border-0 hover:bg-white/50 transition-colors">
            <td className="px-4 py-3 text-stone-400 tabular-nums">{row.rank}</td>
            <td className="px-4 py-3 font-medium text-stone-900">{row.name}</td>
            <td className="px-4 py-3">
              <Link href={`/agents/${encodeURIComponent(row.agency)}`} className="text-stone-700 underline-offset-4 hover:underline text-sm">
                {row.agency}
              </Link>
            </td>
            <td className="px-4 py-3 text-right font-medium text-stone-900 tabular-nums">{row.listingCount}</td>
            <td className="px-4 py-3 text-right tabular-nums text-stone-700">{compactPrice(row.portfolioValue)}</td>
            <td className="px-4 py-3 text-right tabular-nums text-stone-700">{compactPrice(row.avgPrice)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="aurora-surface rounded-2xl p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-medium">{label}</p>
      <p className="font-serif text-3xl font-light text-stone-900 mt-2 tabular-nums">{value}</p>
    </div>
  );
}

function LocationCombobox({
  locations,
  value,
  onChange,
}: {
  locations: { value: string; count: number }[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return locations;
    const q = query.toLowerCase();
    return locations.filter((l) => l.value.toLowerCase().includes(q));
  }, [locations, query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="aurora-input flex items-center gap-1.5 min-w-[180px]"
      >
        <span className={`truncate flex-1 text-left ${value ? 'text-stone-900' : 'text-stone-500'}`}>
          {value || 'All areas'}
        </span>
        <svg className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-72 rounded-2xl shadow-xl aurora-surface-strong overflow-hidden">
          <div className="p-2 border-b border-stone-200/60">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type to filter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="aurora-input w-full text-sm"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-emerald-50/70 ${
                !value ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-stone-700'
              }`}
            >
              All areas
            </button>
            {filtered.map((loc) => (
              <button
                key={loc.value}
                onClick={() => { onChange(loc.value); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50/70 flex justify-between transition-colors ${
                  value === loc.value ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-stone-700'
                }`}
              >
                <span className="truncate">{loc.value}</span>
                <span className="text-stone-400 text-xs ml-2 flex-shrink-0 tabular-nums">{loc.count}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-stone-400 text-center italic">No matching areas</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
