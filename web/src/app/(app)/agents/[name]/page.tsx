'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import Link from 'next/link';
import { formatPrice, formatDate } from '@/lib/formatters';
import { PortfolioCharts } from '@/components/agents/PortfolioCharts';
import { PricingIntelligence } from '@/components/agents/PricingIntelligence';
import { MarketPosition } from '@/components/agents/MarketPosition';
import { InventoryHealth } from '@/components/agents/InventoryHealth';
import { AgentMap } from '@/components/agents/AgentMap';
import { AgentListings } from '@/components/agents/AgentListings';

interface AgentReportPageProps {
  params: Promise<{ name: string }>;
}

function compactPrice(p: number | null | undefined): string {
  if (p == null) return '—';
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}K`;
  return `$${Math.round(p)}`;
}

export default function AgentReportPage({ params }: AgentReportPageProps) {
  useUser({ or: 'redirect' });
  const { name } = use(params);
  const sellerName = decodeURIComponent(name);
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsLocation, setListingsLocation] = useState('');
  const [listingsStatus, setListingsStatus] = useState('active');

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-report', sellerName, listingsPage, listingsLocation, listingsStatus],
    queryFn: () => {
      const params = new URLSearchParams({ listingsPage: String(listingsPage), listingsStatus });
      if (listingsLocation) params.set('listingsLocation', listingsLocation);
      return fetch(`/api/agents/${encodeURIComponent(sellerName)}?${params}`)
        .then(r => {
          if (!r.ok) throw new Error('Agent not found');
          return r.json();
        });
    },
  });

  if (isLoading) {
    return (
      <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
        <div className="animate-pulse h-12 bg-stone-200/50 rounded-lg w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl aurora-surface animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-3xl aurora-surface animate-pulse" />
        <div className="h-64 rounded-3xl aurora-surface animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto">
        <Link href="/agents" className="aurora-pill aurora-pill-ghost mb-5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to agents
        </Link>
        <div className="aurora-surface rounded-3xl p-8 text-center">
          <p className="font-serif text-2xl text-stone-900">Agent not found</p>
          <p className="text-sm text-stone-500 mt-1">No seller found with the name &ldquo;{sellerName}&rdquo;</p>
        </div>
      </div>
    );
  }

  const { profile, metrics, portfolio, pricing, position, agents, inventory, geo, listings, listingsLocations } = data;

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto space-y-10">
      <Link href="/agents" className="aurora-pill aurora-pill-ghost">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to agents
      </Link>

      {/* Profile */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <span
            className="w-16 h-16 rounded-3xl flex items-center justify-center font-serif text-2xl text-stone-700 shrink-0"
            style={{ background: 'linear-gradient(135deg, #ecf3ec, #ebe4cd)' }}
          >
            {profile.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Agent profile</p>
            <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5 break-words">
              {profile.name}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {profile.type && (
                <span className="aurora-chip capitalize">{profile.type}</span>
              )}
              {profile.verified && (
                <span className="aurora-chip aurora-chip-mint">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
              <span className="aurora-chip aurora-chip-slate">
                Active since {formatDate(profile.activeSince)}
              </span>
              <span className="aurora-chip">{profile.totalListings} total listings</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.whatsapp && (
            <a
              href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 hover:-translate-y-0.5 transition-all shadow-md shadow-emerald-200"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              WhatsApp
            </a>
          )}
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="aurora-pill aurora-pill-ghost">
              Call
            </a>
          )}
          {profile.profileUrl && (
            <a
              href={profile.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="aurora-pill aurora-pill-ghost"
            >
              E24 profile
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5m0 0v5m0-5L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total" value={metrics.total.toLocaleString()} />
        <MetricCard label="Active" value={metrics.active.toLocaleString()} />
        <MetricCard label="Portfolio" value={compactPrice(metrics.portfolioValue)} />
        <MetricCard label="Avg price" value={compactPrice(metrics.avgPrice)} />
        <MetricCard label="Avg $/m²" value={metrics.avgPriceSqm ? `$${Math.round(metrics.avgPriceSqm).toLocaleString()}` : '—'} />
        <MetricCard label="Market rank" value={metrics.rank ? `#${metrics.rank}` : '—'} />
      </div>

      {/* Portfolio */}
      <Section title="Portfolio breakdown">
        <PortfolioCharts
          categorySplit={portfolio.categorySplit}
          subcategorySplit={portfolio.subcategorySplit}
          priceRanges={portfolio.priceRanges}
        />
      </Section>

      {/* Pricing */}
      <Section title="Pricing intelligence">
        <PricingIntelligence
          vsMarket={pricing.vsMarket}
          vsMarketSqm={pricing.vsMarketSqm}
          priceDrops={pricing.priceDrops}
        />
      </Section>

      {/* Market position */}
      <Section title="Market position">
        <MarketPosition
          rank={position.rank}
          totalSellers={position.totalSellers}
          areaPositions={position.areaPositions}
          competitors={position.competitors}
        />
      </Section>

      {/* Inventory health */}
      <Section title="Inventory health">
        <InventoryHealth
          domDistribution={inventory.domDistribution}
          active={inventory.active}
          stale={inventory.stale}
          removed={inventory.removed}
          avgDom={inventory.avgDom}
        />
      </Section>

      {/* Geographic coverage */}
      <Section title="Geographic coverage">
        <div className="rounded-2xl aurora-surface overflow-hidden">
          <AgentMap listings={geo} />
        </div>
      </Section>

      {/* Individual agents (only for agencies) */}
      {agents && agents.length > 0 && (
        <Section title={`Individual agents (${agents.length})`}>
          <div className="aurora-surface rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200/60">
                  <th className="px-4 py-3 font-medium">Agent name</th>
                  <th className="px-4 py-3 text-right font-medium">Listings</th>
                  <th className="px-4 py-3 text-right font-medium">Portfolio</th>
                  <th className="px-4 py-3 text-right font-medium">Avg price</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent: { name: string; listingCount: number; portfolioValue: number; avgPrice: number }) => (
                  <tr key={agent.name} className="border-b border-stone-200/40 last:border-0 hover:bg-white/50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/agents/${encodeURIComponent(agent.name)}`} className="text-stone-900 underline-offset-4 hover:underline">
                        {agent.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{agent.listingCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{compactPrice(agent.portfolioValue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{compactPrice(agent.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Listings — last */}
      <Section title={`Listings (${listings.pagination.total.toLocaleString()})`}>
        <AgentListings
          listings={listings.data}
          pagination={listings.pagination}
          onPageChange={setListingsPage}
          locations={listingsLocations || []}
          selectedLocation={listingsLocation}
          onLocationChange={(loc) => { setListingsLocation(loc); setListingsPage(1); }}
          status={listingsStatus}
          onStatusChange={(s) => { setListingsStatus(s); setListingsPage(1); }}
        />
      </Section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="aurora-surface rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-medium">{label}</p>
      <p className="font-serif text-2xl font-light text-stone-900 mt-1.5 tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-2xl text-stone-900 mb-4">
        <span className="aurora-rule">{title}</span>
      </h2>
      {children}
    </div>
  );
}
