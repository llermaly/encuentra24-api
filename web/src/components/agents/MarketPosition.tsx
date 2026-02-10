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

export function MarketPosition({ rank, totalSellers, areaPositions, competitors }: MarketPositionProps) {
  return (
    <div>
      {/* Overall rank badge */}
      {rank && totalSellers && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-4 mb-4 inline-block">
          <p className="text-sm opacity-90">Overall Market Position</p>
          <p className="text-2xl font-bold">Ranked #{rank} <span className="text-base font-normal opacity-75">of {totalSellers} sellers</span></p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Area positions */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Position by Area</h3>
          {areaPositions.length === 0 ? (
            <p className="text-sm text-gray-400">No area data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase border-b">
                    <th className="pb-2">Location</th>
                    <th className="pb-2 text-right">Rank</th>
                    <th className="pb-2 text-right">Share</th>
                    <th className="pb-2 text-right">Listings</th>
                  </tr>
                </thead>
                <tbody>
                  {areaPositions.map(area => (
                    <tr key={area.location} className="border-b last:border-0">
                      <td className="py-2 text-gray-700 truncate max-w-[200px]">{area.location}</td>
                      <td className="py-2 text-right">
                        <span className={`font-medium ${area.rank <= 3 ? 'text-blue-600' : 'text-gray-600'}`}>
                          #{area.rank}
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-600">{area.marketShare}%</td>
                      <td className="py-2 text-right text-gray-600">{area.listingCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top competitors */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Competitors</h3>
          {competitors.length === 0 ? (
            <p className="text-sm text-gray-400">No competitor data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase border-b">
                    <th className="pb-2">Seller</th>
                    <th className="pb-2 text-right">Overlap</th>
                    <th className="pb-2 text-right">Avg Price</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map(comp => (
                    <tr key={comp.name} className="border-b last:border-0">
                      <td className="py-2">
                        <Link
                          href={`/agents/${encodeURIComponent(comp.name)}`}
                          className="text-blue-600 hover:underline truncate block max-w-[200px]"
                        >
                          {comp.name}
                        </Link>
                      </td>
                      <td className="py-2 text-right text-gray-600">{comp.overlapListings}</td>
                      <td className="py-2 text-right text-gray-600">{formatPrice(comp.avgPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
