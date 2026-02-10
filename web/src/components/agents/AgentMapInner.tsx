'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { formatPrice } from '@/lib/formatters';
import Link from 'next/link';

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

interface GeoListing {
  adId: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  lat: number;
  lng: number;
  location: string | null;
}

export default function AgentMapInner({ listings }: { listings: GeoListing[] }) {
  // Calculate center from listings
  const avgLat = listings.reduce((s, l) => s + l.lat, 0) / listings.length;
  const avgLng = listings.reduce((s, l) => s + l.lng, 0) / listings.length;

  return (
    <MapContainer
      center={[avgLat, avgLng]}
      zoom={12}
      className="w-full h-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup chunkedLoading>
        {listings.map(listing => (
          <Marker
            key={listing.adId}
            position={[listing.lat, listing.lng]}
          >
            <Popup>
              <div className="w-44">
                <p className="font-bold text-sm">{formatPrice(listing.price, listing.currency || 'USD')}</p>
                <p className="text-xs text-gray-600 truncate">{listing.title}</p>
                <p className="text-xs text-gray-400">{listing.location}</p>
                <Link href={`/listings/${listing.adId}`} className="text-xs text-blue-600 hover:underline mt-1 block">
                  View Listing
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
