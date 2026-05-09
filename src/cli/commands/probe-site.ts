import { Command } from 'commander';
import { load } from 'cheerio';
import { setTimeout as delay } from 'node:timers/promises';
import { buildListUrl, findCategory, type CategoryConfig } from '../../crawler/categories.js';
import {
  extractListingCards,
  extractPagination,
  extractResultsCount,
} from '../../crawler/extractors/list-page.js';
import { isRealEstateUrl, matchesCategorySlug } from '../../crawler/utils/url.js';

interface ProbeResult {
  category: string;
  subcategory: string;
  label: string;
  page: number;
  url: string;
  loadedUrl: string;
  status: number;
  cards: number;
  invalidCards: number;
  resultsCount: number | null;
  maxPage: number;
  warnings: string[];
}

const requestHeaders = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'es-PA,es;q=0.9,en;q=0.8',
  'user-agent': 'Mozilla/5.0 (compatible; Encuentra24Probe/1.0; +https://encuentra24.local)',
};

async function fetchPage(url: string): Promise<Response> {
  return fetch(url, {
    headers: requestHeaders,
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
}

async function probeCategoryPage(cat: CategoryConfig, regionSlug: string | undefined, page: number): Promise<ProbeResult> {
  const url = buildListUrl(cat, regionSlug, page);
  const response = await fetchPage(url);
  const html = await response.text();
  const $ = load(html);
  const loadedUrl = response.url || url;
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || loadedUrl;
  const cards = extractListingCards($);
  const invalidCards = cards.filter((card) => !isRealEstateUrl(card.url) || !matchesCategorySlug(card.url, cat.slug)).length;
  const pagination = extractPagination($);
  const resultsCount = extractResultsCount($);
  const maxPage = Math.max(page, ...pagination);
  const warnings: string[] = [];

  if (!response.ok) {
    warnings.push(`HTTP ${response.status}`);
  }
  if (!matchesCategorySlug(loadedUrl, cat.slug) || !matchesCategorySlug(canonicalUrl, cat.slug)) {
    warnings.push(`resolved outside category (loaded=${loadedUrl}, canonical=${canonicalUrl})`);
  }
  if (cards.length === 0) {
    warnings.push('no listing cards extracted');
  }
  if (invalidCards > 0) {
    warnings.push(`${invalidCards} listing cards outside expected category`);
  }
  if (resultsCount !== null && resultsCount > 0 && cards.length === 0) {
    warnings.push(`results metadata reports ${resultsCount} listings but extractor found 0 cards`);
  }

  return {
    category: cat.category,
    subcategory: cat.subcategory,
    label: cat.label,
    page,
    url,
    loadedUrl,
    status: response.status,
    cards: cards.length,
    invalidCards,
    resultsCount,
    maxPage,
    warnings,
  };
}

export const probeSiteCommand = new Command('probe-site')
  .description('Read-only probe of Encuentra24 category pages using the list-page extractors')
  .option('-c, --category <type>', 'Category filter: sale, rental, vacation, new_project')
  .option('-s, --subcategory <type>', 'Subcategory filter: casas, apartamentos, etc.')
  .option('-r, --region <slug>', 'Region slug filter')
  .option('-p, --max-pages <number>', 'Pages per category to probe', '1')
  .option('--delay-ms <number>', 'Delay between requests', '750')
  .option('--json', 'Print JSON results instead of a compact table', false)
  .option('--fail-on-warning', 'Exit non-zero if any warning is found', false)
  .action(async (opts) => {
    const maxPages = Math.max(1, Number(opts.maxPages) || 1);
    const delayMs = Math.max(0, Number(opts.delayMs) || 0);
    const categories = findCategory(opts.category, opts.subcategory);

    if (categories.length === 0) {
      throw new Error(`No categories match category=${opts.category || 'all'} subcategory=${opts.subcategory || 'all'}`);
    }

    const results: ProbeResult[] = [];

    for (const cat of categories) {
      for (let page = 1; page <= maxPages; page++) {
        const result = await probeCategoryPage(cat, opts.region, page);
        results.push(result);

        if (!opts.json) {
          const warningText = result.warnings.length ? ` warnings=${result.warnings.join('; ')}` : '';
          console.log(`${result.label} page=${page} status=${result.status} cards=${result.cards} total=${result.resultsCount ?? 'n/a'} maxPage=${result.maxPage}${warningText}`);
        }

        if (delayMs > 0) {
          await delay(delayMs);
        }
      }
    }

    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
    }

    const warningCount = results.reduce((total, result) => total + result.warnings.length, 0);
    if (opts.failOnWarning && warningCount > 0) {
      throw new Error(`Probe found ${warningCount} warnings`);
    }
  });
