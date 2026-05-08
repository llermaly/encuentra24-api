import { formatDate, formatPrice } from '@/lib/formatters';
import type {
  DailySummaryDigest,
  DigestListing,
  SummaryCadence,
} from '@/lib/notifications/daily-summary';

const MAX_MESSAGE_LENGTH = 3200;

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

function renderListing(listing: DigestListing, index: number) {
  const lines = [
    `${index}. ${formatPrice(listing.price, listing.currency ?? 'USD')} - ${listing.title || listing.adId}`,
  ];
  const location = locationLine(listing);
  const meta = listingMeta(listing);
  if (location) lines.push(location);
  if (meta) lines.push(meta);
  if (listing.url) lines.push(listing.url);
  return lines.join('\n');
}

function getHeader(digest: DailySummaryDigest, cadence: SummaryCadence, totalListings: number) {
  const label = cadence === 'daily' ? 'Daily' : 'Weekly';
  return [
    `Encuentra24 ${label.toLowerCase()} WhatsApp summary`,
    `${formatDate(digest.periodStart)} to ${formatDate(digest.periodEnd)}`,
    '',
    `${totalListings} new ${totalListings === 1 ? 'property' : 'properties'} from your saved searches.`,
  ].join('\n');
}

export function renderWhatsappDigestMessages(
  digest: DailySummaryDigest,
  cadence: SummaryCadence
) {
  const totalListings = digest.savedSearches.reduce((sum, group) => sum + group.listings.length, 0);

  if (totalListings === 0) {
    return [[
      `Encuentra24 ${cadence} WhatsApp summary`,
      `${formatDate(digest.periodStart)} to ${formatDate(digest.periodEnd)}`,
      '',
      `No new properties for the ${cadenceNoun(cadence)}.`,
    ].join('\n')];
  }

  const messages: string[] = [];
  let current = getHeader(digest, cadence, totalListings);
  let itemIndex = 1;

  for (const group of digest.savedSearches) {
    const groupHeader = `\n\n${group.name}`;
    if ((current + groupHeader).length > MAX_MESSAGE_LENGTH) {
      messages.push(current);
      current = `${getHeader(digest, cadence, totalListings)}\n\nContinued`;
    }
    current += groupHeader;

    for (const listing of group.listings) {
      const block = `\n\n${renderListing(listing, itemIndex)}`;
      if ((current + block).length > MAX_MESSAGE_LENGTH) {
        messages.push(current);
        current = `${getHeader(digest, cadence, totalListings)}\n\nContinued`;
      }
      current += block;
      itemIndex += 1;
    }
  }

  if (current.trim()) messages.push(current);
  return messages;
}
