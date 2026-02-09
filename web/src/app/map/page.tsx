'use client';

import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import { ListingFilters } from '@/components/listings/ListingFilters';

const MapView = dynamic(() => import('@/components/map/MapView').then(m => ({ default: m.MapView })), {
  ssr: false,
  loading: () => <div className="w-full h-[calc(100vh-200px)] bg-gray-100 animate-pulse rounded-lg" />,
});

function MapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const params = new URLSearchParams(searchParams.toString());
  params.set('hasCoords', 'true');
  params.set('limit', '500');
  const queryString = params.toString();

  const { data } = useQuery({
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

  const handleBoundsChange = useCallback((bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number }) => {
    // Could update URL params here for deep-linking map viewport
  }, []);

  const listings = (data?.data || []).filter((l: { latitude: number | null; longitude: number | null }) => l.latitude && l.longitude);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Map View</h1>
        <ListingFilters searchParams={searchParams} onUpdate={updateParams} />
        <p className="text-sm text-gray-500 mb-3">{listings.length} properties with coordinates</p>
      </div>
      <div className="flex-1 px-4 pb-4">
        <MapView listings={listings} onBoundsChange={handleBoundsChange} />
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="animate-pulse h-96 bg-gray-200 rounded-lg" /></div>}>
      <MapContent />
    </Suspense>
  );
}
