'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ListingFilters } from '@/components/listings/ListingFilters';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingSortBar } from '@/components/listings/ListingSortBar';
import { SaveSearchModal } from '@/components/saved-searches/SaveSearchModal';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

function ListingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showSaveModal, setShowSaveModal] = useState(false);

  const queryString = searchParams.toString();
  const page = Number(searchParams.get('page') || '1');

  const { data, isLoading } = useQuery({
    queryKey: ['listings', queryString],
    queryFn: () => fetch(`/api/listings?${queryString}`).then(r => r.json()),
  });

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    if (!('page' in updates)) params.delete('page');
    router.push(`/listings?${params.toString()}`);
  }

  const currentFilters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== 'page' && key !== 'limit') currentFilters[key] = value;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Browse Listings</h1>
        {Object.keys(currentFilters).length > 0 && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Search
          </button>
        )}
      </div>
      <ListingFilters searchParams={searchParams} onUpdate={updateParams} />
      <ListingSortBar
        searchParams={searchParams}
        onUpdate={updateParams}
        total={data?.pagination?.total}
        isLoading={isLoading}
      />
      <ListingGrid
        listings={data?.data || []}
        isLoading={isLoading}
      />
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => updateParams({ page: String(page - 1) })}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm bg-white border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {data.pagination.totalPages}
          </span>
          <button
            onClick={() => updateParams({ page: String(page + 1) })}
            disabled={page >= data.pagination.totalPages}
            className="px-3 py-1.5 text-sm bg-white border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
      {showSaveModal && (
        <SaveSearchModal
          filters={currentFilters}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="animate-pulse h-96 bg-gray-200 rounded-lg" /></div>}>
      <ListingsContent />
    </Suspense>
  );
}
