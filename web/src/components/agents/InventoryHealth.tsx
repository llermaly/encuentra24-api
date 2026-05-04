'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const BUCKET_COLORS: Record<string, string> = {
  '<7 days': '#4a6b4a',
  '7-30 days': '#6b8e6b',
  '30-90 days': '#c9b896',
  '90+ days': '#94a3b8',
};

interface InventoryHealthProps {
  domDistribution: { bucket: string; count: number }[];
  active: number;
  stale: number;
  removed: number;
  avgDom: number;
}

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid #e7e5e4',
  borderRadius: 12,
  fontSize: 12,
};

export function InventoryHealth({ domDistribution, active, stale, removed, avgDom }: InventoryHealthProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 aurora-surface rounded-2xl p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-2">Days on market</h3>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={domDistribution}>
            <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(107, 142, 107, 0.08)' }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {domDistribution.map((entry, i) => (
                <Cell key={i} fill={BUCKET_COLORS[entry.bucket] || '#78716c'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
        <StatusBox label="Active" value={active.toLocaleString()} accent="#4a6b4a" softBg="#ecf3ec" />
        <StatusBox label="Stale (>30d)" value={stale.toLocaleString()} accent="#8b7949" softBg="#f5efe0" />
        <StatusBox label="Removed" value={removed.toLocaleString()} accent="#9a3412" softBg="#fef3e6" />
        <StatusBox label="Avg DOM" value={`${avgDom}d`} accent="#475569" softBg="#f1f5f9" />
      </div>
    </div>
  );
}

function StatusBox({ label, value, accent, softBg }: { label: string; value: string; accent: string; softBg: string }) {
  return (
    <div className="aurora-surface rounded-2xl px-4 py-3 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-50 blur-2xl" style={{ background: softBg }} />
      <p className="relative text-[10px] uppercase tracking-[0.2em] text-stone-500 font-medium">{label}</p>
      <p className="relative font-serif text-2xl font-light mt-1.5 tabular-nums" style={{ color: accent }}>{value}</p>
    </div>
  );
}
