'use client';

import { useQuery } from '@tanstack/react-query';
import { formatPrice, formatRelativeDate, formatDate } from '@/lib/formatters';
import { PIPELINE_STAGE_LABELS, type PipelineStage } from '@/lib/constants';
import Link from 'next/link';

interface DashboardData {
  stats: {
    totalListings: number;
    newToday: number;
    newThisWeek: number;
    totalFavorites: number;
  };
  recentPriceDrops: Array<{
    adId: string;
    price: number;
    recordedAt: string;
    title: string | null;
    currentPrice: number | null;
    location: string | null;
    thumbnail: string | null;
  }>;
  pipelineSummary: Record<string, number>;
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Listings" value={data.stats.totalListings.toLocaleString()} />
        <StatCard label="New Today" value={data.stats.newToday.toLocaleString()} accent />
        <StatCard label="New This Week" value={data.stats.newThisWeek.toLocaleString()} />
        <StatCard label="Favorites" value={data.stats.totalFavorites.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Pipeline</h2>
          {Object.keys(data.pipelineSummary).length === 0 ? (
            <p className="text-gray-500 text-sm">No properties in pipeline yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.pipelineSummary).map(([stage, count]) => (
                <Link
                  key={stage}
                  href="/pipeline"
                  className="flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50"
                >
                  <span className="text-sm text-gray-700">
                    {PIPELINE_STAGE_LABELS[stage as PipelineStage] ?? stage}
                  </span>
                  <span className="text-sm font-medium bg-gray-100 px-2 py-0.5 rounded">{count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Last Crawl</h2>
          {data.lastCrawl ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${data.lastCrawl.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {data.lastCrawl.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Started</span>
                <span className="text-gray-700">{formatRelativeDate(data.lastCrawl.startedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Found</span>
                <span className="text-gray-700">{data.lastCrawl.listingsFound} listings</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">New</span>
                <span className="text-gray-700">{data.lastCrawl.listingsNew}</span>
              </div>
              {data.lastCrawl.durationSecs && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration</span>
                  <span className="text-gray-700">{Math.round(data.lastCrawl.durationSecs / 60)} min</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No crawl runs yet.</p>
          )}
        </div>
      </div>

      {data.recentPriceDrops.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Price Changes</h2>
          <div className="space-y-3">
            {data.recentPriceDrops.slice(0, 10).map(drop => (
              <Link
                key={`${drop.adId}-${drop.recordedAt}`}
                href={`/listings/${drop.adId}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
              >
                {drop.thumbnail && (
                  <img src={drop.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {drop.title || drop.adId}
                  </p>
                  <p className="text-xs text-gray-500">{drop.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm line-through text-gray-400">{formatPrice(drop.price)}</p>
                  <p className="text-sm font-medium text-green-600">{formatPrice(drop.currentPrice)}</p>
                </div>
                <span className="text-xs text-gray-400">{formatDate(drop.recordedAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
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
