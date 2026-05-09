# Crawlee Cloud Migration

This repo now has a first-class Crawlee Cloud actor named `encuentra24`. It reuses the existing crawler and writes listings to the configured Encuentra24 PostgreSQL database.

## Why This Shape

- The existing Cloud Scheduler and VM scripts can keep running against production while this actor is tested against a fresh local database.
- No production schema migration is required for actor metadata. Actor run context is written to Crawlee Cloud datasets and the `OUTPUT` key-value record.
- The crawler still records `crawl_runs` rows in the Encuentra24 database, now with accurate page/listing/detail/error counters from runtime metrics.

## Local Crawler Database

Start a disposable local PostgreSQL database:

```bash
docker compose -f docker-compose.local-db.yml up -d
```

Use this connection string for local actor runs:

```bash
export DATABASE_URL='postgresql://encuentra24:encuentra24@127.0.0.1:55433/encuentra24'
```

Run the committed, idempotent Drizzle migrations:

```bash
npm run db:migrate
```

Do not use `db:push` against production or the parallel migration database. The `drizzle/` bootstrap migrations use `IF NOT EXISTS` and include the web-only app tables so a fresh crawler database can serve the dashboard endpoints too.

## Run The Actor Without Crawlee Cloud

This is the fastest local smoke path. It uses local Apify storage and the local PostgreSQL database above.

```bash
E24_ACTOR_INPUT_JSON='{"mode":"incremental","maxPages":1,"jobName":"local-smoke"}' npm run actor:local
```

## Dataset Sync

Actor runs write listings to PostgreSQL as the source of truth. They can also push compact dataset events for each listing insert/update/removal when `syncDataset=true`.

By default, `syncDataset` is enabled only when the actor input omits it for `incremental` mode. It defaults off for `full` and `detail-only` modes because those runs can touch tens of thousands of listings. Set it explicitly when dataset-level event monitoring is worth the extra traffic.

Dataset events are buffered before `Actor.pushData()` calls. Tune the batch size with:

```bash
DATASET_SYNC_BATCH_SIZE=50
```

Dataset event types:

- `listing.card.inserted` for a new listing card inserted into `listings`
- `listing.price.updated` for a listing price change
- `listing.reappeared` for a previously removed listing seen again
- `listing.detail.updated` for detail-page fields written to `listings`
- `listing.removed` for detail-page removal detection

Set `"syncDataset": false` in actor input when you only want the final start/output summary records in the dataset.

For a fast first coverage crawl that fills listing cards and leaves detail pages for a later backfill:

```bash
E24_ACTOR_INPUT_JSON='{"mode":"full","crawlDetails":false,"jobName":"local-full-coverage","metadata":{"purpose":"fresh-local-db-coverage"}}' npm run actor:local
```

Then backfill details:

```bash
E24_ACTOR_INPUT_JSON='{"mode":"detail-only","jobName":"local-detail-backfill"}' npm run actor:local
```

## Local Benchmark

Last verified locally on 2026-05-06 against a clean disposable DB on `127.0.0.1:55433`:

- Full list-only crawl: `mode=full`, `crawlDetails=false`, `MAX_CONCURRENCY=8`, `MAX_REQUESTS_PER_MINUTE=120`, `SAME_DOMAIN_DELAY_SECS=0.25`.
- Result: 2,277 pages, 45,299 accepted listings, 45,299 `crawl_seen_listings` rows, 0 crawl errors, 0 removed rows, 3,409 seconds.
- Category totals: sale 32,143; rental 13,074; vacation 78; new_project 4.
- A scoped detail-only smoke for `new_project/proyectos-nuevos` detail-crawled 4 listings in 8 seconds with 0 errors.

The live site sometimes injects cross-category cards into result pages, especially `proyectos-nuevos` cards inside sale pages. The crawler rejects those via URL category guards; this explains small differences between page metadata totals and accepted listing counts.

## Build The Actor Image

Crawlee Cloud runners look for `crawlee-cloud/actor-{name}:latest` when using the local Docker image convention.

```bash
docker build -t crawlee-cloud/actor-encuentra24:latest .
```

## Crawlee Cloud Platform

Run the platform from the upstream project:

```bash
git clone https://github.com/crawlee-cloud/crawlee-cloud.git /tmp/crawlee-cloud
cd /tmp/crawlee-cloud
cp .env.example .env
# Set ADMIN_EMAIL and ADMIN_PASSWORD before starting.
docker compose up -d
```

Dashboard: `http://localhost:3001`
API: `http://localhost:3000`

Create an API key in the dashboard or API, then log in:

```bash
crawlee-cloud login --url http://localhost:3000 --token '<api-key>'
```

From this repo root, push/register the actor:

```bash
crawlee-cloud push encuentra24 --env-file .actor/env.local
```

Create `.actor/env.local` from `.actor/env.example` and keep it out of git. For Coolify, set the same values as service secrets or actor default environment variables; do not commit or paste production credentials.

If using the direct Docker path, build the image on the runner host and register the actor through the Crawlee Cloud API or dashboard.

## Scheduling

Crawlee Cloud has native cron schedules via `/v2/schedules`. After the actor is pushed and `CRAWLEE_CLOUD_TOKEN` is set to an API key:

```bash
CRAWLEE_CLOUD_API_URL=http://localhost:3000 scripts/crawlee-cloud-create-schedules.sh
```

This creates or updates:

- `encuentra24-hourly-incremental`: hourly incremental with `maxPages=5`; `INCREMENTAL_CRAWL_DETAILS=true` and `INCREMENTAL_SYNC_DATASET=false` by default. Set details to `false` during a fresh list-only bootstrap if the detail backlog is intentionally being handled by separate `detail-only` jobs.
- `encuentra24-weekly-full-coverage`: Sunday 03:00 Panama full coverage crawl. By default this is list-only (`FULL_CRAWL_DETAILS=false`) and dataset sync is off (`FULL_SYNC_DATASET=false`) so removed-listing detection and coverage checks are fast; set details to `true` only when you intentionally want a very long full detail crawl.

Host cron or a Coolify scheduled job can still call the actor directly when useful:

Hourly incremental:

```cron
0 * * * * cd /path/to/encuentra24-api && TRIGGER=cron scripts/crawlee-cloud-call.sh incremental
```

Weekly full validation crawl:

```cron
0 3 * * 0 cd /path/to/encuentra24-api && TRIGGER=cron scripts/crawlee-cloud-call.sh full
```

Do not pass production `DATABASE_URL` on the command line. Configure secrets in the runner/actor environment for deployed runs. Use the local database URL only for local bootstrap tests.

## Comparison Plan

1. Seed the parallel database from production only after confirming the source and destination connection targets. The existing production database remains the source of truth while this runs.
2. Configure the Crawlee Cloud actor with the parallel database `DATABASE_URL`, not the legacy production `DATABASE_URL`.
3. Run a full actor crawl into the parallel database and record `crawl_runs.duration_secs`, listings by category/subcategory, and error counts.
4. Run hourly actor incrementals into the same parallel database while the legacy crawler keeps running against production.
5. Compare against the current production crawler using aggregate counts, category/subcategory coverage, latest listing IDs, price-history deltas, and removed-listing behavior.
6. Only after the actor matches or exceeds the current crawler should Cloud Scheduler or the legacy VM cron be paused.

The deleted-listing registry in production should be backfilled into the new database only after explicitly confirming the source and destination connection targets.
