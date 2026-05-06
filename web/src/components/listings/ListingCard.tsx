'use client';

import Link from 'next/link';
import { formatPrice, formatArea, formatRelativeDate } from '@/lib/formatters';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useMemo } from 'react';

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
    agentName: string | null;
    sellerVerified: boolean | null;
    removedAt: string | null;
    featureLevel: string | null;
    favoritesCount: number | null;
  };
}

export function ListingCard({ listing }: ListingCardProps) {
  const queryClient = useQueryClient();
  const [imgIndex, setImgIndex] = useState(0);
  const images = useMemo(() => listing.images?.length ? listing.images : [], [listing.images]);
  const hasMultiple = images.length > 1;
  const preloadedRef = useRef(false);
  const visibleSrc = images[imgIndex] ?? images[0] ?? null;

  const preloadAll = useCallback(() => {
    if (preloadedRef.current || images.length <= 1) return;
    preloadedRef.current = true;
    images.forEach(src => {
      const img = new Image();
      img.src = src;
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
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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

  const placeText = [listing.location, listing.city, listing.province].filter(Boolean).join(', ');
  const priceDropPct =
    listing.oldPrice && listing.price && listing.oldPrice > listing.price
      ? Math.round(((listing.oldPrice - listing.price) / listing.oldPrice) * 100)
      : null;

  return (
    <article
      className={`group relative rounded-3xl overflow-hidden transition-all duration-300
        ${listing.removedAt ? 'opacity-70' : 'hover:-translate-y-1'}
      `}
      style={{
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'saturate(140%) blur(12px)',
        border: '1px solid rgba(255,255,255,0.85)',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -12px rgba(28,25,23,0.08)',
      }}
    >
      <div className="relative aspect-[5/4] bg-stone-100 overflow-hidden" onMouseEnter={preloadAll}>
        <Link href={`/listings/${listing.adId}`} className="block w-full h-full">
          {visibleSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={visibleSrc}
              alt={listing.title || ''}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
              <svg className="w-10 h-10 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4-4 4 4 8-8M4 4h16v16H4z" />
              </svg>
            </div>
          )}
        </Link>

        {/* Gradient bottom for legibility */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {listing.removedAt && (
            <span className="aurora-chip aurora-chip-warn backdrop-blur-md">
              Removed · {formatRelativeDate(listing.removedAt)}
            </span>
          )}
          {!listing.removedAt && listing.featureLevel && listing.featureLevel !== 'basic' && (
            <span className="aurora-chip aurora-chip-sand backdrop-blur-md capitalize">
              ★ {listing.featureLevel}
            </span>
          )}
          {priceDropPct != null && priceDropPct > 0 && (
            <span className="aurora-chip aurora-chip-mint backdrop-blur-md">
              ↓ {priceDropPct}% drop
            </span>
          )}
        </div>

        {/* Pipeline stage */}
        {listing.pipelineStage && (
          <span className="absolute top-3 right-3 aurora-chip aurora-chip-ink backdrop-blur-md capitalize z-10">
            {listing.pipelineStage}
          </span>
        )}

        {/* Favorite */}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleFavorite.mutate();
          }}
          className={`absolute z-10 ${listing.pipelineStage ? 'top-12' : 'top-3'} right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all
            ${listing.isFavorite
              ? 'bg-stone-900 text-white shadow-lg shadow-stone-400/40'
              : 'bg-white/85 backdrop-blur text-stone-700 hover:bg-white hover:text-stone-900'}`}
          aria-label={listing.isFavorite ? 'Unfavorite' : 'Favorite'}
        >
          <svg className="w-4 h-4" fill={listing.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Carousel arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 backdrop-blur text-stone-700 opacity-0 group-hover:opacity-100 hover:bg-white transition-all shadow-md flex items-center justify-center"
              aria-label="Previous image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 backdrop-blur text-stone-700 opacity-0 group-hover:opacity-100 hover:bg-white transition-all shadow-md flex items-center justify-center"
              aria-label="Next image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Dot indicators */}
        {hasMultiple && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {images.slice(0, 7).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${i === imgIndex ? 'w-4 bg-white' : 'w-1 bg-white/60'}`}
              />
            ))}
            {images.length > 7 && (
              <span className="text-white/80 text-[10px] leading-none self-center ml-0.5">+{images.length - 7}</span>
            )}
          </div>
        )}

        {/* Bottom-right time */}
        <div className="absolute bottom-3 right-3 text-[10px] text-white/90 font-medium tracking-wide z-10">
          {formatRelativeDate(listing.publishedAt || listing.firstSeenAt)}
        </div>
      </div>

      <Link href={`/listings/${listing.adId}`} className="block px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-serif text-2xl text-stone-900 tracking-tight">
            {formatPrice(listing.price, listing.currency || 'USD')}
          </p>
          {listing.oldPrice && listing.oldPrice > (listing.price || 0) && (
            <p className="text-xs text-stone-400 line-through">
              {formatPrice(listing.oldPrice)}
            </p>
          )}
        </div>

        <p className="mt-1 text-sm text-stone-700 line-clamp-1 font-medium">{listing.title || '—'}</p>
        <p className="text-xs text-stone-500 mt-0.5 truncate">{placeText || '—'}</p>

        {/* Specs */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-stone-600">
          {listing.bedrooms != null && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10v8a1 1 0 001 1h16a1 1 0 001-1v-8M3 10V6a2 2 0 012-2h14a2 2 0 012 2v4M3 10h18M7 14h4M13 14h4" />
              </svg>
              {listing.bedrooms} bd
            </span>
          )}
          {listing.bathrooms != null && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12V5a2 2 0 012-2h2v3M3 12h18v3a4 4 0 01-4 4H7a4 4 0 01-4-4v-3z" />
              </svg>
              {listing.bathrooms} ba
            </span>
          )}
          {listing.builtAreaSqm != null && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
              {formatArea(listing.builtAreaSqm)}
            </span>
          )}
          {listing.parking != null && listing.parking > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 17h14M5 17V7l3-3h8l3 3v10M5 17H3m16 0h2M8 14h2m4 0h2" />
              </svg>
              {listing.parking}
            </span>
          )}
          {listing.favoritesCount != null && listing.favoritesCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-stone-400">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {listing.favoritesCount}
            </span>
          )}
        </div>

        {/* Seller */}
        {(listing.agentName || listing.sellerName) && (
          <div className="mt-3 pt-3 border-t border-stone-200/60 flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-stone-700 shrink-0"
              style={{ background: 'linear-gradient(135deg, #ecf3ec, #ebe4cd)' }}
            >
              {(listing.agentName || listing.sellerName || '').charAt(0).toUpperCase()}
            </span>
            <p className="text-xs text-stone-600 truncate flex items-center gap-1">
              <span className="truncate">
                {listing.agentName && listing.sellerName
                  ? `${listing.agentName} · ${listing.sellerName}`
                  : listing.agentName || listing.sellerName}
              </span>
              {listing.sellerVerified && (
                <svg className="w-3.5 h-3.5 text-sky-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </p>
          </div>
        )}
      </Link>
    </article>
  );
}
