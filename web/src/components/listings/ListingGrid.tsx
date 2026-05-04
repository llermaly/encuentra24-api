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
    agentName: string | null;
    sellerVerified: boolean | null;
    removedAt: string | null;
    featureLevel: string | null;
    favoritesCount: number | null;
  }>;
  isLoading: boolean;
}

export function ListingGrid({ listings, isLoading }: ListingGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-3xl aurora-surface overflow-hidden animate-pulse">
            <div className="aspect-[5/4] bg-stone-200/60" />
            <div className="px-5 py-4 space-y-2.5">
              <div className="h-7 bg-stone-200/60 rounded-md w-1/2" />
              <div className="h-4 bg-stone-200/60 rounded-md w-3/4" />
              <div className="h-3 bg-stone-200/60 rounded-md w-1/3" />
              <div className="flex gap-2 pt-2">
                <div className="h-3 w-10 bg-stone-200/60 rounded-md" />
                <div className="h-3 w-10 bg-stone-200/60 rounded-md" />
                <div className="h-3 w-12 bg-stone-200/60 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-20 rounded-3xl aurora-surface">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
             style={{ background: 'linear-gradient(135deg, #ecf3ec, #ebe4cd)' }}>
          <svg className="w-7 h-7 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="font-serif text-2xl text-stone-900">Nothing here yet</p>
        <p className="text-sm text-stone-500 mt-1">Try loosening your filters or saving the search to be notified.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {listings.map(listing => (
        <ListingCard key={listing.adId} listing={listing} />
      ))}
    </div>
  );
}
