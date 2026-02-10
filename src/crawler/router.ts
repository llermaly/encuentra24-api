import { createCheerioRouter, log } from 'crawlee';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { listings, priceHistory, crawlErrors } from '../db/schema.js';
import { extractListingCards, extractGa4Data, extractPagination, extractResultsCount, mergeGa4DataIntoCards } from './extractors/list-page.js';
import { extractDetailData } from './extractors/detail-page.js';
import { buildListUrl, type CategoryConfig } from './categories.js';

export const router = createCheerioRouter();

/**
 * LIST handler — processes paginated search result pages.
 */
router.addHandler('LIST', async ({ $, request, enqueueLinks, crawler }) => {
  const { categoryConfig, regionSlug, maxPages, crawlRunId } = request.userData as {
    categoryConfig: CategoryConfig;
    regionSlug?: string;
    maxPages: number;
    crawlRunId: number;
  };

  const currentPage = (request.userData.page as number) || 1;
  log.info(`LIST page ${currentPage} for ${categoryConfig.label}`, { url: request.url });

  // Extract listing cards
  const cards = extractListingCards($);
  const ga4Data = extractGa4Data($);
  mergeGa4DataIntoCards(cards, ga4Data);

  if (cards.length === 0) {
    log.warning(`No listings found on page ${currentPage}`, { url: request.url });
    return;
  }

  log.info(`Found ${cards.length} listings on page ${currentPage}`);

  const db = getDb();
  const now = new Date().toISOString();
  let newCount = 0;
  let updatedCount = 0;

  for (const card of cards) {
    // Check if listing already exists
    const existing = await db
      .select({ adId: listings.adId, price: listings.price })
      .from(listings)
      .where(eq(listings.adId, card.adId))
      .get();

    if (!existing) {
      // New listing — insert
      await db.insert(listings).values({
        adId: card.adId,
        slug: card.slug,
        url: card.url,
        category: categoryConfig.category,
        subcategory: categoryConfig.subcategory,
        title: card.title,
        price: card.price,
        location: card.location,
        bedrooms: card.bedrooms,
        bathrooms: card.bathrooms,
        parking: card.parking,
        builtAreaSqm: card.areaSqm,
        sellerName: card.sellerName,
        sellerVerified: card.sellerVerified,
        featureLevel: card.featureLevel,
        favoritesCount: card.favoritesCount,
        images: card.imageUrl ? [card.imageUrl] : [],
        imageCount: card.imageUrl ? 1 : 0,
        regionSlug: regionSlug || null,
        firstSeenAt: now,
        lastSeenAt: now,
        updatedAt: now,
        detailCrawled: false,
      });
      newCount++;
    } else {
      // Existing listing — check for price change
      const priceChanged = card.price !== null && existing.price !== card.price;

      if (priceChanged) {
        // Record price change
        await db.insert(priceHistory).values({
          adId: card.adId,
          price: card.price!,
          currency: 'USD',
          source: 'crawl',
          recordedAt: now,
        });

        // Update listing and re-enqueue detail
        await db.update(listings)
          .set({
            price: card.price,
            lastSeenAt: now,
            updatedAt: now,
            detailCrawled: false, // re-crawl detail on price change
          })
          .where(eq(listings.adId, card.adId));
        updatedCount++;
      } else {
        // Same price — just update lastSeenAt
        await db.update(listings)
          .set({ lastSeenAt: now })
          .where(eq(listings.adId, card.adId));
      }
    }
  }

  log.info(`Page ${currentPage}: ${newCount} new, ${updatedCount} updated, ${cards.length - newCount - updatedCount} unchanged`);

  // Update crawl run stats
  await db.update(crawlErrors); // no-op, just to ensure table exists
  // We'll update crawl_runs stats in the main orchestrator

  // Enqueue detail pages for new/price-changed listings
  const detailUrls = cards
    .filter((card) => {
      // Only enqueue if we just inserted or price changed
      return true; // The detail-only filter happens in the DETAIL handler via detailCrawled flag
    })
    .map((card) => ({
      url: card.url,
      label: 'DETAIL',
      userData: { adId: card.adId, crawlRunId },
    }));

  // Actually, we should only enqueue details for listings where detailCrawled is false
  // Query DB for these
  for (const card of cards) {
    const listing = await db
      .select({ detailCrawled: listings.detailCrawled })
      .from(listings)
      .where(eq(listings.adId, card.adId))
      .get();

    if (listing && !listing.detailCrawled) {
      await crawler.addRequests([{
        url: card.url,
        label: 'DETAIL',
        userData: { adId: card.adId, crawlRunId },
      }]);
    }
  }

  // Enqueue next page if within limits
  const pagination = extractPagination($);
  let maxPage = Math.max(...pagination, currentPage);

  // Use results count as fallback for total pages (guards against truncated pagination UI)
  const resultsCount = extractResultsCount($);
  if (resultsCount !== null && resultsCount > 0) {
    const totalPages = Math.ceil(resultsCount / 30);
    maxPage = Math.max(maxPage, totalPages);
  }

  const nextPage = currentPage + 1;

  if (nextPage <= maxPage && nextPage <= maxPages) {
    const nextUrl = buildListUrl(categoryConfig, regionSlug, nextPage);
    await crawler.addRequests([{
      url: nextUrl,
      label: 'LIST',
      userData: {
        categoryConfig,
        regionSlug,
        maxPages,
        crawlRunId,
        page: nextPage,
      },
    }]);
  }
});

/**
 * DETAIL handler — processes individual listing detail pages.
 */
router.addHandler('DETAIL', async ({ $, request }) => {
  const { adId, crawlRunId } = request.userData as {
    adId: string;
    crawlRunId: number;
  };

  log.info(`DETAIL page for ad ${adId}`, { url: request.url });

  const detail = extractDetailData($);
  const db = getDb();
  const now = new Date().toISOString();

  // Build update object — only set non-null values from detail
  const updates: Record<string, unknown> = {
    detailCrawled: true,
    updatedAt: now,
    lastSeenAt: now,
  };

  if (detail.title) updates.title = detail.title;
  if (detail.description) updates.description = detail.description;
  if (detail.price !== null) updates.price = detail.price;
  if (detail.currency) updates.currency = detail.currency;
  if (detail.oldPrice !== null) updates.oldPrice = detail.oldPrice;
  if (detail.housingType) updates.housingType = detail.housingType;

  // Location
  if (detail.addressLocality) updates.location = detail.addressLocality;
  if (detail.streetAddress) updates.address = detail.streetAddress;
  if (detail.city) updates.city = detail.city;
  if (detail.latitude !== null) updates.latitude = detail.latitude;
  if (detail.longitude !== null) updates.longitude = detail.longitude;

  // Specs
  if (detail.bedrooms !== null) updates.bedrooms = detail.bedrooms;
  if (detail.bathrooms !== null) updates.bathrooms = detail.bathrooms;
  if (detail.parking !== null) updates.parking = detail.parking;
  if (detail.builtAreaSqm !== null) updates.builtAreaSqm = detail.builtAreaSqm;
  if (detail.landAreaSqm !== null) updates.landAreaSqm = detail.landAreaSqm;
  if (detail.totalSqm !== null) updates.totalSqm = detail.totalSqm;
  if (detail.pricePerSqmConstruction !== null) updates.pricePerSqmConstruction = detail.pricePerSqmConstruction;
  if (detail.pricePerSqmLand !== null) updates.pricePerSqmLand = detail.pricePerSqmLand;
  if (detail.yearBuilt !== null) updates.yearBuilt = detail.yearBuilt;
  if (detail.levels !== null) updates.levels = detail.levels;
  if (detail.floorNumber !== null) updates.floorNumber = detail.floorNumber;
  if (detail.floorType) updates.floorType = detail.floorType;
  if (detail.ceilingHeight !== null) updates.ceilingHeight = detail.ceilingHeight;
  if (detail.maintenanceCost !== null) updates.maintenanceCost = detail.maintenanceCost;
  if (detail.titleStatus) updates.titleStatus = detail.titleStatus;

  // Media
  if (detail.images.length > 0) {
    updates.images = detail.images;
    updates.imageCount = detail.images.length;
  }
  updates.hasVideo = detail.hasVideo;
  updates.hasVr = detail.hasVr;

  // Seller
  if (detail.sellerName) updates.sellerName = detail.sellerName;
  if (detail.agentName) updates.agentName = detail.agentName;
  if (detail.sellerType) updates.sellerType = detail.sellerType;

  // Amenities
  if (detail.amenities.length > 0) updates.amenities = detail.amenities;

  // Dates
  if (detail.publishedAt) updates.publishedAt = detail.publishedAt;

  // Raw data
  if (detail.rawJsonLd) updates.rawJsonLd = detail.rawJsonLd;
  if (detail.rawLoopaData) updates.rawLoopaData = detail.rawLoopaData;
  if (detail.rawRetailRocket) updates.rawRetailRocket = detail.rawRetailRocket;

  // Record oldPrice in price_history if present
  if (detail.oldPrice !== null) {
    const existingOldPrice = await db
      .select({ id: priceHistory.id })
      .from(priceHistory)
      .where(eq(priceHistory.adId, adId))
      .get();

    if (!existingOldPrice) {
      await db.insert(priceHistory).values({
        adId,
        price: detail.oldPrice,
        currency: 'USD',
        source: 'retail_rocket_old_price',
        recordedAt: now,
      });
    }
  }

  await db.update(listings)
    .set(updates)
    .where(eq(listings.adId, adId));

  log.info(`Updated detail for ad ${adId}: ${detail.bedrooms}bd/${detail.bathrooms}ba, ${detail.builtAreaSqm}m², ${detail.images.length} images`);
});
