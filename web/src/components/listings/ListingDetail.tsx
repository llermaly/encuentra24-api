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
  { ssr: false, loading: () => <div className="w-full h-64 bg-gray-100 animate-pulse rounded-lg" /> }
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">
          &larr; Back to listings
        </button>
      </div>

      {/* Image Gallery */}
      {listing.images && listing.images.length > 0 && (
        <ImageGallery images={listing.images} title={listing.title || ''} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mt-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {formatPrice(listing.price, listing.currency || 'USD')}
            {listing.oldPrice && listing.oldPrice > (listing.price || 0) && (
              <span className="ml-2 text-lg line-through text-gray-400 font-normal">
                {formatPrice(listing.oldPrice)}
              </span>
            )}
          </h1>
          <p className="text-gray-700 mt-1">{listing.title}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {[listing.location, listing.city, listing.province].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleFavorite}
            className={`p-2 rounded-full border ${isFav ? 'text-red-500 border-red-200 bg-red-50' : 'text-gray-400 border-gray-200 hover:bg-gray-50'}`}
          >
            <svg className="w-5 h-5" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
          >
            View on E24
          </a>
        </div>
      </div>

      {/* Specs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Spec label="Bedrooms" value={listing.bedrooms} />
        <Spec label="Bathrooms" value={listing.bathrooms} />
        <Spec label="Parking" value={listing.parking} />
        <Spec label="Built Area" value={listing.builtAreaSqm ? formatArea(listing.builtAreaSqm) : null} />
        <Spec label="Land Area" value={listing.landAreaSqm ? formatArea(listing.landAreaSqm) : null} />
        <Spec label="Year Built" value={listing.yearBuilt} />
        <Spec label="Levels" value={listing.levels} />
        <Spec label="Floor" value={listing.floorNumber} />
      </div>

      {/* Price per m² */}
      {(listing.pricePerSqmConstruction || listing.pricePerSqmLand) && (
        <div className="flex gap-4 mt-3 text-sm text-gray-600">
          {listing.pricePerSqmConstruction && (
            <span>${listing.pricePerSqmConstruction.toLocaleString()}/m² built</span>
          )}
          {listing.pricePerSqmLand && (
            <span>${listing.pricePerSqmLand.toLocaleString()}/m² land</span>
          )}
        </div>
      )}

      {/* Pipeline Stage */}
      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm text-gray-600">Pipeline:</label>
        <select
          value={stage || ''}
          onChange={e => updateStage(e.target.value)}
          className="px-2 py-1 text-sm border rounded bg-white"
        >
          <option value="">Not in pipeline</option>
          {PIPELINE_STAGES.map(s => (
            <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      {listing.description && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">{listing.description}</p>
        </div>
      )}

      {/* Location Map */}
      {listing.latitude != null && listing.longitude != null && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Location</h2>
          <DetailMap
            latitude={listing.latitude}
            longitude={listing.longitude}
            title={listing.title || listing.location || 'Property'}
          />
          <div className="flex items-center gap-3 mt-2">
            {listing.address && (
              <p className="text-sm text-gray-500">{listing.address}</p>
            )}
            <a
              href={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline shrink-0"
            >
              Open in Google Maps
            </a>
          </div>
        </div>
      )}

      {/* Amenities */}
      {listing.amenities && listing.amenities.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {listing.amenities.map((a, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Seller Info */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Seller</h2>
        <div className="text-sm text-gray-700 space-y-1">
          {listing.agentName && (
            <p className="font-medium">{listing.agentName}</p>
          )}
          {listing.sellerName && (
            <p className={listing.agentName ? 'text-gray-500' : ''}>{listing.sellerName}</p>
          )}
          {listing.sellerType && <p className="text-gray-500">{listing.sellerType}</p>}
          {listing.sellerVerified && <span className="text-green-600 text-xs">Verified</span>}
        </div>
        {listing.sellerWhatsapp && (
          <a
            href={`https://wa.me/${listing.sellerWhatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </a>
        )}
      </div>

      {/* Dates */}
      <div className="mt-4 text-xs text-gray-400 space-y-1">
        <p>Published: {formatDate(listing.publishedAt)}</p>
        <p>First seen: {formatDate(listing.firstSeenAt)}</p>
        <p>Last seen: {formatRelativeDate(listing.lastSeenAt)}</p>
        {listing.titleStatus && <p>Title status: {listing.titleStatus}</p>}
        {listing.maintenanceCost && <p>Maintenance: {formatPrice(listing.maintenanceCost)}/mo</p>}
        {listing.favoritesCount != null && <p>E24 favorites: {listing.favoritesCount}</p>}
      </div>

      {/* Price History */}
      {priceHistory.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Price History</h2>
          <PriceHistoryChart data={priceHistory} currentPrice={listing.price} />
          <div className="space-y-2 mt-3">
            {priceHistory.map(ph => (
              <div key={ph.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                <span className="text-gray-700">{formatPrice(ph.price)}</span>
                <span className="text-gray-400 text-xs">{formatDate(ph.recordedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Add a note..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            className="flex-1 px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addNote}
            disabled={!noteText.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {localNotes.length === 0 ? (
          <p className="text-sm text-gray-500">No notes yet.</p>
        ) : (
          <div className="space-y-2">
            {localNotes.map(note => (
              <div key={note.id} className="bg-gray-50 rounded p-3">
                <p className="text-sm text-gray-700">{note.content}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {note.type !== 'note' && <span className="capitalize mr-2">{note.type.replace('_', ' ')}</span>}
                  {formatRelativeDate(note.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="bg-gray-50 rounded p-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}
