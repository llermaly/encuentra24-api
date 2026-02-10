'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

interface CrawlRun {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  category: string | null;
  subcategory: string | null;
  regionSlug: string | null;
  pagesProcessed: number;
  listingsFound: number;
  listingsNew: number;
  listingsUpdated: number;
  detailsCrawled: number;
  errors: number;
  durationSecs: number | null;
  errorCount: number;
  crawlType: string;
}

interface DailyStat {
  day: string;
  run_count: number;
  total_new: number;
  total_updated: number;
  total_details: number;
  total_errors: number;
  avg_duration: number;
}

interface CrawlHistoryResponse {
  runs: CrawlRun[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  dailyStats: DailyStat[];
}

function formatDuration(secs: number | null): string {
  if (secs === null || secs === undefined) return '-';
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 1) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffHrs < 48) return 'Yesterday';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    running: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    full: 'bg-purple-100 text-purple-800',
    incremental: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[type] || 'bg-gray-100 text-gray-800'}`}>
      {type}
    </span>
  );
}

function DailyChart({ dailyStats }: { dailyStats: DailyStat[] }) {
  if (!dailyStats || dailyStats.length === 0) return null;

  const maxNew = Math.max(...dailyStats.map(d => d.total_new || 0), 1);

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">New Listings Per Day (Last 30 Days)</h2>
      <div className="flex items-end gap-1 h-40">
        {dailyStats.map((day) => {
          const height = Math.max(((day.total_new || 0) / maxNew) * 100, 2);
          const date = new Date(day.day + 'T12:00:00');
          return (
            <div key={day.day} className="flex-1 flex flex-col items-center group relative">
              <div className="hidden group-hover:block absolute -top-16 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                <div>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div>{day.total_new} new, {day.run_count} runs</div>
                <div>Avg {formatDuration(Math.round(day.avg_duration))}</div>
              </div>
              <div
                className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>{dailyStats.length > 0 ? new Date(dailyStats[0].day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
        <span>{dailyStats.length > 0 ? new Date(dailyStats[dailyStats.length - 1].day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
      </div>
    </div>
  );
}

function SummaryCards({ dailyStats, runs }: { dailyStats: DailyStat[]; runs: CrawlRun[] }) {
  const totalRuns = dailyStats.reduce((s, d) => s + d.run_count, 0);
  const totalNew = dailyStats.reduce((s, d) => s + (d.total_new || 0), 0);
  const totalErrors = dailyStats.reduce((s, d) => s + (d.total_errors || 0), 0);
  const avgDuration = totalRuns > 0
    ? Math.round(dailyStats.reduce((s, d) => s + (d.avg_duration || 0) * d.run_count, 0) / totalRuns)
    : 0;

  const lastRun = runs[0];
  const nextHour = lastRun
    ? new Date(new Date(lastRun.startedAt).getTime() + 60 * 60 * 1000)
    : null;

  const cards = [
    { label: 'Runs (30d)', value: totalRuns, color: 'text-blue-600' },
    { label: 'New Listings (30d)', value: totalNew.toLocaleString(), color: 'text-green-600' },
    { label: 'Avg Duration', value: formatDuration(avgDuration), color: 'text-purple-600' },
    { label: 'Errors (30d)', value: totalErrors, color: totalErrors > 0 ? 'text-red-600' : 'text-gray-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">{c.label}</p>
          <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export function CrawlHistory() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<CrawlHistoryResponse>({
    queryKey: ['crawl-history', page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      const res = await fetch(`/api/crawl-history?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-20" />
          ))}
        </div>
        <div className="animate-pulse bg-gray-200 rounded-lg h-48" />
        <div className="animate-pulse bg-gray-200 rounded-lg h-96" />
      </div>
    );
  }

  const { runs, pagination, dailyStats } = data;

  return (
    <div>
      <SummaryCards dailyStats={dailyStats} runs={runs} />
      <DailyChart dailyStats={dailyStats} />

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Crawl Runs</h2>
          <p className="text-sm text-gray-500">{pagination.total} total runs</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Found</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">New</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Errors</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                    {formatTime(run.startedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={run.crawlType} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {formatDuration(run.durationSecs)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                    {(run.listingsFound ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={run.listingsNew > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {run.listingsNew > 0 ? `+${run.listingsNew}` : '0'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={run.listingsUpdated > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                      {run.listingsUpdated ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {run.detailsCrawled ?? 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={run.errorCount > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                      {run.errorCount}
                    </span>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No crawl runs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
