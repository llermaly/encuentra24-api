'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { WhatsappRecipientsPanel } from '@/components/notifications/WhatsappRecipientsPanel';
import { formatDate, formatPrice, formatRelativeDate } from '@/lib/formatters';

interface DigestListing {
  itemId: number;
  adId: string;
  eventAt: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  subcategory: string | null;
  location: string | null;
  city: string | null;
  province: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaSqm: number | null;
  url: string | null;
  thumbnail: string | null;
}

interface DigestSearchGroup {
  id: number | null;
  name: string;
  listings: DigestListing[];
}

interface DailySummaryDigest {
  id: number;
  kind: string;
  scheduleKey: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  itemCount: number;
  createdAt: string;
  sentAt: string | null;
  savedSearches: DigestSearchGroup[];
}

interface DigestResponse {
  digest: DailySummaryDigest | null;
  setupRequired?: boolean;
  error?: string;
}

type SummaryCadence = 'daily' | 'weekly';

const cadenceConfig: Record<SummaryCadence, {
  label: string;
  kind: string;
  lookbackHours: number;
  captureLabel: string;
}> = {
  daily: {
    label: 'Daily',
    kind: 'saved_search_daily',
    lookbackHours: 24,
    captureLabel: 'Capture last 24h',
  },
  weekly: {
    label: 'Weekly',
    kind: 'saved_search_weekly',
    lookbackHours: 7 * 24,
    captureLabel: 'Capture last 7d',
  },
};

function getSampleDigest(cadence: SummaryCadence): DailySummaryDigest {
  return {
    id: 0,
    kind: cadenceConfig[cadence].kind,
    scheduleKey: null,
    status: 'sample',
    periodStart: new Date(Date.now() - cadenceConfig[cadence].lookbackHours * 60 * 60 * 1000).toISOString(),
    periodEnd: new Date().toISOString(),
    itemCount: 3,
    createdAt: new Date().toISOString(),
    sentAt: null,
    savedSearches: [
      {
        id: 1,
        name: '3-bd casas under $300K',
        listings: [
          {
            itemId: 1,
            adId: 'sample-1024',
            eventAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            title: 'Casa familiar con terraza y patio',
            price: 285000,
            currency: 'USD',
            category: 'sale',
            subcategory: 'casas',
            location: 'Costa Sur',
            city: 'Panama City',
            province: 'Panama',
            bedrooms: 3,
            bathrooms: 2.5,
            builtAreaSqm: 185,
            url: null,
            thumbnail: null,
          },
          {
            itemId: 2,
            adId: 'sample-1025',
            eventAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
            title: 'Casa en conjunto cerrado cerca de colegios',
            price: 265000,
            currency: 'USD',
            category: 'sale',
            subcategory: 'casas',
            location: 'Brisas del Golf',
            city: 'San Miguelito',
            province: 'Panama',
            bedrooms: 3,
            bathrooms: 2,
            builtAreaSqm: 162,
            url: null,
            thumbnail: null,
          },
        ],
      },
      {
        id: 2,
        name: 'Apartments in San Francisco',
        listings: [
          {
            itemId: 3,
            adId: 'sample-2026',
            eventAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            title: 'Apartamento con vista abierta',
            price: 1850,
            currency: 'USD',
            category: 'rental',
            subcategory: 'apartamentos',
            location: 'San Francisco',
            city: 'Panama City',
            province: 'Panama',
            bedrooms: 2,
            bathrooms: 2,
            builtAreaSqm: 108,
            url: null,
            thumbnail: null,
          },
        ],
      },
    ],
  };
}

function listingMeta(listing: DigestListing) {
  const parts = [];
  if (listing.bedrooms != null) parts.push(`${listing.bedrooms} bd`);
  if (listing.bathrooms != null) parts.push(`${listing.bathrooms} ba`);
  if (listing.builtAreaSqm != null) parts.push(`${Math.round(listing.builtAreaSqm)} m²`);
  return parts.join(' · ');
}

function locationLine(listing: DigestListing) {
  return [listing.location, listing.city, listing.province].filter(Boolean).join(', ') || 'Location pending';
}

export default function DailySummaryPreviewPage() {
  const queryClient = useQueryClient();
  const [cadence, setCadence] = useState<SummaryCadence>('daily');
  const [previewMode, setPreviewMode] = useState<'actual' | 'sample'>('actual');
  const { data, error } = useQuery<DigestResponse>({
    queryKey: ['notifications', 'daily-summary', cadence],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/daily-summary?cadence=${cadence}`);
      if (!response.ok) throw new Error('Unable to load the latest daily summary');
      return response.json();
    },
  });

  const captureMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/daily-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cadence,
          lookbackHours: cadenceConfig[cadence].lookbackHours,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to create daily summary preview');
      }
      return response.json();
    },
    onSuccess: () => {
      setPreviewMode('actual');
      queryClient.invalidateQueries({ queryKey: ['notifications', 'daily-summary', cadence] });
    },
  });

  const hasActualDigest = !!data?.digest;
  const isSample = previewMode === 'sample' || !hasActualDigest;
  const digest = isSample ? getSampleDigest(cadence) : data.digest!;
  const cadenceLabel = cadenceConfig[cadence].label;
  const totalGroups = digest.savedSearches.length;
  const totalListings = useMemo(
    () => digest.savedSearches.reduce((sum, group) => sum + group.listings.length, 0),
    [digest]
  );

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Notifications</p>
          <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
            {cadenceLabel} <span className="italic">summary</span>
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            {isSample
              ? 'Sample WhatsApp preview for saved-search matches.'
              : `${totalListings} captured ${totalListings === 1 ? 'listing' : 'listings'} in the latest digest.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="aurora-surface-soft rounded-full p-1 flex">
            {(['daily', 'weekly'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setCadence(option);
                  setPreviewMode('actual');
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  cadence === option ? 'bg-stone-950 text-white' : 'text-stone-600 hover:text-stone-950'
                }`}
              >
                {cadenceConfig[option].label}
              </button>
            ))}
          </div>
          <div className="aurora-surface-soft rounded-full p-1 flex">
            <button
              type="button"
              onClick={() => setPreviewMode('actual')}
              disabled={!hasActualDigest}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !isSample ? 'bg-stone-950 text-white' : 'text-stone-600 hover:text-stone-950'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Actual
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('sample')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isSample ? 'bg-stone-950 text-white' : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              Sample
            </button>
          </div>
          <Link href="/saved-searches" className="aurora-pill aurora-pill-ghost">
            Saved searches
          </Link>
          <button
            type="button"
            onClick={() => captureMutation.mutate()}
            disabled={captureMutation.isPending}
            className="aurora-pill aurora-pill-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {captureMutation.isPending ? 'Capturing…' : cadenceConfig[cadence].captureLabel}
          </button>
        </div>
      </div>

      {(error || captureMutation.error) && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          {(captureMutation.error as Error | null)?.message || (error as Error).message}
        </div>
      )}

      {data?.setupRequired && (
        <div className="mb-5 rounded-2xl border border-stone-200 bg-white/70 px-4 py-3 text-sm text-stone-700">
          Real digest capture needs the notification migration first. The WhatsApp preview below is sample data.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem] gap-6 items-start">
        <section className="rounded-3xl aurora-surface overflow-hidden">
          <div className="bg-stone-950 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-400">WhatsApp preview</p>
              <p className="font-serif text-2xl mt-1">
                {totalListings} new {totalListings === 1 ? 'property' : 'properties'} from your saved searches
              </p>
            </div>
            <span className={isSample ? 'aurora-chip aurora-chip-sand' : 'aurora-chip aurora-chip-mint'}>
              {isSample ? 'Sample' : digest.status}
            </span>
          </div>

            <div className="bg-white px-5 sm:px-8 py-8">
              <div className="max-w-[720px] mx-auto border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="px-6 py-6 border-b border-stone-200 bg-[#f7f8f4]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500 font-medium">Encuentra24</p>
                <h2 className="font-serif text-3xl text-stone-950 mt-1">{cadenceLabel} property summary</h2>
                <p className="text-sm text-stone-600 mt-2">
                  New matches from {formatDate(digest.periodStart)} to {formatDate(digest.periodEnd)}.
                </p>
              </div>

              <div className="px-6 py-5 border-b border-stone-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-stone-500">New listings</p>
                    <p className="font-serif text-3xl text-stone-950 mt-1">{totalListings}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-stone-500">Saved searches</p>
                    <p className="font-serif text-3xl text-stone-950 mt-1">{totalGroups}</p>
                  </div>
                </div>
              </div>

              {totalListings === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="font-serif text-2xl text-stone-950">No new matches in this window</p>
                  <p className="text-sm text-stone-500 mt-1">The scheduled WhatsApp still sends a no-new-properties status message.</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-200">
                  {digest.savedSearches.map(group => (
                    <div key={group.id ?? group.name} className="px-6 py-6">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="font-serif text-xl text-stone-950">{group.name}</h3>
                        <span className="aurora-chip">{group.listings.length} new</span>
                      </div>

                      <div className="space-y-4">
                        {group.listings.map(listing => (
                          <div key={`${group.id}-${listing.itemId}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4">
                            <div className="h-24 rounded-xl overflow-hidden bg-stone-100">
                              {listing.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={listing.thumbnail} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-gradient-to-br from-stone-100 via-stone-200 to-emerald-50" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <p className="font-serif text-2xl text-stone-950">
                                  {formatPrice(listing.price, listing.currency ?? 'USD')}
                                </p>
                                <span className="text-[11px] uppercase tracking-wider text-stone-400">{listing.category}</span>
                              </div>
                              <p className="text-sm font-medium text-stone-800 truncate">{listing.title || listing.adId}</p>
                              <p className="text-xs text-stone-500 truncate mt-0.5">{locationLine(listing)}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-stone-500">
                                {listingMeta(listing) && <span>{listingMeta(listing)}</span>}
                                <span>{formatRelativeDate(listing.eventAt)}</span>
                              </div>
                              {listing.url && (
                                <a
                                  href={listing.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex mt-3 text-xs font-medium text-stone-950 underline-offset-4 hover:underline"
                                >
                                  View listing →
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-6 py-5 bg-stone-950 text-stone-300 text-xs">
                You are receiving this because you saved searches in Encuentra24 Property Desk.
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <WhatsappRecipientsPanel />

          <section className="rounded-3xl aurora-surface p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500 font-medium">Digest state</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-stone-500">Window</p>
                <p className="text-sm text-stone-900 mt-1">
                  {formatDate(digest.periodStart)} → {formatDate(digest.periodEnd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Status</p>
                <p className="text-sm text-stone-900 mt-1 capitalize">{digest.status}</p>
              </div>
              {digest.scheduleKey && (
                <div>
                  <p className="text-xs text-stone-500">Schedule key</p>
                  <p className="text-sm text-stone-900 mt-1">{digest.scheduleKey}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-stone-500">Duplicate protection</p>
                <p className="text-sm text-stone-700 mt-1">
                  Captured listings are keyed by user, cadence, ad ID, and first-seen time.
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Schedules</p>
                <p className="text-sm text-stone-700 mt-1">
                  Daily is scheduled for 8 AM Panama. Weekly is scheduled Mondays at 8 AM Panama.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => captureMutation.mutate()}
                  disabled={captureMutation.isPending}
                  className="aurora-pill aurora-pill-ghost w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {captureMutation.isPending ? 'Capturing…' : 'Refresh preview'}
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
