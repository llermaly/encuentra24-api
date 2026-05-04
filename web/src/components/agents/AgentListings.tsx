'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { formatPrice, formatDate, formatRelativeDate } from '@/lib/formatters';

interface Listing {
  adId: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  location: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  publishedAt: string | null;
  favorites: number | null;
  thumbnail: string | null;
  subcategory: string;
  category: string;
  removedAt: string | null;
}

interface AgentListingsProps {
  listings: Listing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  locations: { value: string; count: number }[];
  selectedLocation: string;
  onLocationChange: (location: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
}

export function AgentListings({ listings, pagination, onPageChange, locations, selectedLocation, onLocationChange, status, onStatusChange }: AgentListingsProps) {
  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 mb-4 items-center">
        {locations.length > 1 && (
          <LocationFilter
            locations={locations}
            value={selectedLocation}
            onChange={onLocationChange}
          />
        )}
        <select
          value={status}
          onChange={e => onStatusChange(e.target.value)}
          className="aurora-input"
        >
          <option value="active">Active only</option>
          <option value="removed">Removed only</option>
          <option value="all">All listings</option>
        </select>
      </div>

      {listings.length === 0 ? (
        <div className="aurora-surface rounded-2xl p-10 text-center text-stone-500 italic">
          No listings found{selectedLocation ? ` in ${selectedLocation}` : ''}
        </div>
      ) : (
        <div className="aurora-surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200/60">
                  <th className="px-3 py-3 w-12 font-medium"></th>
                  <th className="px-3 py-3 font-medium">Title</th>
                  <th className="px-3 py-3 text-right font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Location</th>
                  <th className="px-3 py-3 text-center font-medium">Bd</th>
                  <th className="px-3 py-3 text-center font-medium">Ba</th>
                  <th className="px-3 py-3 text-right font-medium">Area</th>
                  <th className="px-3 py-3 font-medium">Published</th>
                  <th className="px-3 py-3 text-right font-medium">Favs</th>
                </tr>
              </thead>
              <tbody>
                {listings.map(listing => (
                  <tr key={listing.adId} className={`border-b border-stone-200/40 last:border-0 hover:bg-white/50 transition-colors ${listing.removedAt ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2">
                      {listing.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.thumbnail}
                          alt=""
                          className="w-10 h-10 object-cover rounded-lg"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-stone-100 to-stone-200" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/listings/${listing.adId}`}
                        className="text-stone-900 underline-offset-4 hover:underline line-clamp-1 max-w-[260px] block"
                      >
                        {listing.title || 'Untitled'}
                      </Link>
                      {listing.removedAt && (
                        <span className="aurora-chip aurora-chip-warn mt-1">
                          Removed {formatRelativeDate(listing.removedAt)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-stone-900 tabular-nums">
                      {formatPrice(listing.price, listing.currency || 'USD')}
                    </td>
                    <td className="px-3 py-2 text-stone-600 text-xs truncate max-w-[150px]">
                      {listing.location || '—'}
                    </td>
                    <td className="px-3 py-2 text-center text-stone-600 tabular-nums">{listing.bedrooms ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-stone-600 tabular-nums">{listing.bathrooms ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-stone-600 whitespace-nowrap tabular-nums">
                      {listing.area ? `${listing.area.toLocaleString()} m²` : '—'}
                    </td>
                    <td className="px-3 py-2 text-stone-500 text-xs whitespace-nowrap">
                      {formatDate(listing.publishedAt)}
                    </td>
                    <td className="px-3 py-2 text-right text-stone-600 tabular-nums">{listing.favorites ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="aurora-pill aurora-pill-ghost disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <div className="aurora-surface px-4 py-2 rounded-full text-sm text-stone-700">
            <span className="font-serif text-stone-900">{pagination.page}</span>
            <span className="text-stone-400 mx-2">/</span>
            <span className="text-stone-500">{pagination.totalPages}</span>
          </div>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="aurora-pill aurora-pill-ghost disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function LocationFilter({
  locations,
  value,
  onChange,
}: {
  locations: { value: string; count: number }[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return locations;
    const q = query.toLowerCase();
    return locations.filter((l) => l.value.toLowerCase().includes(q));
  }, [locations, query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="aurora-input flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className={`truncate ${value ? 'text-stone-900' : 'text-stone-500'}`}>{value || 'All locations'}</span>
        {value && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
            className="ml-1 text-stone-400 hover:text-stone-700"
          >
            &times;
          </span>
        )}
        <svg className="w-3 h-3 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-64 rounded-2xl shadow-xl aurora-surface-strong overflow-hidden">
          <div className="p-2 border-b border-stone-200/60">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type to filter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="aurora-input w-full text-sm"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-emerald-50/70 ${!value ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-stone-700'}`}
            >
              All locations
            </button>
            {filtered.map((loc) => (
              <button
                key={loc.value}
                onClick={() => { onChange(loc.value); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-emerald-50/70 flex justify-between ${
                  value === loc.value ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-stone-700'
                }`}
              >
                <span className="truncate">{loc.value}</span>
                <span className="text-stone-400 text-xs ml-2 flex-shrink-0 tabular-nums">{loc.count}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-stone-400 text-center italic">No matching locations</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
