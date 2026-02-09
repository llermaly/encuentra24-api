'use client';

import Link from 'next/link';
import { formatPrice, formatArea, formatRelativeDate } from '@/lib/formatters';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useEffect } from 'react';

interface ListingCardProps {
  listing: {
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
  };
}

export function ListingCard({ listing }: ListingCardProps) {
  const queryClient = useQueryClient();
  const [imgIndex, setImgIndex] = useState(0);
  const [visibleSrc, setVisibleSrc] = useState<string | null>(null);
  const images = listing.images?.length ? listing.images : [];
  const hasMultiple = images.length > 1;
  const loadedRef = useRef<Set<string>>(new Set());
  const preloadedRef = useRef(false);

  // Set initial visible image
  useEffect(() => {
    if (images.length > 0) setVisibleSrc(images[0]);
  }, []);

  // When imgIndex changes, show image only once loaded
  useEffect(() => {
    if (images.length === 0) return;
    const src = images[imgIndex];
    if (loadedRef.current.has(src)) {
      setVisibleSrc(src);
    } else {
      const img = new Image();
      img.onload = () => {
        loadedRef.current.add(src);
        setVisibleSrc(src);
      };
      img.src = src;
    }
  }, [imgIndex, images]);

  // Preload all images on first hover
  const preloadAll = useCallback(() => {
    if (preloadedRef.current || images.length <= 1) return;
    preloadedRef.current = true;
    images.forEach(src => {
      if (!loadedRef.current.has(src)) {
        const img = new Image();
        img.onload = () => loadedRef.current.add(src);
        img.src = src;
      }
    });
  }, [images]);

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (listing.isFavorite) {
        await fetch(`/api/favorites/${listing.adId}`, { method: 'DELETE' });
      } else {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adId: listing.adId }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  const prev = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImgIndex(i => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImgIndex(i => (i + 1) % images.length);
  }, [images.length]);

  return (
    <div className="bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-[4/3] bg-gray-100 group" onMouseEnter={preloadAll}>
        <Link href={`/listings/${listing.adId}`} className="block w-full h-full">
          {visibleSrc ? (
            <img
              src={visibleSrc}
              alt={listing.title || ''}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No image
            </div>
          )}
        </Link>

        {/* Carousel arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={prev}
              className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-700 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Dot indicators */}
        {hasMultiple && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.slice(0, 7).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === imgIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
            {images.length > 7 && (
              <span className="text-white text-[8px] leading-none self-center">+{images.length - 7}</span>
            )}
          </div>
        )}

        {/* Image count badge */}
        {listing.imageCount && listing.imageCount > 1 && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
            {imgIndex + 1}/{listing.imageCount}
          </span>
        )}

        {/* Feature level badge */}
        {listing.featureLevel && listing.featureLevel !== 'basic' && (
          <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-medium px-1.5 py-0.5 rounded">
            {listing.featureLevel}
          </span>
        )}

        {/* Pipeline badge */}
        {listing.pipelineStage && (
          <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
            {listing.pipelineStage}
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900">
              {formatPrice(listing.price, listing.currency || 'USD')}
              {listing.oldPrice && listing.oldPrice > (listing.price || 0) && (
                <span className="ml-2 text-sm line-through text-gray-400 font-normal">
                  {formatPrice(listing.oldPrice)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleFavorite.mutate();
            }}
            className={`shrink-0 p-1 rounded-full hover:bg-gray-100 ${listing.isFavorite ? 'text-red-500' : 'text-gray-300'}`}
          >
            <svg className="w-5 h-5" fill={listing.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
        <Link href={`/listings/${listing.adId}`}>
          <p className="text-sm text-gray-700 mt-1 truncate">{listing.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{[listing.location, listing.city, listing.province].filter(Boolean).join(', ')}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
            {listing.bedrooms != null && (
              <span>{listing.bedrooms} bd</span>
            )}
            {listing.bathrooms != null && (
              <span>{listing.bathrooms} ba</span>
            )}
            {listing.builtAreaSqm != null && (
              <span>{formatArea(listing.builtAreaSqm)}</span>
            )}
            {listing.parking != null && listing.parking > 0 && (
              <span>{listing.parking} pk</span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              {formatRelativeDate(listing.publishedAt || listing.firstSeenAt)}
            </p>
            {listing.favoritesCount != null && listing.favoritesCount > 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {listing.favoritesCount}
              </span>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
