'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import Link from 'next/link';
import { formatPrice } from '@/lib/formatters';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapListing {
  adId: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  location: string | null;
  latitude: number;
  longitude: number;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaSqm: number | null;
  thumbnail: string | null;
}

interface MapViewProps {
  listings: MapListing[];
  onBoundsChange?: (bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number }) => void;
}

function BoundsWatcher({ onBoundsChange }: { onBoundsChange?: MapViewProps['onBoundsChange'] }) {
  const map = useMap();

  useEffect(() => {
    if (!onBoundsChange) return;

    function handler() {
      const bounds = map.getBounds();
      onBoundsChange!({
        latMin: bounds.getSouth(),
        latMax: bounds.getNorth(),
        lngMin: bounds.getWest(),
        lngMax: bounds.getEast(),
      });
    }

    map.on('moveend', handler);
    return () => { map.off('moveend', handler); };
  }, [map, onBoundsChange]);

  return null;
}

// Panama City center
const DEFAULT_CENTER: [number, number] = [9.0, -79.5];
const DEFAULT_ZOOM = 11;

export function MapView({ listings, onBoundsChange }: MapViewProps) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="w-full h-full rounded-lg"
      style={{ minHeight: '500px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundsWatcher onBoundsChange={onBoundsChange} />
      <MarkerClusterGroup chunkedLoading>
        {listings.map(listing => (
          <Marker
            key={listing.adId}
            position={[listing.latitude, listing.longitude]}
          >
            <Popup>
              <div className="w-48">
                {listing.thumbnail && (
                  <img src={listing.thumbnail} alt="" className="w-full h-24 object-cover rounded mb-1" />
                )}
                <p className="font-bold text-sm">{formatPrice(listing.price, listing.currency || 'USD')}</p>
                <p className="text-xs text-gray-600 truncate">{listing.title}</p>
                <p className="text-xs text-gray-400">{listing.location}</p>
                <div className="text-xs text-gray-500 mt-1">
                  {listing.bedrooms != null && <span>{listing.bedrooms}bd </span>}
                  {listing.bathrooms != null && <span>{listing.bathrooms}ba </span>}
                  {listing.builtAreaSqm != null && <span>{listing.builtAreaSqm}m²</span>}
                </div>
                <Link href={`/listings/${listing.adId}`} className="text-xs text-blue-600 hover:underline mt-1 block">
                  View Details
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
