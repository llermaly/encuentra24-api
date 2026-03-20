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
      <div className="flex gap-3 mb-3 items-center">
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
          className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900"
        >
          <option value="active">Active only</option>
          <option value="removed">Removed only</option>
          <option value="all">All listings</option>
        </select>
      </div>

      {listings.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
          No listings found{selectedLocation ? ` in ${selectedLocation}` : ''}
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2.5 w-12"></th>
                  <th className="px-3 py-2.5">Title</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5 text-center">Beds</th>
                  <th className="px-3 py-2.5 text-center">Baths</th>
                  <th className="px-3 py-2.5 text-right">Area</th>
                  <th className="px-3 py-2.5">Published</th>
                  <th className="px-3 py-2.5 text-right">Favs</th>
                </tr>
              </thead>
              <tbody>
                {listings.map(listing => (
                  <tr key={listing.adId} className={`border-b hover:bg-gray-50 transition-colors ${listing.removedAt ? 'opacity-60 bg-red-50' : ''}`}>
                    <td className="px-3 py-2">
                      {listing.thumbnail ? (
                        <img
                          src={listing.thumbnail}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/listings/${listing.adId}`}
                        className={`hover:underline line-clamp-1 max-w-[250px] block ${listing.removedAt ? 'text-red-600' : 'text-blue-600'}`}
                      >
                        {listing.title || 'Untitled'}
                      </Link>
                      {listing.removedAt && (
                        <span className="text-xs text-red-400">Removed {formatRelativeDate(listing.removedAt)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      {formatPrice(listing.price, listing.currency || 'USD')}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs truncate max-w-[150px]">
                      {listing.location || '—'}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">{listing.bedrooms ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{listing.bathrooms ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                      {listing.area ? `${listing.area.toLocaleString()} m²` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(listing.publishedAt)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{listing.favorites ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-3 py-1.5 text-sm bg-white border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="px-3 py-1.5 text-sm bg-white border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Next
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
        className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="truncate">{value || 'All Locations'}</span>
        {value && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
            className="ml-1 text-gray-400 hover:text-gray-600"
          >
            &times;
          </span>
        )}
        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 bg-white border rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type to filter..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!value ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
            >
              All Locations
            </button>
            {filtered.map((loc) => (
              <button
                key={loc.value}
                onClick={() => { onChange(loc.value); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between ${
                  value === loc.value ? 'bg-blue-50 text-blue-700 font-medium' : ''
                }`}
              >
                <span className="truncate">{loc.value}</span>
                <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{loc.count}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No matching locations</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
