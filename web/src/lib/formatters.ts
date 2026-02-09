import { formatDistanceToNow, format, parseISO } from 'date-fns';

export function formatPrice(price: number | null | undefined, currency = 'USD'): string {
  if (price == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatArea(sqm: number | null | undefined): string {
  if (sqm == null) return 'N/A';
  return `${sqm.toLocaleString('en-US', { maximumFractionDigits: 0 })} m²`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
}

export function formatPricePerSqm(price: number | null | undefined): string {
  if (price == null) return 'N/A';
  return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}/m²`;
}
