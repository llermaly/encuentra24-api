import { createCheerioRouter, log } from 'crawlee';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { listings, priceHistory, crawlSeenListings } from '../db/schema.js';
import { config } from '../config.js';
import { extractListingCards, extractGa4Data, extractPagination, extractResultsCount, mergeGa4DataIntoCards } from './extractors/list-page.js';
import { extractDetailData } from './extractors/detail-page.js';
import { buildListUrl, findCategory, type CategoryConfig } from './categories.js';
import { isRealEstateUrl, matchesCategorySlug } from './utils/url.js';
import { addPageMetrics, incrementCrawlMetric } from './metrics.js';
import {
  buildListingDatasetEvent,
  pushListingDatasetEvents,
  type ListingDatasetEvent,
} from './dataset-sync.js';

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
    trackSeen?: boolean;
    crawlDetails?: boolean;
    syncDataset?: boolean;
  };

  const currentPage = (request.userData.page as number) || 1;
  log.info(`LIST page ${currentPage} for ${categoryConfig.label}`, { url: request.url });

  const loadedUrl = request.loadedUrl || request.url;
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || loadedUrl;
  if (!matchesCategorySlug(loadedUrl, categoryConfig.slug) || !matchesCategorySlug(canonicalUrl, categoryConfig.slug)) {
    log.warning('Skipping list page because final URL/canonical no longer match the requested real-estate category', {
      requestedUrl: request.url,
      loadedUrl,
      canonicalUrl,
      expectedSlug: categoryConfig.slug,
    });
    return;
  }

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
  let unchangedCount = 0;
  let skippedCount = 0;
  const validCards: typeof cards = [];
  const seenValues: (typeof crawlSeenListings.$inferInsert)[] = [];

  for (const card of cards) {
    if (!isRealEstateUrl(card.url) || !matchesCategorySlug(card.url, categoryConfig.slug)) {
      skippedCount++;
      log.warning('Skipping listing outside the requested real-estate category', {
        adId: card.adId,
        listingUrl: card.url,
        expectedSlug: categoryConfig.slug,
      });
      continue;
    }

    validCards.push(card);

    if (request.userData.trackSeen) {
      seenValues.push({
        crawlRunId,
        adId: card.adId,
        seenAt: now,
      });
    }
  }

  const existingRows = validCards.length === 0
    ? []
    : await db
      .select({
        adId: listings.adId,
        price: listings.price,
        removedAt: listings.removedAt,
        detailCrawled: listings.detailCrawled,
      })
      .from(listings)
      .where(inArray(listings.adId, validCards.map((card) => card.adId)));

  const existingByAdId = new Map(existingRows.map((row) => [row.adId, row]));
  const newListingValues: (typeof listings.$inferInsert)[] = [];
  const priceHistoryValues: (typeof priceHistory.$inferInsert)[] = [];
  const detailRequests: { url: string; label: 'DETAIL'; userData: { adId: string; crawlRunId: number; syncDataset?: boolean } }[] = [];
  const datasetEvents: ListingDatasetEvent[] = [];

  for (const card of validCards) {
    const existing = existingByAdId.get(card.adId);
    if (!existing) {
      newListingValues.push({
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
      datasetEvents.push(buildListingDatasetEvent({
        eventType: 'listing.card.inserted',
        crawlRunId,
        adId: card.adId,
        url: card.url,
        occurredAt: now,
        postgres: {
          table: 'listings',
          operation: 'insert',
          fields: [
            'adId',
            'slug',
            'url',
            'category',
            'subcategory',
            'title',
            'price',
            'location',
            'bedrooms',
            'bathrooms',
            'parking',
            'builtAreaSqm',
            'sellerName',
            'sellerVerified',
            'featureLevel',
            'favoritesCount',
            'images',
            'imageCount',
            'regionSlug',
            'firstSeenAt',
            'lastSeenAt',
            'updatedAt',
            'detailCrawled',
          ],
        },
        listing: {
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
          imageUrl: card.imageUrl,
          regionSlug: regionSlug || null,
          detailCrawled: false,
          firstSeenAt: now,
          lastSeenAt: now,
          updatedAt: now,
        },
      }));
      newCount++;
      detailRequests.push({
        url: card.url,
        label: 'DETAIL',
        userData: { adId: card.adId, crawlRunId, syncDataset: request.userData.syncDataset },
      });
    } else {
      // Existing listing — check for price change
      // Use rounding to avoid float noise (e.g. 199743680 vs 199743682)
      const priceChanged = card.price !== null && existing.price !== null
        && Math.round(card.price) !== Math.round(existing.price);

      if (priceChanged) {
        priceHistoryValues.push({
          adId: card.adId,
          price: existing.price!,
          currency: 'USD',
          source: 'crawl',
          recordedAt: now,
        });

        // Update listing to the new price and re-enqueue detail
        await db.update(listings)
          .set({
            oldPrice: existing.price,
            price: card.price,
            lastSeenAt: now,
            updatedAt: now,
            removedAt: null, // clear removal if re-published
            detailCrawled: false, // re-crawl detail on price change
          })
          .where(eq(listings.adId, card.adId));
        datasetEvents.push(buildListingDatasetEvent({
          eventType: 'listing.price.updated',
          crawlRunId,
          adId: card.adId,
          url: card.url,
          occurredAt: now,
          postgres: {
            table: 'listings',
            operation: 'update',
            fields: ['oldPrice', 'price', 'lastSeenAt', 'updatedAt', 'removedAt', 'detailCrawled'],
          },
          listing: {
            adId: card.adId,
            url: card.url,
            category: categoryConfig.category,
            subcategory: categoryConfig.subcategory,
            title: card.title,
            price: card.price,
            oldPrice: existing.price,
            detailCrawled: false,
            lastSeenAt: now,
            updatedAt: now,
          },
          changes: {
            price: { from: existing.price, to: card.price },
            detailCrawled: { to: false },
            removedAt: { to: null },
          },
        }));
        updatedCount++;
        detailRequests.push({
          url: card.url,
          label: 'DETAIL',
          userData: { adId: card.adId, crawlRunId, syncDataset: request.userData.syncDataset },
        });
      } else {
        if (existing.removedAt !== null) {
          // Listing reappeared after being marked removed.
          await db.update(listings)
            .set({ lastSeenAt: now, removedAt: null, updatedAt: now })
            .where(eq(listings.adId, card.adId));
          datasetEvents.push(buildListingDatasetEvent({
            eventType: 'listing.reappeared',
            crawlRunId,
            adId: card.adId,
            url: card.url,
            occurredAt: now,
            postgres: {
              table: 'listings',
              operation: 'update',
              fields: ['lastSeenAt', 'removedAt', 'updatedAt'],
            },
            listing: {
              adId: card.adId,
              url: card.url,
              category: categoryConfig.category,
              subcategory: categoryConfig.subcategory,
              title: card.title,
              price: card.price,
              lastSeenAt: now,
              updatedAt: now,
              removedAt: null,
            },
            changes: {
              removedAt: { from: existing.removedAt, to: null },
            },
          }));
          updatedCount++;
        } else {
          // Same price and still active: skip the listing row write.
          unchangedCount++;
        }

        if (!existing.detailCrawled) {
          detailRequests.push({
            url: card.url,
            label: 'DETAIL',
            userData: { adId: card.adId, crawlRunId, syncDataset: request.userData.syncDataset },
          });
        }
      }
    }
  }

  if (newListingValues.length > 0) {
    await db.insert(listings)
      .values(newListingValues)
      .onConflictDoNothing();
  }

  if (priceHistoryValues.length > 0) {
    await db.insert(priceHistory).values(priceHistoryValues);
  }

  if (seenValues.length > 0) {
    await db.insert(crawlSeenListings)
      .values(seenValues)
      .onConflictDoNothing();
  }

  await pushListingDatasetEvents(request.userData.syncDataset, datasetEvents);

  addPageMetrics(crawlRunId, {
    listingsFound: cards.length - skippedCount,
    listingsNew: newCount,
    listingsUpdated: updatedCount,
    listingsSkipped: skippedCount,
  });

  log.info(`Page ${currentPage}: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged, ${skippedCount} skipped`);

  if (request.userData.crawlDetails !== false && detailRequests.length > 0) {
    await crawler.addRequests(detailRequests);
  }

  // Enqueue next page if within limits
  const pagination = extractPagination($);
  let maxPage = Math.max(...pagination, currentPage);

  // Use results count as fallback for total pages (guards against truncated pagination UI)
  const resultsCount = extractResultsCount($);
  if (resultsCount !== null && resultsCount > 0) {
    const totalPages = Math.ceil(resultsCount / config.crawler.listingsPerPage);
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
        trackSeen: request.userData.trackSeen,
        crawlDetails: request.userData.crawlDetails,
        syncDataset: request.userData.syncDataset,
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
    syncDataset?: boolean;
  };

  log.info(`DETAIL page for ad ${adId}`, { url: request.url });

  const db = getDb();
  const now = new Date().toISOString();
  const existingListing = await db
    .select({
      category: listings.category,
      subcategory: listings.subcategory,
      url: listings.url,
    })
    .from(listings)
    .where(eq(listings.adId, adId))
    .then(r => r[0]);

  // The redesigned site redirects missing ads to the category page. Guard against false removals
  // by requiring that the final loaded URL no longer contains the ad ID and that detail markers
  // are absent on the rendered page.
  const loadedUrl = request.loadedUrl || request.url;
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || loadedUrl;
  const hasAdIdInFinalUrl = loadedUrl.includes(`/${adId}`) || canonicalUrl.includes(`/${adId}`);
  const hasContactForm = $('[data-contact-form="true"]').length > 0;
  const hasDetailHeading = $('h1').length > 0 && $('h2').filter((_, el) => $(el).text().trim() === 'Descripción').length > 0;
  const expectedSlug = existingListing
    ? findCategory(existingListing.category ?? undefined, existingListing.subcategory ?? undefined)[0]?.slug
    : null;

  if (!isRealEstateUrl(loadedUrl) || !isRealEstateUrl(canonicalUrl) || (expectedSlug && (!matchesCategorySlug(loadedUrl, expectedSlug) || !matchesCategorySlug(canonicalUrl, expectedSlug)))) {
    log.warning('Marking listing as removed because detail page resolved outside the expected real-estate category', {
      adId,
      loadedUrl,
      canonicalUrl,
      expectedSlug,
      storedUrl: existingListing?.url,
    });
    await db.update(listings)
      .set({ removedAt: now, removalCheckedAt: now, updatedAt: now, detailCrawled: true })
      .where(eq(listings.adId, adId));
    await pushListingDatasetEvents(request.userData.syncDataset, [
      buildListingDatasetEvent({
        eventType: 'listing.removed',
        crawlRunId,
        adId,
        url: existingListing?.url ?? request.url,
        occurredAt: now,
        postgres: {
          table: 'listings',
          operation: 'update',
          fields: ['removedAt', 'removalCheckedAt', 'updatedAt', 'detailCrawled'],
        },
        listing: {
          adId,
          url: existingListing?.url ?? request.url,
          category: existingListing?.category,
          subcategory: existingListing?.subcategory,
          removedAt: now,
          removalCheckedAt: now,
          updatedAt: now,
          detailCrawled: true,
        },
        changes: {
          removedAt: { to: now },
          detailCrawled: { to: true },
        },
      }),
    ]);
    incrementCrawlMetric(crawlRunId, 'detailsRemoved');
    return;
  }

  if (!hasAdIdInFinalUrl && !hasContactForm && !hasDetailHeading) {
    log.info(`Listing ${adId} no longer exists (redirected away from detail page), marking as removed`, {
      url: request.url,
      loadedUrl,
      canonicalUrl,
    });
    await db.update(listings)
      .set({ removedAt: now, removalCheckedAt: now, updatedAt: now })
      .where(eq(listings.adId, adId));
    await pushListingDatasetEvents(request.userData.syncDataset, [
      buildListingDatasetEvent({
        eventType: 'listing.removed',
        crawlRunId,
        adId,
        url: existingListing?.url ?? request.url,
        occurredAt: now,
        postgres: {
          table: 'listings',
          operation: 'update',
          fields: ['removedAt', 'removalCheckedAt', 'updatedAt'],
        },
        listing: {
          adId,
          url: existingListing?.url ?? request.url,
          category: existingListing?.category,
          subcategory: existingListing?.subcategory,
          removedAt: now,
          removalCheckedAt: now,
          updatedAt: now,
        },
        changes: {
          removedAt: { to: now },
        },
      }),
    ]);
    incrementCrawlMetric(crawlRunId, 'detailsRemoved');
    return;
  }

  const detail = extractDetailData($);

  // Build update object — only set non-null values from detail
  const updates: Record<string, unknown> = {
    detailCrawled: true,
    removalCheckedAt: now,
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
      .then(r => r[0]);

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

  await pushListingDatasetEvents(request.userData.syncDataset, [
    buildListingDatasetEvent({
      eventType: 'listing.detail.updated',
      crawlRunId,
      adId,
      url: existingListing?.url ?? request.url,
      occurredAt: now,
      postgres: {
        table: 'listings',
        operation: 'update',
        fields: Object.keys(updates),
      },
      listing: {
        adId,
        url: existingListing?.url ?? request.url,
        category: existingListing?.category,
        subcategory: existingListing?.subcategory,
        ...updates,
        rawJsonLd: undefined,
        rawLoopaData: undefined,
        rawRetailRocket: undefined,
        hasRawJsonLd: Boolean(updates.rawJsonLd),
        hasRawLoopaData: Boolean(updates.rawLoopaData),
        hasRawRetailRocket: Boolean(updates.rawRetailRocket),
      },
    }),
  ]);

  incrementCrawlMetric(crawlRunId, 'detailsCrawled');
  log.info(`Updated detail for ad ${adId}: ${detail.bedrooms}bd/${detail.bathrooms}ba, ${detail.builtAreaSqm}m², ${detail.images.length} images`);
});
