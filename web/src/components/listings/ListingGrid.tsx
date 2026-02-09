'use client';

import { ListingCard } from './ListingCard';

interface ListingGridProps {
  listings: Array<{
    adId: string;
    title: string | null;
    price: number | null;
    currency: string | null;
    oldPrice: number | null;
    location: string | null;
    province: string | null;
    city: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    parking: number | null;
    builtAreaSqm: number | null;
    landAreaSqm: number | null;
    images: string[];
    imageCount: number | null;
    isFavorite: boolean;
    pipelineStage: string | null;
    firstSeenAt: string;
    publishedAt: string | null;
    sellerName: string | null;
    featureLevel: string | null;
    favoritesCount: number | null;
  }>;
  isLoading: boolean;
}

export function ListingGrid({ listings, isLoading }: ListingGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border overflow-hidden animate-pulse">
            <div className="aspect-[4/3] bg-gray-200" />
            <div className="p-3 space-y-2">
              <div className="h-5 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No listings found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {listings.map(listing => (
        <ListingCard key={listing.adId} listing={listing} />
      ))}
    </div>
  );
}
