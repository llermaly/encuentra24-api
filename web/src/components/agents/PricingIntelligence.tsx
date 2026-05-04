'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatPrice } from '@/lib/formatters';

const SUBCATEGORY_LABELS: Record<string, string> = {
  casas: 'Houses',
  apartamentos: 'Apts',
  'lotes-y-terrenos': 'Land',
  comercios: 'Commercial',
  oficinas: 'Offices',
  edificios: 'Buildings',
  fincas: 'Farms',
  'casas-y-terrenos-de-playas': 'Beach',
  negocios: 'Businesses',
  cuartos: 'Rooms',
  'apartamentos-amueblados': 'Furnished',
};

interface PricingIntelligenceProps {
  vsMarket: { subcategory: string; agentAvg: number; marketAvg: number }[];
  vsMarketSqm: { subcategory: string; agentAvg: number; marketAvg: number }[];
  priceDrops: { count: number; avgPct: number };
}

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid #e7e5e4',
  borderRadius: 12,
  fontSize: 12,
};

export function PricingIntelligence({ vsMarket, vsMarketSqm, priceDrops }: PricingIntelligenceProps) {
  const priceData = vsMarket.map(d => ({
    subcategory: SUBCATEGORY_LABELS[d.subcategory] || d.subcategory,
    Agent: d.agentAvg,
    Market: d.marketAvg,
  }));

  const sqmData = vsMarketSqm.map(d => ({
    subcategory: SUBCATEGORY_LABELS[d.subcategory] || d.subcategory,
    Agent: d.agentAvg,
    Market: d.marketAvg,
  }));

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="aurora-surface rounded-2xl p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-2">
            Avg price · Agent vs Market
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priceData} margin={{ bottom: 10 }}>
              <XAxis dataKey="subcategory" tick={{ fontSize: 10, fill: '#78716c' }} angle={-20} textAnchor="end" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatPrice(Number(value))} cursor={{ fill: 'rgba(107, 142, 107, 0.08)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Agent" fill="#4a6b4a" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Market" fill="#c9b896" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="aurora-surface rounded-2xl p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-2">
            Avg $/m² · Agent vs Market
          </h3>
          {sqmData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sqmData} margin={{ bottom: 10 }}>
                <XAxis dataKey="subcategory" tick={{ fontSize: 10, fill: '#78716c' }} angle={-20} textAnchor="end" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={v => `$${v.toLocaleString()}`} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`$${Number(value).toLocaleString()}/m²`, '']} cursor={{ fill: 'rgba(107, 142, 107, 0.08)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Agent" fill="#4a6b4a" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Market" fill="#c9b896" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-stone-400 text-sm italic">
              No price/m² data available
            </div>
          )}
        </div>
      </div>

      {priceDrops.count > 0 && (
        <div className="aurora-surface rounded-2xl p-4 flex items-center gap-3">
          <span className="aurora-chip aurora-chip-mint">↓ {priceDrops.avgPct}%</span>
          <p className="text-sm text-stone-700">
            <span className="font-medium text-stone-900">{priceDrops.count} listing{priceDrops.count !== 1 ? 's' : ''}</span>
            {' '}had price reductions, averaging{' '}
            <span className="font-medium text-stone-900">{priceDrops.avgPct}%</span>
            {' '}off.
          </p>
        </div>
      )}
    </div>
  );
}
