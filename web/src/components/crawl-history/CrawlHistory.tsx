'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  if (secs === null || secs === undefined) return '—';
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
  const cls: Record<string, string> = {
    completed: 'aurora-chip aurora-chip-mint',
    running: 'aurora-chip aurora-chip-sand',
    cancelled: 'aurora-chip aurora-chip-warn',
    failed: 'aurora-chip aurora-chip-warn',
  };
  return (
    <span className={cls[status] || 'aurora-chip'}>
      {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />}
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cls: Record<string, string> = {
    full: 'aurora-chip aurora-chip-slate capitalize',
    incremental: 'aurora-chip capitalize',
  };
  return <span className={cls[type] || 'aurora-chip capitalize'}>{type}</span>;
}

function DailyChart({ dailyStats }: { dailyStats: DailyStat[] }) {
  if (!dailyStats || dailyStats.length === 0) return null;

  const maxNew = Math.max(...dailyStats.map(d => d.total_new || 0), 1);

  return (
    <div className="aurora-surface rounded-3xl p-6 mb-6">
      <h2 className="font-serif text-2xl text-stone-900">
        <span className="aurora-rule">Daily new listings</span>
      </h2>
      <p className="text-sm text-stone-500 mt-1 mb-4">Last 30 days</p>
      <div className="flex items-end gap-1 h-40">
        {dailyStats.map((day) => {
          const height = Math.max(((day.total_new || 0) / maxNew) * 100, 2);
          const date = new Date(day.day + 'T12:00:00');
          return (
            <div key={day.day} className="flex-1 flex flex-col items-center group relative">
              <div className="hidden group-hover:block absolute -top-16 bg-stone-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap z-10 shadow-lg">
                <div className="font-serif text-stone-50">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div className="text-stone-300">{day.total_new} new · {day.run_count} runs</div>
                <div className="text-stone-400">Avg {formatDuration(Math.round(day.avg_duration))}</div>
              </div>
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${height}%`,
                  background: 'linear-gradient(to top, #4a6b4a, #6b8e6b)',
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-stone-500 mt-2">
        <span>{new Date(dailyStats[0].day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span>{new Date(dailyStats[dailyStats.length - 1].day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

function SummaryCards({ dailyStats }: { dailyStats: DailyStat[] }) {
  const totalRuns = dailyStats.reduce((s, d) => s + d.run_count, 0);
  const totalNew = dailyStats.reduce((s, d) => s + (d.total_new || 0), 0);
  const totalErrors = dailyStats.reduce((s, d) => s + (d.total_errors || 0), 0);
  const avgDuration = totalRuns > 0
    ? Math.round(dailyStats.reduce((s, d) => s + (d.avg_duration || 0) * d.run_count, 0) / totalRuns)
    : 0;

  const cards = [
    { label: 'Runs (30d)', value: totalRuns.toLocaleString() },
    { label: 'New listings (30d)', value: totalNew.toLocaleString() },
    { label: 'Avg duration', value: formatDuration(avgDuration) },
    { label: 'Errors (30d)', value: totalErrors.toLocaleString() },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <div key={c.label} className="aurora-surface rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-medium">{c.label}</p>
          <p className="font-serif text-3xl font-light text-stone-900 mt-2 tabular-nums">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export function CrawlHistory() {
  const [page, setPage] = useState(1);
  const router = useRouter();

  const { data, isLoading } = useQuery<CrawlHistoryResponse>({
    queryKey: ['crawl-history', page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      const res = await fetch(`/api/crawl-history?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse aurora-surface h-24 rounded-2xl" />
          ))}
        </div>
        <div className="animate-pulse aurora-surface rounded-3xl h-48" />
        <div className="animate-pulse aurora-surface rounded-3xl h-96" />
      </div>
    );
  }

  const { runs, pagination, dailyStats } = data;

  return (
    <div>
      <SummaryCards dailyStats={dailyStats} />
      <DailyChart dailyStats={dailyStats} />

      <div className="aurora-surface rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200/60 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl text-stone-900">All crawl runs</h2>
            <p className="text-xs text-stone-500 mt-0.5">{pagination.total.toLocaleString()} total</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200/60">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Duration</th>
                <th className="px-4 py-3 text-right font-medium">Found</th>
                <th className="px-4 py-3 text-right font-medium">New</th>
                <th className="px-4 py-3 text-right font-medium">Updated</th>
                <th className="px-4 py-3 text-right font-medium">Details</th>
                <th className="px-4 py-3 text-right font-medium">Errors</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => router.push(`/crawl-history/${run.id}`)}
                  className={`border-b border-stone-200/40 last:border-0 hover:bg-white/50 cursor-pointer transition-colors ${run.status === 'running' ? 'bg-amber-50/40' : ''}`}
                >
                  <td className="px-4 py-3 text-stone-700 whitespace-nowrap">{formatTime(run.startedAt)}</td>
                  <td className="px-4 py-3"><TypeBadge type={run.crawlType} /></td>
                  <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                  <td className="px-4 py-3 text-stone-600 text-right tabular-nums">{formatDuration(run.durationSecs)}</td>
                  <td className="px-4 py-3 text-stone-900 text-right font-medium tabular-nums">{(run.listingsFound ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={run.listingsNew > 0 ? 'text-emerald-700 font-medium' : 'text-stone-400'}>
                      {run.listingsNew > 0 ? `+${run.listingsNew}` : '0'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={run.listingsUpdated > 0 ? 'text-stone-700 font-medium' : 'text-stone-400'}>
                      {run.listingsUpdated ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600 text-right tabular-nums">{run.detailsCrawled ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={run.errorCount > 0 ? 'text-rose-700 font-medium' : 'text-stone-400'}>
                      {run.errorCount}
                    </span>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-stone-500 italic">No crawl runs found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-200/60 flex items-center justify-between">
            <p className="text-xs text-stone-500">
              Page <span className="font-serif text-stone-900 text-base">{pagination.page}</span> of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="aurora-pill aurora-pill-ghost disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="aurora-pill aurora-pill-ghost disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
