import 'dotenv/config';
import { Actor } from 'apify';
import { z } from 'zod';
import { runCrawl, type CrawlRunResult } from '../crawler/index.js';
import { closeDb } from '../db/connection.js';

const actorInputSchema = z.object({
  mode: z.enum(['incremental', 'full', 'detail-only']).default('incremental'),
  category: z.string().min(1).optional(),
  subcategory: z.string().min(1).optional(),
  regionSlug: z.string().min(1).optional(),
  maxPages: z.number().int().positive().max(9999).optional(),
  crawlDetails: z.boolean().default(true),
  syncDataset: z.boolean().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  jobName: z.string().min(1).default('encuentra24-crawl'),
  metadata: z.record(z.unknown()).default({}),
});

type ParsedActorInput = z.infer<typeof actorInputSchema>;
type ActorInput = Omit<ParsedActorInput, 'syncDataset'> & { syncDataset: boolean };

interface ActorRunMetadata {
  actorName: string;
  actorRunId: string | null;
  jobName: string;
  mode: ActorInput['mode'];
  startedAt: string;
  finishedAt?: string;
  status: 'started' | 'succeeded' | 'failed';
  metadata: Record<string, unknown>;
}

function parseFallbackInput(): unknown {
  const rawInput = process.env.E24_ACTOR_INPUT_JSON;
  if (!rawInput) return null;

  try {
    return JSON.parse(rawInput);
  } catch (error) {
    throw new Error(`E24_ACTOR_INPUT_JSON is not valid JSON: ${(error as Error).message}`);
  }
}

async function readInput(): Promise<ActorInput> {
  const actorInput = await Actor.getInput<unknown>();
  const fallbackInput = actorInput ?? parseFallbackInput() ?? {};
  return parseActorInput(fallbackInput);
}

function parseActorInput(rawInput: unknown): ActorInput {
  const input = actorInputSchema.parse(rawInput);
  return {
    ...input,
    syncDataset: input.syncDataset ?? (input.mode === 'incremental'),
  };
}

function getActorRunId(): string | null {
  return process.env.APIFY_ACTOR_RUN_ID || process.env.CRAWLEE_CLOUD_RUN_ID || null;
}

function buildBaseMetadata(input: ActorInput): ActorRunMetadata {
  return {
    actorName: 'encuentra24',
    actorRunId: getActorRunId(),
    jobName: input.jobName,
    mode: input.mode,
    startedAt: new Date().toISOString(),
    status: 'started',
    metadata: input.metadata,
  };
}

function toCrawlOptions(input: ActorInput) {
  return {
    category: input.category,
    subcategory: input.subcategory,
    regionSlug: input.regionSlug,
    maxPages: input.maxPages,
    crawlDetails: input.crawlDetails,
    syncDataset: input.syncDataset,
    full: input.mode === 'full',
    detailOnly: input.mode === 'detail-only',
    logLevel: input.logLevel,
    cleanupStorage: false,
    persistCrawlerStorage: false,
  };
}

async function writeOutput(
  metadata: ActorRunMetadata,
  input: ActorInput,
  result: CrawlRunResult | null,
  error?: Error,
): Promise<void> {
  const finishedAt = new Date().toISOString();
  const output = {
    ...metadata,
    finishedAt,
    status: error ? 'failed' : 'succeeded',
    input,
    result,
    error: error ? { name: error.name, message: error.message, stack: error.stack } : null,
  };

  await Actor.pushData(output);
  await Actor.setValue('OUTPUT', output);
}

async function main(): Promise<void> {
  let actorInitialized = false;
  let input: ActorInput | null = null;
  let metadata: ActorRunMetadata | null = null;

  try {
    await Actor.init();
    actorInitialized = true;

    input = await readInput();
    metadata = buildBaseMetadata(input);

    await Actor.pushData({
      ...metadata,
      input,
    });

    const result = await runCrawl(toCrawlOptions(input));
    await writeOutput(metadata, input, result);
  } catch (error) {
    const err = error as Error;

    if (actorInitialized) {
      const fallbackInput = input ?? parseActorInput({});
      const fallbackMetadata = metadata ?? buildBaseMetadata(fallbackInput);

      try {
        await writeOutput(fallbackMetadata, fallbackInput, null, err);
      } catch (outputError) {
        console.error('Failed to write actor failure output:', outputError);
      }
    } else {
      console.error('Actor initialization failed:', err);
    }

    throw error;
  } finally {
    await closeDb();

    if (actorInitialized) {
      try {
        await Actor.exit();
      } catch (error) {
        console.error('Actor exit failed:', error);
      }
    }
  }
}

await main();
