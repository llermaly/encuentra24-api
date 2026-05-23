import { Command } from 'commander';
import { sql } from 'drizzle-orm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, extname } from 'node:path';
import { closeDb, getDb, initDb } from '../../db/connection.js';
import {
  detectPhMentions,
  extractPhCandidates,
  loadPhCatalog,
  matchPhCandidate,
  normalizePhName,
  type PhCatalog,
  type PhDetection,
  type PhMatchOptions,
  type PhMatchResult,
  type PhMatchStatus,
} from '../../ph/detector.js';

interface ListingRow {
  adId: string;
  title: string | null;
  description: string | null;
  category: string;
  subcategory: string;
  city: string | null;
  location: string | null;
  url: string;
}

interface DetectionOutput {
  adId: string;
  title: string | null;
  category: string;
  subcategory: string;
  city: string | null;
  location: string | null;
  url: string;
  rawCandidate: string;
  normalizedCandidate: string;
  source: string;
  pattern: string;
  confidence: number;
  status: PhMatchStatus;
  canonicalId?: string;
  canonicalName?: string;
  matchedVia?: string;
  score: number;
  bestCandidateName?: string;
}

interface CandidateGroup {
  status: PhMatchStatus;
  normalizedCandidate: string;
  count: number;
  rawExamples: string[];
  canonicalId?: string;
  canonicalName?: string;
  bestCandidateName?: string;
  bestScore: number;
  examples: Array<{
    adId: string;
    title: string | null;
    category: string;
    location: string | null;
    url: string;
    rawCandidate: string;
  }>;
}

const DEFAULT_REGISTRY_PATH = 'config/ph-registry/registry.csv';
const DEFAULT_ALIASES_PATH = 'config/ph-registry/aliases.csv';
const DEFAULT_IGNORE_PATH = 'config/ph-registry/ignore.txt';
const DEFAULT_OUTPUT_PATH = 'data/ph-registry/reports/ph-detections.json';
const PREFILTER_REGEX = String.raw`(^|[^[:alnum:]])(p[[:space:]./-]*h\.?|ph|propiedad[[:space:]]+horizontal|edificio|edif\.?|condominio|condo|residencial|res\.?|torre)([^[:alnum:]]|$)`;

export const phCommand = new Command('ph')
  .description('Extract and normalize P.H. building names from listing text')
  .addCommand(
    new Command('analyze')
      .description('Scan current listings and write a P.H. extraction review report')
      .option('--registry <path>', 'Registro Publico canonical P.H. list', DEFAULT_REGISTRY_PATH)
      .option('--aliases <path>', 'Known aliases and typo corrections', DEFAULT_ALIASES_PATH)
      .option('--ignore <path>', 'Known false-positive candidates', DEFAULT_IGNORE_PATH)
      .option('-o, --output <path>', 'Report output path', DEFAULT_OUTPUT_PATH)
      .option('--format <format>', 'Output format: json or csv')
      .option('--category <category>', 'Category filter: sale, rental, vacation, new_project')
      .option('--subcategory <subcategory>', 'Subcategory filter')
      .option('--status <status>', 'Listing status: active, removed, all', 'active')
      .option('--scan <mode>', 'Scan mode: candidates or all', 'candidates')
      .option('--limit <number>', 'Debug/sample limit; default scans all matching rows')
      .option('--min-score <number>', 'Score required for an automatic match', '0.86')
      .option('--review-score <number>', 'Score required to put a candidate in review', '0.70')
      .option('--examples <number>', 'Examples to keep per candidate group', '5')
      .action(async (opts) => {
        await analyzePhListings({
          registryPath: opts.registry,
          aliasesPath: opts.aliases,
          ignorePath: opts.ignore,
          outputPath: opts.output,
          format: opts.format,
          category: opts.category,
          subcategory: opts.subcategory,
          status: opts.status,
          scan: opts.scan,
          limit: opts.limit ? Number(opts.limit) : undefined,
          minScore: Number(opts.minScore),
          reviewScore: Number(opts.reviewScore),
          exampleLimit: Number(opts.examples),
        });
      }),
  )
  .addCommand(
    new Command('test')
      .description('Run P.H. extraction on one text snippet without querying the database')
      .argument('<text...>', 'Listing title or description text')
      .option('--registry <path>', 'Registro Publico canonical P.H. list', DEFAULT_REGISTRY_PATH)
      .option('--aliases <path>', 'Known aliases and typo corrections', DEFAULT_ALIASES_PATH)
      .option('--ignore <path>', 'Known false-positive candidates', DEFAULT_IGNORE_PATH)
      .option('--min-score <number>', 'Score required for an automatic match', '0.86')
      .option('--review-score <number>', 'Score required to put a candidate in review', '0.70')
      .action((textParts: string[], opts) => {
        const catalog = loadPhCatalog({
          registryPath: opts.registry,
          aliasesPath: opts.aliases,
          ignorePath: opts.ignore,
        });
        const text = textParts.join(' ');
        const detections = detectPhMentions(
          { title: text },
          catalog,
          { minScore: Number(opts.minScore), reviewScore: Number(opts.reviewScore) },
        );

        console.log(JSON.stringify({
          normalizedInput: normalizePhName(text),
          detections,
        }, null, 2));
      }),
  )
  .addCommand(
    new Command('normalize')
      .description('Normalize a P.H. name the same way the matcher does')
      .argument('<name...>', 'P.H. name')
      .action((nameParts: string[]) => {
        console.log(normalizePhName(nameParts.join(' ')));
      }),
  );

async function analyzePhListings(options: {
  registryPath: string;
  aliasesPath: string;
  ignorePath: string;
  outputPath: string;
  format?: string;
  category?: string;
  subcategory?: string;
  status: string;
  scan: string;
  limit?: number;
  minScore: number;
  reviewScore: number;
  exampleLimit: number;
}) {
  validateAnalyzeOptions(options);

  const catalog = loadPhCatalog({
    registryPath: options.registryPath,
    aliasesPath: options.aliasesPath,
    ignorePath: options.ignorePath,
  });

  await initDb();

  try {
    const db = getDb();
    const baseWhere = buildWhere(options, false);
    const scanWhere = buildWhere(options, options.scan === 'candidates');
    const limitSql = options.limit ? sql`LIMIT ${options.limit}` : sql``;

    const [totalRow] = await rowsFromResult<{ count: number }>(await db.execute(sql`
      SELECT count(*)::int AS count
      FROM listings
      ${baseWhere}
    `));

    const rows = await rowsFromResult<ListingRow>(await db.execute(sql`
      SELECT
        ad_id AS "adId",
        title,
        description,
        category,
        subcategory,
        city,
        location,
        url
      FROM listings
      ${scanWhere}
      ORDER BY id
      ${limitSql}
    `));

    const detections: DetectionOutput[] = [];
    const listingsWithCandidate = new Set<string>();
    const listingsWithExplicitPh = new Set<string>();
    const listingsWithLooseBuildingMarker = new Set<string>();
    const matchCache = new Map<string, PhMatchResult>();

    for (const row of rows) {
      const rowDetections = detectWithMatchCache(
        { title: row.title, description: row.description },
        catalog,
        { minScore: options.minScore, reviewScore: options.reviewScore },
        matchCache,
      );

      if (rowDetections.length > 0) {
        listingsWithCandidate.add(row.adId);
      }
      if (rowDetections.some((detection) => detection.mention.pattern.includes('ph'))) {
        listingsWithExplicitPh.add(row.adId);
      } else if (rowDetections.length > 0) {
        listingsWithLooseBuildingMarker.add(row.adId);
      }

      for (const detection of rowDetections) {
        detections.push(toOutput(row, detection));
      }
    }

    const groups = groupDetections(detections, options.exampleLimit);
    const summary = {
      scannedAt: new Date().toISOString(),
      totalListingsInScope: totalRow?.count ?? 0,
      rowsScanned: rows.length,
      listingsWithCandidate: listingsWithCandidate.size,
      mentionRate: ratio(listingsWithCandidate.size, totalRow?.count ?? 0),
      listingsWithExplicitPh: listingsWithExplicitPh.size,
      explicitPhMentionRate: ratio(listingsWithExplicitPh.size, totalRow?.count ?? 0),
      listingsWithLooseBuildingMarker: listingsWithLooseBuildingMarker.size,
      looseBuildingMarkerRate: ratio(listingsWithLooseBuildingMarker.size, totalRow?.count ?? 0),
      detections: detections.length,
      uniqueCandidates: matchCache.size,
      detectionsByPattern: countBy(detections, (item) => item.pattern),
      matchedDetections: detections.filter((item) => item.status === 'matched').length,
      reviewDetections: detections.filter((item) => item.status === 'review').length,
      unmatchedDetections: detections.filter((item) => item.status === 'unmatched').length,
      ignoredDetections: detections.filter((item) => item.status === 'ignored').length,
      registryNames: catalog.entries.length,
      aliasNames: catalog.aliases.length,
      ignoredNames: catalog.ignoredNormalized.size,
      options: {
        category: options.category ?? null,
        subcategory: options.subcategory ?? null,
        status: options.status,
        scan: options.scan,
        limit: options.limit ?? null,
        minScore: options.minScore,
        reviewScore: options.reviewScore,
      },
    };

    const report = {
      summary,
      unmatchedCandidates: groups.filter((group) => group.status === 'unmatched'),
      reviewCandidates: groups.filter((group) => group.status === 'review'),
      matchedCandidates: groups.filter((group) => group.status === 'matched'),
      ignoredCandidates: groups.filter((group) => group.status === 'ignored'),
      detections,
    };

    writeReport(options.outputPath, options.format, report, groups);
    printSummary(summary, groups, options.outputPath);
  } finally {
    await closeDb();
  }
}

function detectWithMatchCache(
  input: { title?: string | null; description?: string | null },
  catalog: PhCatalog,
  options: PhMatchOptions,
  matchCache: Map<string, PhMatchResult>,
): PhDetection[] {
  return extractPhCandidates(input).map((mention) => {
    const cached = matchCache.get(mention.normalized);
    if (cached) {
      return { mention, match: cached };
    }

    const match = matchPhCandidate(mention, catalog, options);
    matchCache.set(mention.normalized, match);
    return { mention, match };
  });
}

function validateAnalyzeOptions(options: { status: string; scan: string; format?: string; limit?: number }) {
  if (!['active', 'removed', 'all'].includes(options.status)) {
    throw new Error('--status must be one of: active, removed, all');
  }

  if (!['candidates', 'all'].includes(options.scan)) {
    throw new Error('--scan must be one of: candidates, all');
  }

  if (options.format && !['json', 'csv'].includes(options.format)) {
    throw new Error('--format must be one of: json, csv');
  }

  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) {
    throw new Error('--limit must be a positive integer');
  }
}

function buildWhere(options: { category?: string; subcategory?: string; status: string }, includePrefilter: boolean) {
  const conditions = [];

  if (options.category) {
    conditions.push(sql`category = ${options.category}`);
  }

  if (options.subcategory) {
    conditions.push(sql`subcategory = ${options.subcategory}`);
  }

  if (options.status === 'active') {
    conditions.push(sql`removed_at IS NULL`);
  } else if (options.status === 'removed') {
    conditions.push(sql`removed_at IS NOT NULL`);
  }

  if (includePrefilter) {
    conditions.push(sql`(coalesce(title, '') || ' ' || coalesce(description, '')) ~* ${PREFILTER_REGEX}`);
  }

  if (conditions.length === 0) return sql``;
  return sql`WHERE ${sql.join(conditions, sql` AND `)}`;
}

async function rowsFromResult<T>(result: unknown): Promise<T[]> {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] }).rows;
  return rows ?? [];
}

function toOutput(row: ListingRow, detection: PhDetection): DetectionOutput {
  return {
    adId: row.adId,
    title: row.title,
    category: row.category,
    subcategory: row.subcategory,
    city: row.city,
    location: row.location,
    url: row.url,
    rawCandidate: detection.mention.raw,
    normalizedCandidate: detection.mention.normalized,
    source: detection.mention.source,
    pattern: detection.mention.pattern,
    confidence: detection.mention.confidence,
    status: detection.match.status,
    canonicalId: detection.match.canonicalId,
    canonicalName: detection.match.canonicalName,
    matchedVia: detection.match.matchedVia,
    score: detection.match.score,
    bestCandidateName: detection.match.bestCandidateName,
  };
}

function groupDetections(detections: DetectionOutput[], exampleLimit: number): CandidateGroup[] {
  const groups = new Map<string, CandidateGroup>();

  for (const detection of detections) {
    const key = [
      detection.status,
      detection.normalizedCandidate,
      detection.canonicalId ?? '',
      detection.bestCandidateName ?? '',
    ].join('|');
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        status: detection.status,
        normalizedCandidate: detection.normalizedCandidate,
        count: 1,
        rawExamples: [detection.rawCandidate],
        canonicalId: detection.canonicalId,
        canonicalName: detection.canonicalName,
        bestCandidateName: detection.bestCandidateName,
        bestScore: detection.score,
        examples: [{
          adId: detection.adId,
          title: detection.title,
          category: detection.category,
          location: detection.location,
          url: detection.url,
          rawCandidate: detection.rawCandidate,
        }],
      });
      continue;
    }

    existing.count++;
    existing.bestScore = Math.max(existing.bestScore, detection.score);
    if (!existing.rawExamples.includes(detection.rawCandidate) && existing.rawExamples.length < exampleLimit) {
      existing.rawExamples.push(detection.rawCandidate);
    }
    if (existing.examples.length < exampleLimit) {
      existing.examples.push({
        adId: detection.adId,
        title: detection.title,
        category: detection.category,
        location: detection.location,
        url: detection.url,
        rawCandidate: detection.rawCandidate,
      });
    }
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.status !== right.status) {
      return statusRank(left.status) - statusRank(right.status);
    }
    return right.count - left.count || right.bestScore - left.bestScore;
  });
}

function writeReport(
  outputPath: string,
  formatOption: string | undefined,
  report: Record<string, unknown>,
  groups: CandidateGroup[],
) {
  const format = formatOption ?? (extname(outputPath).toLowerCase() === '.csv' ? 'csv' : 'json');
  mkdirSync(dirname(outputPath), { recursive: true });

  if (format === 'csv') {
    writeFileSync(outputPath, groupsToCsv(groups), 'utf-8');
    return;
  }

  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}

function groupsToCsv(groups: CandidateGroup[]): string {
  const headers = [
    'status',
    'normalized_candidate',
    'count',
    'canonical_id',
    'canonical_name',
    'best_candidate_name',
    'best_score',
    'raw_examples',
    'example_ad_ids',
    'example_titles',
    'suggested_action',
  ];
  const lines = [headers.join(',')];

  for (const group of groups) {
    lines.push([
      group.status,
      group.normalizedCandidate,
      group.count,
      group.canonicalId ?? '',
      group.canonicalName ?? '',
      group.bestCandidateName ?? '',
      group.bestScore,
      group.rawExamples.join(' | '),
      group.examples.map((example) => example.adId).join(' | '),
      group.examples.map((example) => example.title ?? '').join(' | '),
      suggestedAction(group),
    ].map(csvEscape).join(','));
  }

  return `${lines.join('\n')}\n`;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function suggestedAction(group: CandidateGroup): string {
  if (group.status === 'review' && group.canonicalId) {
    return `confirm alias for ${group.canonicalId} or add to ignore.txt`;
  }

  if (group.status === 'unmatched') {
    return 'add canonical name to registry.csv, add alias to aliases.csv, or add false positive to ignore.txt';
  }

  if (group.status === 'matched') {
    return 'optional: add frequent typo as alias if this should always match';
  }

  return 'already ignored';
}

function printSummary(summary: Record<string, unknown>, groups: CandidateGroup[], outputPath: string) {
  const unmatched = groups.filter((group) => group.status === 'unmatched').slice(0, 10);
  const review = groups.filter((group) => group.status === 'review').slice(0, 10);

  console.log('\n=== P.H. Extraction Report ===');
  console.log(`Total listings in scope: ${summary.totalListingsInScope}`);
  console.log(`Rows scanned: ${summary.rowsScanned}`);
  console.log(`Listings with P.H. candidates: ${summary.listingsWithCandidate} (${summary.mentionRate})`);
  console.log(`  Explicit P.H. marker: ${summary.listingsWithExplicitPh} (${summary.explicitPhMentionRate})`);
  console.log(`  Loose building marker only: ${summary.listingsWithLooseBuildingMarker} (${summary.looseBuildingMarkerRate})`);
  console.log(`Detections: ${summary.detections}`);
  console.log(`Unique candidates: ${summary.uniqueCandidates}`);
  console.log(`  Matched: ${summary.matchedDetections}`);
  console.log(`  Review: ${summary.reviewDetections}`);
  console.log(`  Unmatched: ${summary.unmatchedDetections}`);
  console.log(`  Ignored: ${summary.ignoredDetections}`);
  console.log(`Registry names: ${summary.registryNames} | Aliases: ${summary.aliasNames} | Ignore list: ${summary.ignoredNames}`);
  console.log(`Report written to: ${outputPath}`);

  if (review.length > 0) {
    console.log('\nTop review candidates:');
    for (const group of review) {
      console.log(`  ${group.normalizedCandidate} -> ${group.bestCandidateName} (${group.bestScore}, ${group.count} detections)`);
    }
  }

  if (unmatched.length > 0) {
    console.log('\nTop unmatched candidates:');
    for (const group of unmatched) {
      console.log(`  ${group.normalizedCandidate} (${group.count} detections) e.g. ${group.rawExamples.join(' | ')}`);
    }
  }
}

function ratio(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.00%';
  return `${((numerator / denominator) * 100).toFixed(2)}%`;
}

function countBy<T>(items: T[], getKey: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function statusRank(status: PhMatchStatus): number {
  switch (status) {
    case 'unmatched':
      return 0;
    case 'review':
      return 1;
    case 'matched':
      return 2;
    case 'ignored':
      return 3;
  }
}
