import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';

export interface PhRegistryEntry {
  canonicalId: string;
  canonicalName: string;
  normalizedName: string;
  source?: string;
  active: boolean;
  notes?: string;
}

export interface PhAliasEntry {
  alias: string;
  normalizedAlias: string;
  canonicalId: string;
  confidence?: number;
  notes?: string;
}

interface MatchTarget {
  canonicalId: string;
  displayName: string;
  normalized: string;
  targetType: 'registry' | 'alias';
}

export interface PhCatalog {
  entries: PhRegistryEntry[];
  aliases: PhAliasEntry[];
  ignoredNormalized: Set<string>;
  targets: MatchTarget[];
}

export interface PhMentionCandidate {
  raw: string;
  normalized: string;
  source: 'title' | 'description';
  pattern: string;
  confidence: number;
}

export type PhMatchStatus = 'matched' | 'review' | 'unmatched' | 'ignored';

export interface PhMatchResult {
  status: PhMatchStatus;
  canonicalId?: string;
  canonicalName?: string;
  matchedVia?: 'registry' | 'alias';
  score: number;
  bestCandidateName?: string;
}

export interface PhDetection {
  mention: PhMentionCandidate;
  match: PhMatchResult;
}

export interface PhCatalogPaths {
  registryPath?: string;
  aliasesPath?: string;
  ignorePath?: string;
}

export interface PhMatchOptions {
  minScore?: number;
  reviewScore?: number;
}

const DEFAULT_MIN_SCORE = 0.86;
const DEFAULT_REVIEW_SCORE = 0.70;

const EDGE_STOPWORDS = new Set([
  'a',
  'al',
  'alquiler',
  'apartamento',
  'apartamentos',
  'apto',
  'area',
  'areas',
  'banco',
  'casa',
  'comercial',
  'con',
  'de',
  'del',
  'el',
  'en',
  'la',
  'las',
  'los',
  'oficina',
  'ph',
  'se',
  'social',
  'sociales',
  'sin',
  'the',
  'venta',
  'vende',
  'vendo',
]);

const GENERIC_NAME_WORDS = new Set([
  'amoblado',
  'amplio',
  'apartamento',
  'apartamentos',
  'apto',
  'area',
  'areas',
  'alto',
  'banco',
  'barato',
  'centrico',
  'cerca',
  'cerrado',
  'comodo',
  'con',
  'cuenta',
  'edificio',
  'esta',
  'excelente',
  'exclusivo',
  'completa',
  'completas',
  'hermoso',
  'lujo',
  'lujoso',
  'moderno',
  'nivel',
  'nuevo',
  'ofrece',
  'oportunidad',
  'piso',
  'piscina',
  'privado',
  'remodelado',
  'seguridad',
  'social',
  'sociales',
  'sin',
  'tranquila',
  'tranquilo',
  'torre',
  'tower',
  'towers',
  'venta',
  'vende',
  'vendo',
]);

const STOP_AFTER_PATTERN = new RegExp(
  [
    '\\b(?:alquilo|alquiler|amoblado|amoblada|apartamento|apto|area|bañ',
    'os?|cerca|con|cuenta|disponible|en\\s+el\\s+area|en\\s+la\\s+zona|',
    'frente|full|linea\\s+blanca|metros?|m2|para|piso|precio|recamaras?|',
    'se\\s+alquila|se\\s+vende|ubicad[oa]|venta|vendo|vista)\\b',
  ].join(''),
  'iu',
);
const START_FALSE_PATTERN = /^(?:alquilo|alquiler|apartamento|apto|banco\s+vende|cuenta(?:\s+con)?|ofrece|se\s+(?:alquila|vende)|venta|vende|vendo)\b/iu;

const PH_MARKER = String.raw`(?:p\s*[./-]?\s*h\.?|ph|propiedad\s+horizontal)`;
const BUILDING_MARKER = String.raw`(?:edificio|edif\.?|condominio|condo|residencial|res\.?|torre)`;
const NAME_CHARS = String.raw`A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ&.'’´` + '`' + String.raw`\-\s`;
const MARKER_SEPARATOR = String.raw`(?:\s+|[:#/-]\s*)`;

const MARKER_BEFORE_PATTERNS = [
  {
    name: 'ph-marker',
    marker: PH_MARKER,
    confidence: 0.95,
  },
  {
    name: 'building-marker',
    marker: BUILDING_MARKER,
    confidence: 0.72,
  },
];

export function normalizePhName(value: string): string {
  let normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/\bp\s*[./-]?\s*h\.?\b/g, ' ')
    .replace(/\bpropiedad\s+horizontal\b/g, ' ')
    .replace(/\b(edificio|edif|condominio|condo|residencial|res|torre)\b\.?/g, ' ')
    .replace(/\b(sociedad\s+anonima|s\.?\s*a\.?|inc\.?|corp\.?)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  normalized = stripEdgeWords(normalized);
  return normalized;
}

export function extractPhCandidates(input: { title?: string | null; description?: string | null }): PhMentionCandidate[] {
  const candidates: PhMentionCandidate[] = [];

  if (input.title) {
    candidates.push(...extractFromText(input.title, 'title'));
    candidates.push(...extractTrailingPhFromTitle(input.title));
  }

  if (input.description) {
    candidates.push(...extractFromText(input.description, 'description'));
  }

  const deduped = new Map<string, PhMentionCandidate>();
  for (const candidate of candidates) {
    if (!isUsefulCandidate(candidate.normalized)) continue;

    const existing = deduped.get(candidate.normalized);
    if (!existing || candidate.confidence > existing.confidence || candidate.source === 'title') {
      deduped.set(candidate.normalized, candidate);
    }
  }

  return Array.from(deduped.values());
}

export function matchPhCandidate(
  candidate: PhMentionCandidate,
  catalog: PhCatalog,
  options: PhMatchOptions = {},
): PhMatchResult {
  if (catalog.ignoredNormalized.has(candidate.normalized)) {
    return { status: 'ignored', score: 1 };
  }

  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const reviewScore = options.reviewScore ?? DEFAULT_REVIEW_SCORE;
  let best: MatchTarget | undefined;
  let bestScore = 0;

  for (const target of catalog.targets) {
    const score = candidate.normalized === target.normalized
      ? 1
      : fuzzyNameScore(candidate.normalized, target.normalized);

    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }

  if (!best) {
    return { status: 'unmatched', score: 0 };
  }

  const entry = catalog.entries.find((item) => item.canonicalId === best?.canonicalId);
  const base = {
    canonicalId: best.canonicalId,
    canonicalName: entry?.canonicalName ?? best.displayName,
    matchedVia: best.targetType,
    bestCandidateName: best.displayName,
    score: roundScore(bestScore),
  };

  if (bestScore >= minScore) {
    return { ...base, status: 'matched' };
  }

  if (bestScore >= reviewScore) {
    return { ...base, status: 'review' };
  }

  return {
    status: 'unmatched',
    bestCandidateName: best.displayName,
    score: roundScore(bestScore),
  };
}

export function detectPhMentions(
  input: { title?: string | null; description?: string | null },
  catalog: PhCatalog,
  options: PhMatchOptions = {},
): PhDetection[] {
  return extractPhCandidates(input).map((mention) => ({
    mention,
    match: matchPhCandidate(mention, catalog, options),
  }));
}

export function loadPhCatalog(paths: PhCatalogPaths = {}): PhCatalog {
  const entries = loadRegistry(paths.registryPath);
  const aliases = loadAliases(paths.aliasesPath);
  const ignoredNormalized = loadIgnored(paths.ignorePath);
  const activeEntries = entries.filter((entry) => entry.active);
  const entryIds = new Set(activeEntries.map((entry) => entry.canonicalId));
  const targets: MatchTarget[] = [
    ...activeEntries.map((entry) => ({
      canonicalId: entry.canonicalId,
      displayName: entry.canonicalName,
      normalized: entry.normalizedName,
      targetType: 'registry' as const,
    })),
    ...aliases
      .filter((alias) => entryIds.has(alias.canonicalId))
      .map((alias) => {
        const entry = activeEntries.find((item) => item.canonicalId === alias.canonicalId);
        return {
          canonicalId: alias.canonicalId,
          displayName: entry?.canonicalName ?? alias.alias,
          normalized: alias.normalizedAlias,
          targetType: 'alias' as const,
        };
      }),
  ];

  return { entries: activeEntries, aliases, ignoredNormalized, targets };
}

function extractFromText(text: string, source: 'title' | 'description'): PhMentionCandidate[] {
  const candidates: PhMentionCandidate[] = [];
  const compact = text.replace(/\s+/g, ' ');

  for (const spec of MARKER_BEFORE_PATTERNS) {
    const pattern = new RegExp(String.raw`\b${spec.marker}${MARKER_SEPARATOR}([${NAME_CHARS}]{2,90})`, 'giu');
    for (const match of compact.matchAll(pattern)) {
      const raw = cleanCapturedName(match[1] ?? '');
      const normalized = normalizePhName(raw);
      if (!normalized) continue;

      candidates.push({
        raw,
        normalized,
        source,
        pattern: spec.name,
        confidence: source === 'title' ? spec.confidence : spec.confidence * 0.82,
      });
    }
  }

  return candidates;
}

function extractTrailingPhFromTitle(title: string): PhMentionCandidate[] {
  const candidates: PhMentionCandidate[] = [];
  const compact = title.replace(/\s+/g, ' ');
  const pattern = new RegExp(String.raw`([${NAME_CHARS}]{3,70})\s+\b${PH_MARKER}\b`, 'giu');

  for (const match of compact.matchAll(pattern)) {
    const raw = cleanCapturedName(match[1] ?? '', { fromLeft: true });
    const normalized = normalizePhName(raw);
    if (!normalized) continue;

    candidates.push({
      raw,
      normalized,
      source: 'title',
      pattern: 'trailing-ph-marker',
      confidence: 0.58,
    });
  }

  return candidates;
}

function cleanCapturedName(value: string, options: { fromLeft?: boolean } = {}): string {
  let cleaned = value
    .replace(/^[\s:;,.#\-–—/]+/, '')
    .replace(/[\s:;,.#\-–—/]+$/, '')
    .trim();

  if (START_FALSE_PATTERN.test(cleaned)) {
    return '';
  }

  const stop = cleaned.search(STOP_AFTER_PATTERN);
  if (stop > 0) {
    cleaned = cleaned.slice(0, stop).trim();
  }

  const pieces = cleaned.split(/\s+/);
  const maxWords = options.fromLeft ? 6 : 7;
  cleaned = pieces.slice(0, maxWords).join(' ');

  return stripEdgeWords(cleaned);
}

function stripEdgeWords(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  while (words.length > 0 && EDGE_STOPWORDS.has(normalizeToken(words[0]))) {
    words.shift();
  }
  while (words.length > 0 && EDGE_STOPWORDS.has(normalizeToken(words[words.length - 1]))) {
    words.pop();
  }
  return words.join(' ').trim();
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isUsefulCandidate(normalized: string): boolean {
  if (normalized.length < 3) return false;
  if (!/[a-z]/.test(normalized)) return false;

  const words = normalized.split(/\s+/);
  const alphaWords = words.filter((word) => /[a-z]/.test(word));
  if (words.length === 1 && GENERIC_NAME_WORDS.has(words[0])) return false;
  if (words.every((word) => GENERIC_NAME_WORDS.has(word))) return false;
  if (alphaWords.length > 0 && alphaWords.every((word) => GENERIC_NAME_WORDS.has(word))) return false;

  return true;
}

function fuzzyNameScore(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const lev = normalizedLevenshtein(left, right);
  const dice = diceCoefficient(left, right);
  const token = tokenSimilarity(left, right);
  const blended = (dice * 0.48) + (lev * 0.22) + (token * 0.30);

  return Math.max(blended, token * 0.94, dice * 0.88);
}

function normalizedLevenshtein(left: string, right: string): number {
  const distance = levenshteinDistance(left, right);
  const maxLength = Math.max(left.length, right.length);
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let i = 1; i <= left.length; i++) {
    current[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function diceCoefficient(left: string, right: string): number {
  const leftGrams = ngrams(left, left.length < 5 ? 2 : 3);
  const rightGrams = ngrams(right, right.length < 5 ? 2 : 3);
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;

  let overlap = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) overlap++;
  }

  return (2 * overlap) / (leftGrams.size + rightGrams.size);
}

function ngrams(value: string, size: number): Set<string> {
  const compact = ` ${value.replace(/\s+/g, ' ')} `;
  const grams = new Set<string>();
  for (let index = 0; index <= compact.length - size; index++) {
    grams.add(compact.slice(index, index + size));
  }
  return grams;
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap++;
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  const jaccard = overlap / union;
  const coverage = overlap / Math.min(leftTokens.size, rightTokens.size);
  const lengthRatio = Math.min(left.length, right.length) / Math.max(left.length, right.length);

  return Math.max(jaccard, coverage * lengthRatio);
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

function loadRegistry(path?: string): PhRegistryEntry[] {
  if (!path || !existsSync(path)) return [];

  const ext = extname(path).toLowerCase();
  const raw = readFileSync(path, 'utf-8');

  if (ext === '.json') {
    const parsed = JSON.parse(raw) as Array<string | Partial<PhRegistryEntry> & { name?: string }>;
    return parsed
      .map((item, index) => {
        if (typeof item === 'string') {
          return registryEntryFromName(item, index);
        }
        return registryEntryFromRecord(item, index);
      })
      .filter((entry): entry is PhRegistryEntry => Boolean(entry));
  }

  if (ext === '.txt') {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line, index) => registryEntryFromName(line, index));
  }

  return parseCsv(raw)
    .map((row, index) => registryEntryFromRecord(row, index))
    .filter((entry): entry is PhRegistryEntry => Boolean(entry));
}

function loadAliases(path?: string): PhAliasEntry[] {
  if (!path || !existsSync(path)) return [];

  return parseCsv(readFileSync(path, 'utf-8'))
    .map<PhAliasEntry | null>((row) => {
      const alias = row.alias?.trim();
      const canonicalId = row.canonical_id?.trim() ?? row.canonicalId?.trim();
      if (!alias || !canonicalId) return null;

      const entry: PhAliasEntry = {
        alias,
        normalizedAlias: normalizePhName(alias),
        canonicalId,
      };

      if (row.confidence) {
        entry.confidence = Number(row.confidence);
      }
      if (row.notes?.trim()) {
        entry.notes = row.notes.trim();
      }

      return entry;
    })
    .filter((entry): entry is PhAliasEntry => entry !== null && Boolean(entry.normalizedAlias));
}

function loadIgnored(path?: string): Set<string> {
  if (!path || !existsSync(path)) return new Set();

  const values = readFileSync(path, 'utf-8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => normalizePhName(line))
    .filter(Boolean);

  return new Set(values);
}

function registryEntryFromName(name: string, index: number): PhRegistryEntry {
  const canonicalName = name.trim();
  const normalizedName = normalizePhName(canonicalName);
  return {
    canonicalId: stableId(canonicalName, index),
    canonicalName,
    normalizedName,
    active: true,
  };
}

function registryEntryFromRecord(
  row: Partial<PhRegistryEntry> & Record<string, string | boolean | undefined> & { name?: string },
  index: number,
): PhRegistryEntry | null {
  const canonicalName = String(row.canonicalName ?? row.canonical_name ?? row.name ?? '').trim();
  if (!canonicalName) return null;

  const activeValue = row.active;
  const active = activeValue === undefined || activeValue === true || String(activeValue).toLowerCase() !== 'false';

  return {
    canonicalId: String(row.canonicalId ?? row.canonical_id ?? stableId(canonicalName, index)).trim(),
    canonicalName,
    normalizedName: normalizePhName(canonicalName),
    source: typeof row.source === 'string' ? row.source.trim() || undefined : undefined,
    active,
    notes: typeof row.notes === 'string' ? row.notes.trim() || undefined : undefined,
  };
}

function stableId(name: string, index: number): string {
  const normalized = normalizePhName(name).replace(/\s+/g, '-');
  return normalized || `ph-${index + 1}`;
}

function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'));

  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((column) => column.trim());
  const hasHeader = header.some((column) => ['canonical_id', 'canonical_name', 'canonicalId', 'canonicalName', 'name', 'alias'].includes(column));
  const columns = hasHeader ? header : ['canonical_name'];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']));
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index++;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}
