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
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm text-gray-600">
        {isLoading ? 'Loading...' : `${total?.toLocaleString() ?? 0} listings found`}
      </p>
      <select
        value={sort}
        onChange={e => onUpdate({ sort: e.target.value })}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900"
      >
        {SORT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
