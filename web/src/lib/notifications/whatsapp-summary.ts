import { formatDate, formatPrice } from '@/lib/formatters';
import type {
  DailySummaryDigest,
  DigestListing,
  DigestSearchGroup,
  SummaryCadence,
} from '@/lib/notifications/daily-summary';

export interface WhatsappDigestCard {
  listing: DigestListing;
  searchName: string;
  index: number;
  total: number;
}

function cadenceNoun(cadence: SummaryCadence) {
  return cadence === 'daily' ? 'day' : 'week';
}

function listingMeta(listing: DigestListing) {
  const parts = [];
  if (listing.bedrooms != null) parts.push(`${listing.bedrooms} bd`);
  if (listing.bathrooms != null) parts.push(`${listing.bathrooms} ba`);
  if (listing.builtAreaSqm != null) parts.push(`${Math.round(listing.builtAreaSqm)} m2`);
  return parts.join(' | ');
}

function locationLine(listing: DigestListing) {
  return [listing.location, listing.city, listing.province].filter(Boolean).join(', ');
}

function getTotalListings(digest: DailySummaryDigest) {
  return digest.savedSearches.reduce((sum, group) => sum + group.listings.length, 0);
}

function getSearchCounts(groups: DigestSearchGroup[]) {
  return groups
    .map(group => ({
      name: group.name,
      count: group.listings.length,
    }))
    .filter(group => group.count > 0);
}

function cadenceLabel(cadence: SummaryCadence) {
  return cadence === 'daily' ? 'daily' : 'weekly';
}

export function getWhatsappDigestCards(
  digest: DailySummaryDigest,
  limit = Number.POSITIVE_INFINITY
): WhatsappDigestCard[] {
  const allCards = digest.savedSearches.flatMap(group =>
    group.listings.map(listing => ({
      listing,
      searchName: group.name,
    }))
  );
  const total = allCards.length;
  return allCards.slice(0, limit).map((card, index) => ({
    ...card,
    index: index + 1,
    total,
  }));
}

export function renderWhatsappDigestIntroMessage(
  digest: DailySummaryDigest,
  cadence: SummaryCadence,
  cardLimit = Number.POSITIVE_INFINITY,
  greetingName?: string | null
) {
  const totalListings = getTotalListings(digest);
  const label = cadenceLabel(cadence);
  const greeting = greetingName?.trim() ? [`Hi ${greetingName.trim()},`, ''] : [];

  if (totalListings === 0) {
    return [
      ...greeting,
      `Encuentra24 ${label} summary`,
      `${formatDate(digest.periodStart)} to ${formatDate(digest.periodEnd)}`,
      '',
      `No new properties for the ${cadenceNoun(cadence)}.`,
    ].join('\n');
  }

  const searchCounts = getSearchCounts(digest.savedSearches);
  const searchWord = searchCounts.length === 1 ? 'saved search' : 'saved searches';
  const shownCount = Math.min(totalListings, cardLimit);

  return [
    ...greeting,
    `Encuentra24 ${label} summary`,
    `${formatDate(digest.periodStart)} to ${formatDate(digest.periodEnd)}`,
    '',
    `${totalListings} new ${totalListings === 1 ? 'property' : 'properties'} across ${searchCounts.length} ${searchWord}:`,
    ...searchCounts.map(group => `- ${group.name}: ${group.count} ${group.count === 1 ? 'property' : 'properties'}`),
    '',
    shownCount === totalListings
      ? 'Sending property cards next with thumbnails and links.'
      : `Sending the first ${shownCount} property cards next with thumbnails and links.`,
  ].join('\n');
}

export function renderWhatsappListingCardCaption(card: WhatsappDigestCard) {
  const { listing, searchName, index, total } = card;
  const lines = [
    `${index}/${total} - ${formatPrice(listing.price, listing.currency ?? 'USD')} - ${listing.title || listing.adId}`,
    '',
    locationLine(listing),
    listingMeta(listing),
    '',
    `Saved search: ${searchName}`,
    `Seen: ${formatDate(listing.eventAt)}`,
    '',
    listing.url,
  ];

  return lines.filter(line => line != null && line !== '').join('\n');
}

export function renderWhatsappListingTextFallback(card: WhatsappDigestCard) {
  return renderWhatsappListingCardCaption(card);
}

export function renderWhatsappDigestOverflowMessage(extraCount: number) {
  return `+${extraCount} more new ${extraCount === 1 ? 'property' : 'properties'}. Open the dashboard to review the rest.`;
}

export function renderWhatsappDigestMessages(
  digest: DailySummaryDigest,
  cadence: SummaryCadence,
  cardLimit = Number.POSITIVE_INFINITY
) {
  const totalListings = getTotalListings(digest);
  const messages = [renderWhatsappDigestIntroMessage(digest, cadence, cardLimit)];

  if (totalListings > 0) {
    const cards = getWhatsappDigestCards(digest, cardLimit);
    messages.push(...cards.map(renderWhatsappListingCardCaption));
    const extraCount = totalListings - cards.length;
    if (extraCount > 0) messages.push(renderWhatsappDigestOverflowMessage(extraCount));
  }

  return messages;
}
