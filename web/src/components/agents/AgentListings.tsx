'use client';

import Link from 'next/link';
import { formatPrice, formatDate } from '@/lib/formatters';

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
}

export function AgentListings({ listings, pagination, onPageChange }: AgentListingsProps) {
  if (listings.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
        No listings found
      </div>
    );
  }

  return (
    <div>
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
                <tr key={listing.adId} className="border-b hover:bg-gray-50 transition-colors">
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
                      className="text-blue-600 hover:underline line-clamp-1 max-w-[250px] block"
                    >
                      {listing.title || 'Untitled'}
                    </Link>
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
