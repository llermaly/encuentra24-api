'use client';

import { SORT_OPTIONS } from '@/lib/constants';

interface ListingSortBarProps {
  searchParams: URLSearchParams;
  onUpdate: (updates: Record<string, string | undefined>) => void;
  total?: number;
  isLoading: boolean;
}

export function ListingSortBar({ searchParams, onUpdate, total, isLoading }: ListingSortBarProps) {
  const sort = searchParams.get('sort') || 'published_desc';

  return (
    <div className="flex items-center justify-between mb-5">
      <p className="text-sm text-stone-600">
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" />
            Loading…
          </span>
        ) : (
          <>
            <span className="font-serif text-stone-900 text-lg tabular-nums mr-1">
              {total?.toLocaleString() ?? 0}
            </span>
            properties
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">Sort</span>
        <select
          value={sort}
          onChange={e => onUpdate({ sort: e.target.value })}
          className="aurora-input min-w-[160px]"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
