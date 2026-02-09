'use client';

import { useState, useEffect, useRef } from 'react';
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
    queryFn: () => fetch('/api/categories').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setQ(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get('q') || '';
      if (q !== current) {
        onUpdate({ q: q || undefined });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);

  const locationOptions = (catData?.locations || []).map(l => ({
    value: l.location,
    label: `${l.location} (${l.count})`,
  }));

  const cityOptions = (catData?.cities || []).map(c => ({
    value: c.city,
    label: `${c.city} (${c.count})`,
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by title, description..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <SearchableSelect
          placeholder="All Locations"
          value={searchParams.get('location') || ''}
          options={locationOptions}
          onChange={v => onUpdate({ location: v || undefined })}
        />
        <SelectFilter
          label="Category"
          value={searchParams.get('category') || ''}
          options={CATEGORY_OPTIONS as unknown as Array<{ value: string; label: string }>}
          onChange={v => onUpdate({ category: v || undefined })}
        />
        <SelectFilter
          label="Type"
          value={searchParams.get('subcategory') || ''}
          options={SUBCATEGORY_OPTIONS as unknown as Array<{ value: string; label: string }>}
          onChange={v => onUpdate({ subcategory: v || undefined })}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
        >
          {expanded ? 'Less Filters' : 'More Filters'}
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-200">
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bathrooms Min</label>
            <input
              type="number"
              value={searchParams.get('bathroomsMin') || ''}
              onChange={e => onUpdate({ bathroomsMin: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">City</label>
            <select
              value={searchParams.get('city') || ''}
              onChange={e => onUpdate({ city: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900"
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

function SearchableSelect({
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

  const filtered = options.filter(o =>
    o.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 min-w-[160px] text-left flex items-center justify-between gap-2 hover:bg-gray-50"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {value || placeholder}
        </span>
        {value ? (
          <span
            onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); }}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </span>
        ) : (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute z-[1000] mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              placeholder="Type to filter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">No matches</p>
            ) : (
              filtered.slice(0, 50).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 ${
                    opt.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
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
}

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
        className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All {label}s</option>
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
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="flex gap-1">
        <input
          type="number"
          placeholder="Min"
          value={minValue}
          onChange={e => onMinChange(e.target.value)}
          className="w-1/2 px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900 placeholder:text-gray-400"
        />
        <input
          type="number"
          placeholder="Max"
          value={maxValue}
          onChange={e => onMaxChange(e.target.value)}
          className="w-1/2 px-2 py-1.5 text-sm border border-gray-300 rounded text-gray-900 placeholder:text-gray-400"
        />
      </div>
    </div>
  );
}
