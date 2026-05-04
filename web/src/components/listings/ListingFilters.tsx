'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CATEGORY_OPTIONS, SUBCATEGORY_OPTIONS } from '@/lib/constants';

interface ListingFiltersProps {
  searchParams: URLSearchParams;
  onUpdate: (updates: Record<string, string | undefined>) => void;
}

interface CategoriesData {
  categories: Array<{ category: string; subcategory: string; count: number }>;
  provinces: Array<{ province: string; count: number }>;
  cities: Array<{ province: string; city: string; count: number }>;
  locations: Array<{ location: string; count: number }>;
}

export function ListingFilters({ searchParams, onUpdate }: ListingFiltersProps) {
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [expanded, setExpanded] = useState(false);

  const { data: catData } = useQuery<CategoriesData>({
    queryKey: ['categories'],
    queryFn: async () => {
      const r = await fetch('/api/categories');
      if (!r.ok) throw new Error(`Categories fetch failed: ${r.status}`);
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setQ(searchParams.get('q') || '');
  }, [searchParams]);

  const submitSearch = () => {
    const current = searchParams.get('q') || '';
    if (q !== current) {
      onUpdate({ q: q || undefined });
    }
  };

  const onLocationChange = useCallback(
    (v: string) => onUpdate({ location: v || undefined }),
    [onUpdate]
  );

  const locationOptions = useMemo(
    () => (catData?.locations || []).map(l => ({
      value: l.location,
      label: `${l.location} (${l.count})`,
    })),
    [catData?.locations]
  );

  const cityOptions = useMemo(
    () => (catData?.cities || []).map(c => ({
      value: c.city,
      label: `${c.city} (${c.count})`,
    })),
    [catData?.cities]
  );

  return (
    <div className="aurora-surface rounded-2xl p-4 mb-4">
      <div className="flex flex-wrap gap-2.5 items-end">
        <div className="flex-1 min-w-[220px] flex gap-1.5">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by title or description…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitSearch(); }}
              className="aurora-input w-full pl-9"
            />
          </div>
          <button
            onClick={submitSearch}
            className="aurora-pill aurora-pill-primary"
          >
            Search
          </button>
        </div>
        <SearchableSelect
          placeholder="All Locations"
          value={searchParams.get('location') || ''}
          options={locationOptions}
          onChange={onLocationChange}
        />
        <SelectFilter
          label="Categories"
          value={searchParams.get('category') || ''}
          options={CATEGORY_OPTIONS as unknown as Array<{ value: string; label: string }>}
          onChange={v => onUpdate({ category: v || undefined })}
        />
        <SelectFilter
          label="Types"
          value={searchParams.get('subcategory') || ''}
          options={SUBCATEGORY_OPTIONS as unknown as Array<{ value: string; label: string }>}
          onChange={v => onUpdate({ subcategory: v || undefined })}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="aurora-pill aurora-pill-ghost"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          {expanded ? 'Less filters' : 'More filters'}
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-stone-200/60">
          <RangeFilter
            label="Price"
            minValue={searchParams.get('priceMin') || ''}
            maxValue={searchParams.get('priceMax') || ''}
            onMinChange={v => onUpdate({ priceMin: v || undefined })}
            onMaxChange={v => onUpdate({ priceMax: v || undefined })}
          />
          <RangeFilter
            label="Bedrooms"
            minValue={searchParams.get('bedroomsMin') || ''}
            maxValue={searchParams.get('bedroomsMax') || ''}
            onMinChange={v => onUpdate({ bedroomsMin: v || undefined })}
            onMaxChange={v => onUpdate({ bedroomsMax: v || undefined })}
          />
          <RangeFilter
            label="Area (m²)"
            minValue={searchParams.get('areaMin') || ''}
            maxValue={searchParams.get('areaMax') || ''}
            onMinChange={v => onUpdate({ areaMin: v || undefined })}
            onMaxChange={v => onUpdate({ areaMax: v || undefined })}
          />
          <DebouncedNumberInput
            label="Bathrooms Min"
            value={searchParams.get('bathroomsMin') || ''}
            onChange={v => onUpdate({ bathroomsMin: v || undefined })}
            min="0"
          />
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5 font-medium">City</label>
            <select
              value={searchParams.get('city') || ''}
              onChange={e => onUpdate({ city: e.target.value || undefined })}
              className="aurora-input w-full"
            >
              <option value="">All Cities</option>
              {cityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <RangeFilter
            label="Land Area (m²)"
            minValue={searchParams.get('landAreaMin') || ''}
            maxValue={searchParams.get('landAreaMax') || ''}
            onMinChange={v => onUpdate({ landAreaMin: v || undefined })}
            onMaxChange={v => onUpdate({ landAreaMax: v || undefined })}
          />
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5 font-medium">Status</label>
            <select
              value={searchParams.get('status') || 'active'}
              onChange={e => onUpdate({ status: e.target.value === 'active' ? undefined : e.target.value })}
              className="aurora-input w-full"
            >
              <option value="active">Active only</option>
              <option value="removed">Removed only</option>
              <option value="all">All listings</option>
            </select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={searchParams.get('isFavorite') === 'true'}
                onChange={e => onUpdate({ isFavorite: e.target.checked ? 'true' : undefined })}
                className="rounded"
              />
              Favorites only
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={searchParams.get('inPipeline') === 'true'}
                onChange={e => onUpdate({ inPipeline: e.target.checked ? 'true' : undefined })}
                className="rounded"
              />
              In Pipeline
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

const SearchableSelect = memo(function SearchableSelect({
  placeholder,
  value,
  options,
  onChange,
}: {
  placeholder: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(
    () => options.filter(o => o.value.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="aurora-input min-w-[170px] text-left flex items-center justify-between gap-2 hover:bg-white/85"
      >
        <span className={value ? 'text-stone-900' : 'text-stone-500'}>
          {value || placeholder}
        </span>
        {value ? (
          <span
            onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); }}
            className="text-stone-400 hover:text-stone-700 text-base leading-none"
          >
            &times;
          </span>
        ) : (
          <svg className="w-3 h-3 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute z-[1000] mt-1.5 w-64 rounded-2xl shadow-xl max-h-64 overflow-hidden aurora-surface-strong">
          <div className="p-2 border-b border-stone-200/60">
            <input
              type="text"
              placeholder="Type to filter…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="aurora-input w-full text-sm"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-stone-500">No matches</p>
            ) : (
              filtered.slice(0, 50).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-emerald-50/70 ${
                    opt.value === value ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-stone-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="aurora-input min-w-[140px]"
      >
        <option value="">All {label}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function RangeFilter({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const [localMin, setLocalMin] = useState(minValue);
  const [localMax, setLocalMax] = useState(maxValue);

  useEffect(() => { setLocalMin(minValue); }, [minValue]);
  useEffect(() => { setLocalMax(maxValue); }, [maxValue]);

  useEffect(() => {
    if (localMin === minValue) return;
    const timer = setTimeout(() => onMinChange(localMin), 400);
    return () => clearTimeout(timer);
  }, [localMin]);

  useEffect(() => {
    if (localMax === maxValue) return;
    const timer = setTimeout(() => onMaxChange(localMax), 400);
    return () => clearTimeout(timer);
  }, [localMax]);

  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5 font-medium">{label}</label>
      <div className="flex gap-1">
        <input
          type="number"
          placeholder="Min"
          value={localMin}
          onChange={e => setLocalMin(e.target.value)}
          className="aurora-input w-1/2 placeholder:text-stone-400"
        />
        <input
          type="number"
          placeholder="Max"
          value={localMax}
          onChange={e => setLocalMax(e.target.value)}
          className="aurora-input w-1/2 placeholder:text-stone-400"
        />
      </div>
    </div>
  );
}

function DebouncedNumberInput({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => { setLocal(value); }, [value]);

  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => onChange(local), 400);
    return () => clearTimeout(timer);
  }, [local]);

  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5 font-medium">{label}</label>
      <input
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        className="aurora-input w-full"
        min={min}
      />
    </div>
  );
}
