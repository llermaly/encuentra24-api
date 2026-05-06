'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import Link from 'next/link';
import { formatArea, formatPrice, formatRelativeDate } from '@/lib/formatters';

interface FavoriteItem {
  adId: string;
  favoritedAt: string;
  category: string | null;
  subcategory: string | null;
  title: string | null;
  price: number | null;
  currency: string | null;
  oldPrice: number | null;
  province: string | null;
  city: string | null;
  location: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  builtAreaSqm: number | null;
  landAreaSqm: number | null;
  thumbnail: string | null;
  imageCount: number | null;
  sellerName: string | null;
  agentName: string | null;
  sellerVerified: boolean | null;
  featureLevel: string | null;
  favoritesCount: number | null;
  publishedAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  removedAt: string | null;
  pipelineStage: string | null;
}

async function fetchFavorites(): Promise<FavoriteItem[]> {
  const response = await fetch('/api/favorites');
  if (!response.ok) throw new Error('Unable to load favorites');
  return response.json();
}

function compactValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

export default function FavoritesPage() {
  useUser({ or: 'redirect' });
  const queryClient = useQueryClient();

  const favorites = useQuery<FavoriteItem[]>({
    queryKey: ['favorites'],
    queryFn: fetchFavorites,
  });

  const removeFavorite = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch(`/api/favorites/${adId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to remove favorite');
    },
    onMutate: async (adId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<FavoriteItem[]>(['favorites']);
      queryClient.setQueryData<FavoriteItem[]>(['favorites'], (current) =>
        current?.filter((favorite) => favorite.adId !== adId) ?? []
      );
      return { previous };
    },
    onError: (_error, _adId, context) => {
      if (context?.previous) queryClient.setQueryData(['favorites'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const items = favorites.data ?? [];
  const activeItems = items.filter((item) => !item.removedAt);
  const removedCount = items.length - activeItems.length;
  const totalValue = activeItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const isLoading = favorites.isLoading;

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Watchlist</p>
          <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
            Favorite <span className="italic">properties</span>
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            {isLoading
              ? 'Loading...'
              : items.length === 0
                ? 'Heart listings you want to revisit from browse or detail pages.'
                : `${items.length.toLocaleString()} saved ${items.length === 1 ? 'property' : 'properties'}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/listings?isFavorite=true&status=all" className="aurora-pill aurora-pill-primary">
            Browse favorites
          </Link>
          <Link href="/listings" className="aurora-pill aurora-pill-ghost">
            Find more
          </Link>
        </div>
      </div>

      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <SummaryCell label="Saved" value={items.length.toLocaleString()} />
          <SummaryCell label="Active value" value={compactValue(totalValue)} />
          <SummaryCell label="Removed" value={removedCount.toLocaleString()} />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-56 rounded-3xl aurora-surface animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 rounded-3xl aurora-surface">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: 'linear-gradient(135deg, #ecf3ec, #ebe4cd)' }}
          >
            <svg className="w-7 h-7 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <p className="font-serif text-2xl text-stone-900">No favorites yet</p>
          <p className="text-sm text-stone-500 mt-1">
            Save properties from the{' '}
            <Link href="/listings" className="text-stone-800 underline-offset-4 hover:underline">browse page</Link>
            {' '}or any listing detail page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => (
            <FavoriteCard
              key={item.adId}
              item={item}
              removing={removeFavorite.isPending && removeFavorite.variables === item.adId}
              onRemove={() => removeFavorite.mutate(item.adId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="aurora-surface rounded-2xl px-5 py-4">
      <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">{label}</p>
      <p className="font-serif text-3xl text-stone-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function FavoriteCard({
  item,
  removing,
  onRemove,
}: {
  item: FavoriteItem;
  removing: boolean;
  onRemove: () => void;
}) {
  const placeText = [item.location, item.city, item.province].filter(Boolean).join(', ');
  const sellerText = item.agentName && item.sellerName
    ? `${item.agentName} · ${item.sellerName}`
    : item.agentName || item.sellerName;
  const specs = [
    item.bedrooms != null ? `${item.bedrooms} bd` : null,
    item.bathrooms != null ? `${item.bathrooms} ba` : null,
    item.parking != null && item.parking > 0 ? `${item.parking} parking` : null,
    item.builtAreaSqm != null ? formatArea(item.builtAreaSqm) : null,
    item.landAreaSqm != null ? `${formatArea(item.landAreaSqm)} land` : null,
  ].filter(Boolean);

  return (
    <article className={`group aurora-surface rounded-3xl overflow-hidden transition-all hover:-translate-y-0.5 ${item.removedAt ? 'opacity-75' : ''}`}>
      <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] min-h-56">
        <Link href={`/listings/${item.adId}`} className="relative block h-48 sm:h-auto bg-stone-100 overflow-hidden">
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt={item.title || ''}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center">
              <svg className="w-9 h-9 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4-4 4 4 8-8M4 4h16v16H4z" />
              </svg>
            </div>
          )}
          {item.removedAt && (
            <span className="absolute top-3 left-3 aurora-chip aurora-chip-warn backdrop-blur-md">
              Removed
            </span>
          )}
          {!item.removedAt && item.featureLevel && item.featureLevel !== 'basic' && (
            <span className="absolute top-3 left-3 aurora-chip aurora-chip-sand backdrop-blur-md capitalize">
              {item.featureLevel}
            </span>
          )}
        </Link>

        <div className="p-4 sm:p-5 flex flex-col min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-serif text-2xl text-stone-900 tracking-tight">
                {formatPrice(item.price, item.currency || 'USD')}
              </p>
              {item.oldPrice && item.oldPrice > (item.price ?? 0) && (
                <p className="text-xs text-stone-400 line-through">{formatPrice(item.oldPrice, item.currency || 'USD')}</p>
              )}
            </div>
            {item.pipelineStage && (
              <span className="aurora-chip aurora-chip-ink capitalize">{item.pipelineStage}</span>
            )}
          </div>

          <Link href={`/listings/${item.adId}`} className="mt-2 block min-w-0">
            <p className="text-sm text-stone-800 font-medium line-clamp-2">{item.title || item.adId}</p>
            <p className="text-xs text-stone-500 mt-0.5 truncate">{placeText || 'Location unknown'}</p>
          </Link>

          {specs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
              {specs.map((spec) => (
                <span key={spec} className="aurora-chip">{spec}</span>
              ))}
            </div>
          )}

          <div className="mt-auto pt-4">
            {sellerText && (
              <p className="text-xs text-stone-500 truncate mb-3">
                {sellerText}
                {item.sellerVerified && <span className="ml-1 text-sky-600">verified</span>}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-stone-500">
                Saved {formatRelativeDate(item.favoritedAt)}
                {item.firstSeenAt && <span className="text-stone-400"> · Seen {formatRelativeDate(item.firstSeenAt)}</span>}
              </p>
              <div className="flex items-center gap-2">
                <Link href={`/listings/${item.adId}`} className="aurora-pill aurora-pill-ghost text-xs py-1.5 px-3">
                  View
                </Link>
                <button
                  onClick={onRemove}
                  disabled={removing}
                  className="aurora-pill aurora-pill-ghost text-xs py-1.5 px-3 hover:text-stone-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removing ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
