'use client';

import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import { ListingFilters } from '@/components/listings/ListingFilters';

const MapView = dynamic(() => import('@/components/map/MapView').then(m => ({ default: m.MapView })), {
  ssr: false,
  loading: () => <div className="w-full h-[calc(100vh-260px)] aurora-surface rounded-3xl animate-pulse" />,
});

function MapContent() {
  useUser({ or: 'redirect' });
  const searchParams = useSearchParams();
  const router = useRouter();

  const params = new URLSearchParams(searchParams.toString());
  params.set('hasCoords', 'true');
  params.set('limit', '500');
  const queryString = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ['map-listings', queryString],
    queryFn: () => fetch(`/api/listings?${queryString}`).then(r => r.json()),
  });

  function updateParams(updates: Record<string, string | undefined>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '') {
        p.delete(key);
      } else {
        p.set(key, value);
      }
    }
    router.push(`/map?${p.toString()}`);
  }

  const handleBoundsChange = useCallback((_bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number }) => {
    // future deep-linking
  }, []);

  const listings = (data?.data || []).filter((l: { latitude: number | null; longitude: number | null }) => l.latitude && l.longitude);

  return (
    <div className="flex flex-col h-full px-6 md:px-10 py-8 max-w-[1500px] mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Geography</p>
          <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
            Map <span className="italic">view</span>
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            {isLoading ? 'Loading…' : `${listings.length.toLocaleString()} properties with coordinates`}
          </p>
        </div>
      </div>

      <ListingFilters searchParams={searchParams} onUpdate={updateParams} />

      <div className="flex-1 mt-1 rounded-3xl overflow-hidden aurora-surface">
        <MapView listings={listings} onBoundsChange={handleBoundsChange} />
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="px-6 md:px-10 py-8 max-w-[1500px] mx-auto">
        <div className="animate-pulse h-96 rounded-3xl aurora-surface" />
      </div>
    }>
      <MapContent />
    </Suspense>
  );
}
