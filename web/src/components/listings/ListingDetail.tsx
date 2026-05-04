'use client';

import { formatPrice, formatArea, formatDate, formatRelativeDate } from '@/lib/formatters';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from '@/lib/constants';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ImageGallery } from './ImageGallery';
import { PriceHistoryChart } from './PriceHistoryChart';

const DetailMap = dynamic(
  () => import('./DetailMap').then(m => ({ default: m.DetailMap })),
  { ssr: false, loading: () => <div className="w-full h-64 rounded-2xl aurora-surface animate-pulse" /> }
);

interface PriceHistoryEntry {
  id: number;
  adId: string;
  price: number;
  currency: string | null;
  source: string | null;
  recordedAt: string;
}

interface Note {
  id: number;
  adId: string;
  type: string;
  content: string;
  createdAt: string;
}

interface ListingDetailProps {
  listing: {
    adId: string;
    title: string | null;
    description: string | null;
    price: number | null;
    currency: string | null;
    oldPrice: number | null;
    pricePerSqmConstruction: number | null;
    pricePerSqmLand: number | null;
    province: string | null;
    city: string | null;
    location: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    parking: number | null;
    builtAreaSqm: number | null;
    landAreaSqm: number | null;
    totalSqm: number | null;
    yearBuilt: number | null;
    levels: number | null;
    floorNumber: number | null;
    titleStatus: string | null;
    maintenanceCost: number | null;
    images: string[] | null;
    imageCount: number | null;
    sellerName: string | null;
    agentName: string | null;
    sellerType: string | null;
    sellerVerified: boolean | null;
    amenities: string[] | null;
    url: string;
    category: string;
    subcategory: string;
    publishedAt: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    isFavorite: boolean;
    pipelineStage: string | null;
    featureLevel: string | null;
    favoritesCount: number | null;
    sellerWhatsapp: string | null;
  };
  priceHistory: PriceHistoryEntry[];
  notes: Note[];
}

export function ListingDetail({ listing, priceHistory, notes }: ListingDetailProps) {
  const router = useRouter();
  const [isFav, setIsFav] = useState(listing.isFavorite);
  const [stage, setStage] = useState(listing.pipelineStage);
  const [noteText, setNoteText] = useState('');
  const [localNotes, setLocalNotes] = useState(notes);

  async function toggleFavorite() {
    if (isFav) {
      await fetch(`/api/favorites/${listing.adId}`, { method: 'DELETE' });
      setIsFav(false);
    } else {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: listing.adId }),
      });
      setIsFav(true);
    }
  }

  async function updateStage(newStage: string) {
    if (newStage === '') {
      await fetch(`/api/pipeline/${listing.adId}`, { method: 'DELETE' });
      setStage(null);
    } else if (!stage) {
      await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: listing.adId, stage: newStage }),
      });
      setStage(newStage);
    } else {
      await fetch(`/api/pipeline/${listing.adId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      setStage(newStage);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    const res = await fetch(`/api/listings/${listing.adId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteText, type: 'note' }),
    });
    const note = await res.json();
    setLocalNotes(prev => [note, ...prev]);
    setNoteText('');
  }

  const placeText = [listing.location, listing.city, listing.province].filter(Boolean).join(' · ');
  const priceDropPct =
    listing.oldPrice && listing.price && listing.oldPrice > listing.price
      ? Math.round(((listing.oldPrice - listing.price) / listing.oldPrice) * 100)
      : null;

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="aurora-pill aurora-pill-ghost mb-5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to listings
      </button>

      {/* Image Gallery */}
      {listing.images && listing.images.length > 0 && (
        <div className="rounded-3xl overflow-hidden aurora-surface">
          <ImageGallery images={listing.images} title={listing.title || ''} />
        </div>
      )}

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium capitalize">
            {listing.category} · {listing.subcategory.replace(/-/g, ' ')}
          </p>
          <div className="flex flex-wrap items-baseline gap-3 mt-2">
            <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900">
              {formatPrice(listing.price, listing.currency || 'USD')}
            </h1>
            {listing.oldPrice && listing.oldPrice > (listing.price || 0) && (
              <span className="text-lg line-through text-stone-400">
                {formatPrice(listing.oldPrice)}
              </span>
            )}
            {priceDropPct != null && (
              <span className="aurora-chip aurora-chip-mint">↓ {priceDropPct}%</span>
            )}
            {listing.featureLevel && listing.featureLevel !== 'basic' && (
              <span className="aurora-chip aurora-chip-sand capitalize">★ {listing.featureLevel}</span>
            )}
          </div>
          <p className="text-stone-700 mt-2 text-lg">{listing.title || '—'}</p>
          {placeText && <p className="text-sm text-stone-500 mt-1">{placeText}</p>}
          {(listing.pricePerSqmConstruction || listing.pricePerSqmLand) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {listing.pricePerSqmConstruction != null && (
                <span className="aurora-chip aurora-chip-slate">
                  ${Math.round(listing.pricePerSqmConstruction).toLocaleString()}/m² built
                </span>
              )}
              {listing.pricePerSqmLand != null && (
                <span className="aurora-chip aurora-chip-sand">
                  ${Math.round(listing.pricePerSqmLand).toLocaleString()}/m² land
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleFavorite}
            aria-label={isFav ? 'Unfavorite' : 'Favorite'}
            className={`aurora-pill ${isFav ? 'aurora-pill-primary' : 'aurora-pill-ghost'}`}
          >
            <svg className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {isFav ? 'Saved' : 'Save'}
          </button>
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="aurora-pill aurora-pill-ghost"
          >
            View on E24
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5m0 0v5m0-5L10 14M5 5v14h14" />
            </svg>
          </a>
        </div>
      </div>

      {/* Specs */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Spec label="Bedrooms" value={listing.bedrooms} icon="bd" />
        <Spec label="Bathrooms" value={listing.bathrooms} icon="ba" />
        <Spec label="Parking" value={listing.parking} icon="p" />
        <Spec label="Built Area" value={listing.builtAreaSqm ? formatArea(listing.builtAreaSqm) : null} icon="a" />
        <Spec label="Land Area" value={listing.landAreaSqm ? formatArea(listing.landAreaSqm) : null} icon="l" />
        <Spec label="Year Built" value={listing.yearBuilt} icon="y" />
        <Spec label="Levels" value={listing.levels} icon="lv" />
        <Spec label="Floor" value={listing.floorNumber} icon="f" />
      </div>

      {/* Pipeline Stage */}
      <div className="mt-6 aurora-surface rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">Your pipeline</p>
          <p className="font-serif text-lg text-stone-900 mt-0.5">
            {stage ? PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS] || stage : 'Not in pipeline'}
          </p>
        </div>
        <select
          value={stage || ''}
          onChange={e => updateStage(e.target.value)}
          className="aurora-input"
        >
          <option value="">Not in pipeline</option>
          {PIPELINE_STAGES.map(s => (
            <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      {listing.description && (
        <Section title="Description">
          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{listing.description}</p>
        </Section>
      )}

      {/* Map */}
      {listing.latitude != null && listing.longitude != null && (
        <Section title="Location">
          <div className="rounded-2xl overflow-hidden aurora-surface">
            <DetailMap
              latitude={listing.latitude}
              longitude={listing.longitude}
              title={listing.title || listing.location || 'Property'}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {listing.address && (
              <p className="text-sm text-stone-600">{listing.address}</p>
            )}
            <a
              href={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-stone-700 hover:text-stone-900 underline-offset-4 hover:underline ml-auto"
            >
              Open in Google Maps →
            </a>
          </div>
        </Section>
      )}

      {/* Amenities */}
      {listing.amenities && listing.amenities.length > 0 && (
        <Section title="Amenities">
          <div className="flex flex-wrap gap-2">
            {listing.amenities.map((a, i) => (
              <span key={i} className="aurora-chip">{a}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Seller */}
      <Section title="Seller">
        <div className="aurora-surface rounded-2xl p-5 flex flex-wrap items-start gap-4">
          <span
            className="w-12 h-12 rounded-full flex items-center justify-center font-serif text-xl text-stone-700 shrink-0"
            style={{ background: 'linear-gradient(135deg, #ecf3ec, #ebe4cd)' }}
          >
            {(listing.agentName || listing.sellerName || '?').charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            {listing.agentName && (
              <p className="font-serif text-lg text-stone-900">{listing.agentName}</p>
            )}
            {listing.sellerName && (
              <p className={`text-sm ${listing.agentName ? 'text-stone-500' : 'font-serif text-lg text-stone-900'}`}>
                {listing.sellerName}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {listing.sellerType && <span className="aurora-chip capitalize">{listing.sellerType}</span>}
              {listing.sellerVerified && (
                <span className="aurora-chip aurora-chip-slate">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
            </div>
          </div>
          {listing.sellerWhatsapp && (
            <a
              href={`https://wa.me/${listing.sellerWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 hover:-translate-y-0.5 transition-all shadow-md shadow-emerald-200"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
          )}
        </div>
      </Section>

      {/* Price History */}
      {priceHistory.length > 0 && (
        <Section title="Price History">
          <div className="aurora-surface rounded-2xl p-5">
            <PriceHistoryChart data={priceHistory} currentPrice={listing.price} />
            <div className="mt-3 divide-y divide-stone-200/60">
              {priceHistory.map(ph => (
                <div key={ph.id} className="flex justify-between items-center text-sm py-2">
                  <span className="font-serif text-stone-900">{formatPrice(ph.price)}</span>
                  <span className="text-stone-400 text-xs">{formatDate(ph.recordedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Notes */}
      <Section title="Notes">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Add a private note…"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            className="aurora-input flex-1"
          />
          <button
            onClick={addNote}
            disabled={!noteText.trim()}
            className="aurora-pill aurora-pill-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        {localNotes.length === 0 ? (
          <p className="text-sm text-stone-500 italic">No notes yet.</p>
        ) : (
          <div className="space-y-2">
            {localNotes.map(note => (
              <div key={note.id} className="aurora-surface-soft rounded-2xl p-4">
                <p className="text-sm text-stone-800 leading-relaxed">{note.content}</p>
                <p className="text-xs text-stone-500 mt-2 flex items-center gap-2">
                  {note.type !== 'note' && (
                    <span className="aurora-chip capitalize">{note.type.replace('_', ' ')}</span>
                  )}
                  <span>{formatRelativeDate(note.createdAt)}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Meta */}
      <div className="mt-8 aurora-surface-soft rounded-2xl p-5">
        <p className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-2">Meta</p>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-stone-600">
          <MetaRow label="Published" value={formatDate(listing.publishedAt)} />
          <MetaRow label="First seen" value={formatDate(listing.firstSeenAt)} />
          <MetaRow label="Last seen" value={formatRelativeDate(listing.lastSeenAt)} />
          {listing.titleStatus && <MetaRow label="Title" value={listing.titleStatus} />}
          {listing.maintenanceCost != null && <MetaRow label="Maintenance" value={`${formatPrice(listing.maintenanceCost)}/mo`} />}
          {listing.favoritesCount != null && <MetaRow label="E24 favorites" value={String(listing.favoritesCount)} />}
        </dl>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl text-stone-900 mb-3">
        <span className="aurora-rule">{title}</span>
      </h2>
      {children}
    </section>
  );
}

function Spec({ label, value }: { label: string; value: string | number | null | undefined; icon?: string }) {
  if (value == null) return null;
  return (
    <div className="aurora-surface rounded-2xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">{label}</p>
      <p className="font-serif text-xl text-stone-900 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-stone-500 shrink-0">{label}</dt>
      <dd className="text-stone-800 truncate">{value}</dd>
    </div>
  );
}
