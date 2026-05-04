'use client';

import Link from 'next/link';
import { formatPrice } from '@/lib/formatters';

interface MarketPositionProps {
  rank: number | null;
  totalSellers: number | null;
  areaPositions: {
    location: string;
    rank: number;
    marketShare: number;
    listingCount: number;
  }[];
  competitors: {
    name: string;
    overlapListings: number;
    avgPrice: number;
  }[];
}

function compactPrice(p: number | null | undefined): string {
  if (p == null) return '—';
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}K`;
  return `$${Math.round(p)}`;
}

export function MarketPosition({ rank, totalSellers, areaPositions, competitors }: MarketPositionProps) {
  return (
    <div>
      {rank && totalSellers && (
        <div
          className="rounded-2xl p-5 mb-4 inline-flex items-baseline gap-3 text-white shadow-md"
          style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #4a6b4a 100%)' }}
        >
          <span className="text-[11px] uppercase tracking-[0.2em] opacity-70">Overall</span>
          <span className="font-serif text-3xl font-light">#{rank}</span>
          <span className="text-sm opacity-75">of {totalSellers.toLocaleString()} sellers</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="aurora-surface rounded-2xl p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-3">Position by area</h3>
          {areaPositions.length === 0 ? (
            <p className="text-sm text-stone-400 italic">No area data</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-200/60">
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 text-right font-medium">Rank</th>
                  <th className="pb-2 text-right font-medium">Share</th>
                  <th className="pb-2 text-right font-medium">Listings</th>
                </tr>
              </thead>
              <tbody>
                {areaPositions.map(area => (
                  <tr key={area.location} className="border-b border-stone-200/40 last:border-0">
                    <td className="py-2 text-stone-700 truncate max-w-[200px]">{area.location}</td>
                    <td className="py-2 text-right">
                      <span className={`font-medium tabular-nums ${area.rank <= 3 ? 'text-emerald-700' : 'text-stone-700'}`}>
                        #{area.rank}
                      </span>
                    </td>
                    <td className="py-2 text-right text-stone-600 tabular-nums">{area.marketShare}%</td>
                    <td className="py-2 text-right text-stone-600 tabular-nums">{area.listingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="aurora-surface rounded-2xl p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-3">Top competitors</h3>
          {competitors.length === 0 ? (
            <p className="text-sm text-stone-400 italic">No competitor data</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-200/60">
                  <th className="pb-2 font-medium">Seller</th>
                  <th className="pb-2 text-right font-medium">Overlap</th>
                  <th className="pb-2 text-right font-medium">Avg price</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map(comp => (
                  <tr key={comp.name} className="border-b border-stone-200/40 last:border-0">
                    <td className="py-2">
                      <Link
                        href={`/agents/${encodeURIComponent(comp.name)}`}
                        className="text-stone-900 underline-offset-4 hover:underline truncate block max-w-[200px]"
                      >
                        {comp.name}
                      </Link>
                    </td>
                    <td className="py-2 text-right text-stone-600 tabular-nums">{comp.overlapListings}</td>
                    <td className="py-2 text-right text-stone-600 tabular-nums">{compactPrice(comp.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
