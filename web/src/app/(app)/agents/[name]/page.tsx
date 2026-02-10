'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import Link from 'next/link';
import { formatPrice, formatDate } from '@/lib/formatters';
import { PortfolioCharts } from '@/components/agents/PortfolioCharts';
import { PricingIntelligence } from '@/components/agents/PricingIntelligence';
import { MarketPosition } from '@/components/agents/MarketPosition';
import { QualityScore } from '@/components/agents/QualityScore';
import { InventoryHealth } from '@/components/agents/InventoryHealth';
import { AgentMap } from '@/components/agents/AgentMap';
import { AgentListings } from '@/components/agents/AgentListings';

interface AgentReportPageProps {
  params: Promise<{ name: string }>;
}

export default function AgentReportPage({ params }: AgentReportPageProps) {
  useUser({ or: 'redirect' });
  const { name } = use(params);
  const sellerName = decodeURIComponent(name);
  const [listingsPage, setListingsPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-report', sellerName, listingsPage],
    queryFn: () =>
      fetch(`/api/agents/${encodeURIComponent(sellerName)}?listingsPage=${listingsPage}`)
        .then(r => {
          if (!r.ok) throw new Error('Agent not found');
          return r.json();
        }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Link href="/agents" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Agents</Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">Agent not found</p>
          <p className="text-red-500 text-sm mt-1">No seller found with the name &ldquo;{sellerName}&rdquo;</p>
        </div>
      </div>
    );
  }

  const { profile, metrics, portfolio, pricing, position, quality, agents, inventory, geo, listings } = data;

  const typeBadgeColor: Record<string, string> = {
    agency: 'bg-purple-100 text-purple-700',
    developer: 'bg-blue-100 text-blue-700',
    owner: 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* Breadcrumb */}
      <Link href="/agents" className="text-blue-600 hover:underline text-sm">&larr; Back to Agents</Link>

      {/* Section 1: Profile Header */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
            {profile.type && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadgeColor[profile.type] || 'bg-gray-100 text-gray-700'}`}>
                {profile.type}
              </span>
            )}
            {profile.verified && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Verified
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Active since {formatDate(profile.activeSince)} &middot; {profile.totalListings} total listings
          </p>
        </div>
        <div className="flex gap-2">
          {profile.whatsapp && (
            <a
              href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.675-1.408A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.24 0-4.318-.726-6.003-1.957l-.42-.309-2.775.836.876-2.712-.338-.437A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              WhatsApp
            </a>
          )}
          {profile.phone && (
            <a
              href={`tel:${profile.phone}`}
              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Call
            </a>
          )}
          {profile.profileUrl && (
            <a
              href={profile.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm bg-white border text-gray-700 rounded-md hover:bg-gray-50"
            >
              Profile
            </a>
          )}
        </div>
      </div>

      {/* Section 2: Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <MetricCard label="Total Listings" value={metrics.total} />
        <MetricCard label="Active" value={metrics.active} />
        <MetricCard label="Portfolio Value" value={formatPrice(metrics.portfolioValue)} />
        <MetricCard label="Avg Price" value={formatPrice(metrics.avgPrice)} />
        <MetricCard label="Avg $/m²" value={metrics.avgPriceSqm ? `$${metrics.avgPriceSqm.toLocaleString()}` : 'N/A'} />
        <MetricCard label="Total Favorites" value={metrics.totalFavorites} />
        <MetricCard label="Market Rank" value={metrics.rank ? `#${metrics.rank}` : 'N/A'} />
      </div>

      {/* Section 3: Portfolio Breakdown */}
      <Section title="Portfolio Breakdown">
        <PortfolioCharts
          categorySplit={portfolio.categorySplit}
          subcategorySplit={portfolio.subcategorySplit}
          priceRanges={portfolio.priceRanges}
        />
      </Section>

      {/* Section 4: Pricing Intelligence */}
      <Section title="Pricing Intelligence">
        <PricingIntelligence
          vsMarket={pricing.vsMarket}
          vsMarketSqm={pricing.vsMarketSqm}
          priceDrops={pricing.priceDrops}
        />
      </Section>

      {/* Section 5: Market Position */}
      <Section title="Market Position">
        <MarketPosition
          rank={position.rank}
          totalSellers={position.totalSellers}
          areaPositions={position.areaPositions}
          competitors={position.competitors}
        />
      </Section>

      {/* Section 6: Listing Quality Score */}
      <Section title="Listing Quality Score">
        <QualityScore
          composite={quality.composite}
          engagement={quality.engagement}
          visibility={quality.visibility}
          presentation={quality.presentation}
          completeness={quality.completeness}
          raw={quality.raw}
        />
      </Section>

      {/* Section 7: Individual Agents */}
      {agents && agents.length > 0 && (
        <Section title={`Individual Agents (${agents.length})`}>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3">Agent Name</th>
                  <th className="px-4 py-3 text-right">Listings</th>
                  <th className="px-4 py-3 text-right">Portfolio Value</th>
                  <th className="px-4 py-3 text-right">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent: { name: string; listingCount: number; portfolioValue: number; avgPrice: number }) => (
                  <tr key={agent.name} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium"><Link href={`/agents/${encodeURIComponent(agent.name)}`} className="text-blue-600 hover:underline">{agent.name}</Link></td>
                    <td className="px-4 py-3 text-right">{agent.listingCount}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(agent.portfolioValue)}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(agent.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Section 8: Inventory Health */}
      <Section title="Inventory Health">
        <InventoryHealth
          domDistribution={inventory.domDistribution}
          active={inventory.active}
          stale={inventory.stale}
          removed={inventory.removed}
          avgDom={inventory.avgDom}
        />
      </Section>

      {/* Section 8: Geographic Coverage */}
      <Section title="Geographic Coverage">
        <AgentMap listings={geo} />
      </Section>

      {/* Section 9: Listings */}
      <Section title={`Listings (${listings.pagination.total})`}>
        <AgentListings
          listings={listings.data}
          pagination={listings.pagination}
          onPageChange={setListingsPage}
        />
      </Section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}
