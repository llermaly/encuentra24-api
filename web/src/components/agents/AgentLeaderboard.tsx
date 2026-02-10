'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { formatPrice } from '@/lib/formatters';

interface AgencyRow {
  name: string;
  type: string | null;
  verified: boolean;
  listingCount: number;
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
}

const SORT_OPTIONS = [
  { value: 'listings_desc', label: 'Most Listings' },
  { value: 'listings_asc', label: 'Fewest Listings' },
  { value: 'value_desc', label: 'Highest Value' },
  { value: 'avg_price_desc', label: 'Highest Avg Price' },
  { value: 'name_asc', label: 'Name A-Z' },
];

export function AgentLeaderboard() {
  const [view, setView] = useState<'agencies' | 'agents'>('agencies');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('listings_desc');
  const [page, setPage] = useState(1);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const queryString = new URLSearchParams({
    view,
    ...(debouncedSearch && { search: debouncedSearch }),
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
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Agencies / Sellers" value={stats?.totalSellers ?? '—'} />
        <StatCard label="Individual Agents" value={stats?.totalIndividualAgents ?? '—'} />
        <StatCard label="Total Portfolio Value" value={stats ? formatPrice(stats.totalPortfolioValue) : '—'} />
        <StatCard label="Avg Listings/Seller" value={stats?.avgListingsPerSeller ?? '—'} />
      </div>

      {/* View Tabs + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => { setView('agencies'); setPage(1); setSearch(''); setDebouncedSearch(''); }}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === 'agencies' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Agencies
          </button>
          <button
            onClick={() => { setView('agents'); setPage(1); setSearch(''); setDebouncedSearch(''); }}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === 'agents' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Individual Agents
          </button>
        </div>

        <input
          type="text"
          placeholder={view === 'agencies' ? 'Search agencies...' : 'Search agents...'}
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={sort}
          onChange={e => { setSort(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-md text-sm bg-white ml-auto"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
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
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm bg-white border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="px-3 py-1.5 text-sm bg-white border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Top 5 Performers */}
      {!isLoading && rows.length > 0 && page === 1 && !debouncedSearch && view === 'agencies' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {(rows as AgencyRow[]).slice(0, 5).map((agent, i) => (
              <Link
                key={agent.name}
                href={`/agents/${encodeURIComponent(agent.name)}`}
                className={`block p-4 rounded-lg border-2 transition-shadow hover:shadow-md ${
                  i === 0 ? 'border-yellow-400 bg-yellow-50' :
                  i === 1 ? 'border-gray-300 bg-gray-50' :
                  i === 2 ? 'border-amber-600 bg-amber-50' :
                  'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-lg font-bold ${
                    i === 0 ? 'text-yellow-600' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-amber-700' : 'text-gray-400'
                  }`}>
                    #{i + 1}
                  </span>
                  <span className="font-semibold text-sm text-gray-900 truncate">{agent.name}</span>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <p>{agent.listingCount} listings</p>
                  <p>{formatPrice(agent.portfolioValue)}</p>
                  <p className="truncate">{agent.primaryLocation || 'Various'}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgenciesTable({ rows, isLoading }: { rows: AgencyRow[]; isLoading: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-gray-50 text-left text-gray-500 text-xs uppercase">
          <th className="px-4 py-3 w-12">#</th>
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Type</th>
          <th className="px-4 py-3 text-right">Agents</th>
          <th className="px-4 py-3 text-right">Listings</th>
          <th className="px-4 py-3 text-right">Portfolio Value</th>
          <th className="px-4 py-3 text-right">Avg Price</th>
          <th className="px-4 py-3">Primary Area</th>
          <th className="px-4 py-3 text-center">Verified</th>
          <th className="px-4 py-3 text-center">WA</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <tr key={i} className="border-b">
              <td colSpan={10} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
            </tr>
          ))
        ) : rows.length === 0 ? (
          <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No results found</td></tr>
        ) : rows.map(row => (
          <tr key={row.name} className="border-b hover:bg-gray-50 transition-colors">
            <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.rank}</td>
            <td className="px-4 py-3">
              <Link href={`/agents/${encodeURIComponent(row.name)}`} className="font-medium text-blue-600 hover:underline">
                {row.name}
              </Link>
            </td>
            <td className="px-4 py-3">
              {row.type && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  row.type === 'agent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>{row.type}</span>
              )}
            </td>
            <td className="px-4 py-3 text-right text-gray-600">{row.agentCount || '—'}</td>
            <td className="px-4 py-3 text-right font-medium">{row.listingCount}</td>
            <td className="px-4 py-3 text-right">{formatPrice(row.portfolioValue)}</td>
            <td className="px-4 py-3 text-right">{formatPrice(row.avgPrice)}</td>
            <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[180px]">{row.primaryLocation || '—'}</td>
            <td className="px-4 py-3 text-center">{row.verified && <span className="text-green-600">&#10003;</span>}</td>
            <td className="px-4 py-3 text-center">{row.whatsapp && <span className="text-green-600">&#10003;</span>}</td>
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
        <tr className="border-b bg-gray-50 text-left text-gray-500 text-xs uppercase">
          <th className="px-4 py-3 w-12">#</th>
          <th className="px-4 py-3">Agent Name</th>
          <th className="px-4 py-3">Agency</th>
          <th className="px-4 py-3 text-right">Listings</th>
          <th className="px-4 py-3 text-right">Portfolio Value</th>
          <th className="px-4 py-3 text-right">Avg Price</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <tr key={i} className="border-b">
              <td colSpan={6} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
            </tr>
          ))
        ) : rows.length === 0 ? (
          <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No results found</td></tr>
        ) : rows.map(row => (
          <tr key={`${row.name}-${row.agency}`} className="border-b hover:bg-gray-50 transition-colors">
            <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.rank}</td>
            <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
            <td className="px-4 py-3">
              <Link href={`/agents/${encodeURIComponent(row.agency)}`} className="text-blue-600 hover:underline text-sm">
                {row.agency}
              </Link>
            </td>
            <td className="px-4 py-3 text-right font-medium">{row.listingCount}</td>
            <td className="px-4 py-3 text-right">{formatPrice(row.portfolioValue)}</td>
            <td className="px-4 py-3 text-right">{formatPrice(row.avgPrice)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
