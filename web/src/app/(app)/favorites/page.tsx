'use client';

import { Suspense, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ListingFilters } from '@/components/listings/ListingFilters';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingSortBar } from '@/components/listings/ListingSortBar';

function scopedParams(searchParams: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  params.set('isFavorite', 'true');
  return params;
}

function FavoritesContent() {
  useUser({ or: 'redirect' });
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryString = searchParams.toString();
  const apiParams = scopedParams(searchParams);
  const filtersForDisplay = scopedParams(searchParams);
  const page = Number(searchParams.get('page') || '1');

  const { data, isLoading } = useQuery({
    queryKey: ['listings', 'favorites', apiParams.toString()],
    queryFn: () => fetch(`/api/listings?${apiParams.toString()}`).then(r => r.json()),
  });

  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(queryString);
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'isFavorite') continue;
      if (value == null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    if (!('page' in updates)) params.delete('page');
    router.push(`/favorites?${params.toString()}`);
  }, [queryString, router]);

  const currentFilters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== 'page' && key !== 'limit' && key !== 'isFavorite') currentFilters[key] = value;
  });

  const activeChips: Array<{ key: string; label: string }> = [];
  if (currentFilters.q) activeChips.push({ key: 'q', label: `"${currentFilters.q}"` });
  if (currentFilters.category) activeChips.push({ key: 'category', label: currentFilters.category });
  if (currentFilters.subcategory) activeChips.push({ key: 'subcategory', label: currentFilters.subcategory });
  if (currentFilters.location) activeChips.push({ key: 'location', label: currentFilters.location });
  if (currentFilters.city) activeChips.push({ key: 'city', label: currentFilters.city });
  if (currentFilters.priceMin || currentFilters.priceMax) {
    activeChips.push({ key: 'price', label: `$${currentFilters.priceMin || '0'} - $${currentFilters.priceMax || 'infinity'}` });
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
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Watchlist</p>
          <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
            Favorite <span className="italic">properties</span>
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            {isLoading ? 'Loading...' : (
              data?.pagination?.total != null
                ? <>{data.pagination.total.toLocaleString()} saved listings</>
                : 'Filter and sort your saved listings'
            )}
          </p>
        </div>
        <Link href="/listings" className="aurora-pill aurora-pill-ghost">
          Find more
        </Link>
      </div>

      <ListingFilters searchParams={filtersForDisplay} onUpdate={updateParams} />

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
              <span className="ml-1 text-stone-400">x</span>
            </button>
          ))}
          {activeChips.length > 1 && (
            <button
              onClick={() => router.push('/favorites')}
              className="text-xs text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <ListingSortBar
        searchParams={filtersForDisplay}
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
            Previous
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
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <Suspense fallback={
      <div className="px-6 md:px-10 py-8 max-w-[1500px] mx-auto">
        <div className="animate-pulse h-96 rounded-3xl aurora-surface" />
      </div>
    }>
      <FavoritesContent />
    </Suspense>
  );
}
