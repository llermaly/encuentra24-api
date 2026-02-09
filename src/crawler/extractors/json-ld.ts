import type { CheerioAPI } from 'cheerio';

export interface JsonLdData {
  name: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  availability: string | null;
  imageUrl: string | null;
  addressCountry: string | null;
  addressLocality: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  sellerName: string | null;
  sellerType: string | null;
  raw: string;
}

/**
 * Extract and parse the JSON-LD Product schema from a detail page.
 */
export function extractJsonLd($: CheerioAPI): JsonLdData | null {
  let raw: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (content && content.includes('"Product"')) {
      raw = content;
    }
  });

  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    if (data['@type'] !== 'Product') return null;

    const offers = data.offers || {};
    const place = offers.availableAtOrFrom || {};
    const address = place.address || {};
    const seller = offers.seller || {};
    const image = data.image || {};

    // Clean seller name: remove "Agente " prefix
    let sellerName = seller.name || null;
    if (sellerName) {
      sellerName = sellerName.replace(/^Agente\s+/i, '').trim();
    }

    return {
      name: data.name || null,
      description: data.description || null,
      price: typeof offers.price === 'number' ? offers.price : parseFloat(offers.price) || null,
      currency: offers.priceCurrency || null,
      availability: offers.availability || null,
      imageUrl: image.contentUrl || null,
      addressCountry: address.addressCountry || null,
      addressLocality: address.addressLocality || null,
      streetAddress: address.streetAddress || null,
      postalCode: address.postalCode || null,
      sellerName,
      sellerType: seller['@type'] === 'Organization' ? 'agent' : 'owner',
      raw,
    };
  } catch {
    return null;
  }
}
