'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import { formatRelativeDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SavedSearch {
  id: number;
  name: string;
  filters: string;
  lastCheckedAt: string | null;
  newMatchCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function SavedSearchesPage() {
  useUser({ or: 'redirect' });
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: searches = [], isLoading } = useQuery<SavedSearch[]>({
    queryKey: ['saved-searches'],
    queryFn: () => fetch('/api/saved-searches').then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/saved-searches/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-searches'] }),
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetch('/api/saved-searches/check-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-searches'] }),
  });

  function applySearch(search: SavedSearch) {
    const filters = JSON.parse(search.filters);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value != null && value !== '') {
        params.set(key, String(value));
      }
    }
    router.push(`/listings?${params.toString()}`);
  }

  function formatFilterSummary(filtersJson: string): string {
    try {
      const f = JSON.parse(filtersJson);
      const parts: string[] = [];
      if (f.category) parts.push(f.category);
      if (f.subcategory) parts.push(f.subcategory);
      if (f.priceMin || f.priceMax) {
        parts.push(`$${f.priceMin || '0'}-$${f.priceMax || '∞'}`);
      }
      if (f.bedroomsMin) parts.push(`${f.bedroomsMin}+ bd`);
      if (f.location) parts.push(f.location);
      if (f.province) parts.push(f.province);
      return parts.join(' · ') || 'All listings';
    } catch {
      return 'All listings';
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Saved Searches</h1>
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Saved Searches</h1>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshMutation.isPending ? 'Checking...' : 'Check for New'}
        </button>
      </div>

      {searches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No saved searches yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Use the &quot;Save Search&quot; button on the browse page to save your current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map(search => (
            <div key={search.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{search.name}</h3>
                  {search.newMatchCount != null && search.newMatchCount > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {search.newMatchCount} new
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{formatFilterSummary(search.filters)}</p>
                {search.lastCheckedAt && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Last checked {formatRelativeDate(search.lastCheckedAt)}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => applySearch(search)}
                  className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200"
                >
                  Apply
                </button>
                <button
                  onClick={() => deleteMutation.mutate(search.id)}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
