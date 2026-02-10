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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
        {/* Avg Price comparison */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Avg Price: Agent vs Market</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceData} margin={{ bottom: 10 }}>
                <XAxis dataKey="subcategory" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatPrice(Number(value))} />
                <Legend />
                <Bar dataKey="Agent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Market" fill="#9ca3af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Price per sqm comparison */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Avg $/m²: Agent vs Market</h3>
          <div className="h-56">
            {sqmData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sqmData} margin={{ bottom: 10 }}>
                  <XAxis dataKey="subcategory" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                  <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}/m²`, '']} />
                  <Legend />
                  <Bar dataKey="Agent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Market" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No price/m² data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Price drop stats */}
      {priceDrops.count > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{priceDrops.count} listing{priceDrops.count !== 1 ? 's' : ''}</span> had price reductions, averaging <span className="font-semibold">{priceDrops.avgPct}%</span> reduction.
          </p>
        </div>
      )}
    </div>
  );
}
