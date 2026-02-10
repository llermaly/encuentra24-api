'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const BUCKET_COLORS: Record<string, string> = {
  '<7 days': '#10b981',
  '7-30 days': '#3b82f6',
  '30-90 days': '#f59e0b',
  '90+ days': '#ef4444',
};

interface InventoryHealthProps {
  domDistribution: { bucket: string; count: number }[];
  active: number;
  stale: number;
  removed: number;
  avgDom: number;
}

export function InventoryHealth({ domDistribution, active, stale, removed, avgDom }: InventoryHealthProps) {
  const chartData = domDistribution.map(d => ({
    ...d,
    fill: BUCKET_COLORS[d.bucket] || '#6b7280',
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* DOM Chart */}
      <div className="lg:col-span-2 bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Days on Market</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Cards */}
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-xs text-green-600 uppercase tracking-wide">Active</p>
          <p className="text-2xl font-bold text-green-700">{active}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-xs text-yellow-600 uppercase tracking-wide">Stale (&gt;30d)</p>
          <p className="text-2xl font-bold text-yellow-700">{stale}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-xs text-red-600 uppercase tracking-wide">Removed</p>
          <p className="text-2xl font-bold text-red-700">{removed}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Days on Market</p>
          <p className="text-2xl font-bold text-gray-700">{avgDom}</p>
        </div>
      </div>
    </div>
  );
}
