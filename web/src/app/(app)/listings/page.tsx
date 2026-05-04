'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useCallback, useRef } from 'react';
import { ListingFilters } from '@/components/listings/ListingFilters';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingSortBar } from '@/components/listings/ListingSortBar';
import { SaveSearchModal } from '@/components/saved-searches/SaveSearchModal';

function ListingsContent() {
  useUser({ or: 'redirect' });
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showSaveModal, setShowSaveModal] = useState(false);

  const queryString = searchParams.toString();
  const page = Number(searchParams.get('page') || '1');

  const { data, isLoading } = useQuery({
    queryKey: ['listings', queryString],
    queryFn: () => fetch(`/api/listings?${queryString}`).then(r => r.json()),
  });

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParamsRef.current.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    if (!('page' in updates)) params.delete('page');
    router.push(`/listings?${params.toString()}`);
  }, [router]);

  const currentFilters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== 'page' && key !== 'limit') currentFilters[key] = value;
  });

  const activeChips: Array<{ key: string; label: string }> = [];
  if (currentFilters.q) activeChips.push({ key: 'q', label: `"${currentFilters.q}"` });
  if (currentFilters.category) activeChips.push({ key: 'category', label: currentFilters.category });
  if (currentFilters.subcategory) activeChips.push({ key: 'subcategory', label: currentFilters.subcategory });
  if (currentFilters.location) activeChips.push({ key: 'location', label: currentFilters.location });
  if (currentFilters.city) activeChips.push({ key: 'city', label: currentFilters.city });
  if (currentFilters.priceMin || currentFilters.priceMax) {
    activeChips.push({ key: 'price', label: `$${currentFilters.priceMin || '0'} – $${currentFilters.priceMax || '∞'}` });
  }
  if (currentFilters.bedroomsMin) activeChips.push({ key: 'bedroomsMin', label: `${currentFilters.bedroomsMin}+ bd` });

  const clearChip = (key: string) => {
    if (key === 'price') {
      updateParams({ priceMin: undefined, priceMax: undefined });
    } else {
      updateParams({ [key]: undefined });
    }
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1500px] mx-auto">
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">
            Inventory
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
            Browse <span className="italic">properties</span>
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            {isLoading ? 'Loading…' : (
              data?.pagination?.total != null
                ? <>{data.pagination.total.toLocaleString()} matching listings</>
                : 'Filter, sort and save searches'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(currentFilters).length > 0 && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="aurora-pill aurora-pill-primary"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" />
              </svg>
              Save search
            </button>
          )}
          <button
            onClick={() => router.push('/saved-searches')}
            className="aurora-pill aurora-pill-ghost"
          >
            Saved searches
          </button>
        </div>
      </div>

      <ListingFilters searchParams={searchParams} onUpdate={updateParams} />

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">Active</span>
          {activeChips.map(chip => (
            <button
              key={chip.key}
              onClick={() => clearChip(chip.key)}
              className="aurora-chip hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-colors capitalize"
            >
              {chip.label}
              <span className="ml-1 text-stone-400">×</span>
            </button>
          ))}
          {activeChips.length > 1 && (
            <button
              onClick={() => {
                const next = new URLSearchParams();
                router.push(`/listings?${next.toString()}`);
              }}
              className="text-xs text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

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
        <div className="flex justify-center items-center gap-3 mt-10">
          <button
            onClick={() => updateParams({ page: String(page - 1) })}
            disabled={page <= 1}
            className="aurora-pill aurora-pill-ghost disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <div className="aurora-surface px-4 py-2 rounded-full text-sm text-stone-700">
            <span className="font-serif text-stone-900">{page}</span>
            <span className="text-stone-400 mx-2">/</span>
            <span className="text-stone-500">{data.pagination.totalPages}</span>
          </div>
          <button
            onClick={() => updateParams({ page: String(page + 1) })}
            disabled={page >= data.pagination.totalPages}
            className="aurora-pill aurora-pill-ghost disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
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
    <Suspense fallback={
      <div className="px-6 md:px-10 py-8 max-w-[1500px] mx-auto">
        <div className="animate-pulse h-96 rounded-3xl aurora-surface" />
      </div>
    }>
      <ListingsContent />
    </Suspense>
  );
}
