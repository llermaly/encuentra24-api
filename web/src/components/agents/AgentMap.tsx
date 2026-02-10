'use client';

import dynamic from 'next/dynamic';

interface GeoListing {
  adId: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  lat: number;
  lng: number;
  location: string | null;
}

interface AgentMapProps {
  listings: GeoListing[];
}

const MapInner = dynamic(() => import('./AgentMapInner'), { ssr: false });

export function AgentMap({ listings }: AgentMapProps) {
  if (listings.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
        No geocoded listings to display
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden" style={{ height: '400px' }}>
      <MapInner listings={listings} />
    </div>
  );
}
