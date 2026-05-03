# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## ⚠️ THIS IS A PRODUCTION PROJECT

This app runs against a live PostgreSQL database with real crawled data. Treat every change with the seriousness that demands:

### No Destructive Actions
- **NEVER** run DROP, DELETE, TRUNCATE, or ALTER that removes columns on the production database
- **NEVER** use `db:push` against production — use migrations only
- **NEVER** suggest `git reset --hard`, `git clean -f`, or force-pushes
- Before any schema change, confirm with the user — data loss is unrecoverable

### Stage Environment and Infrastructure Inventory
- `main` is the production branch. `stage` is the production-like staging branch.
- Vercel uses the existing `encuentra24-api` project for both environments: do not create a separate Vercel project for staging unless the user explicitly changes this architecture.
- Vercel project details: project `encuentra24-api`, project id `prj_LccjoDXiORVjhSM2fWo5eUXtskQg`, team slug `my-team-43dbe230`, team id `team_AZDD5XdLKWjaDiWBNWcpKX2t`, root directory `web`, Node.js `24.x`, framework `Next.js`.
- Vercel branch mapping: Production tracks `main`; custom environment `stage` exists with id `env_xb8IK0rFusqCHDjJRVtMapAiBR6z` but must not be attached to the `stage` branch until its stage `DATABASE_URL` is configured.
- Vercel stage env status as of 2026-05-03: `NEXT_PUBLIC_STACK_PROJECT_ID`, `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`, and `STACK_SECRET_SERVER_KEY` are configured for `stage`; `DATABASE_URL` is still pending until the Coolify stage database is created and seeded.
- Coolify server: UUID `r36ux4cb65rdjty4mfwzxddp`; API/panel host is the configured Coolify instance in `~/.config/coolify/config.json`.
- Coolify project for this app: `Encuentra24`, UUID `e42ax6tdsu98817izek5cfld`, production environment UUID `dp0u9b5klwxms2gp4njlgxck`.
- Production Coolify database: resource `encuentra24-db`, UUID `vl1l6zp76jkgc2uiu03oopiy`, image `postgres:18.3-alpine`, public port `54321`, database/user `encuentra24`, limits `2` CPU and `2g` memory. Do not paste or commit the password from Coolify output.
- Planned staging Coolify database: resource `encuentra24-stage-db`, database/user `encuentra24_stage`, image `postgres:18.3-alpine`, proposed public port `54322`, proposed limits `1` CPU and `1g` memory. Creating this resource still requires explicit user confirmation of resource limits.
- The staging web deployment must use the staging PostgreSQL database only, never the production `DATABASE_URL`.
- The production Coolify database is the source of truth; the stage database is disposable and can be wiped after explicit confirmation.
- Do not run crawlers against production while testing staging changes unless the user explicitly asks for it.
- `coolify database list --format json` prints database passwords. Use it only when needed, never paste the secret values into chat, commits, logs, or docs.

#### Wipe and Re-Seed Stage Database From Production
Use this only for the stage database. These commands intentionally drop objects in the stage database, so verify both connection targets before running them.

1. Create a local PostgreSQL service file outside the repo:
   ```ini
   # ~/.config/encuentra24/pg_service.conf
   [e24_prod]
   host=<prod-db-host>
   port=54321
   dbname=encuentra24
   user=encuentra24
   password=<prod-password>
   sslmode=disable

   [e24_stage]
   host=<stage-db-host>
   port=54322
   dbname=encuentra24_stage
   user=encuentra24_stage
   password=<stage-password>
   sslmode=disable
   ```
   Then lock it down:
   ```bash
   chmod 600 ~/.config/encuentra24/pg_service.conf
   ```

2. Verify the endpoints without printing credentials:
   ```bash
   export PGSERVICEFILE="$HOME/.config/encuentra24/pg_service.conf"
   psql service=e24_prod -c "select current_database(), current_user, inet_server_addr(), inet_server_port();"
   psql service=e24_stage -c "select current_database(), current_user, inet_server_addr(), inet_server_port();"
   ```

3. Dump production to a local temporary file:
   ```bash
   pg_dump --format=custom --no-owner --no-acl --file=/tmp/encuentra24-prod.dump service=e24_prod
   ```

4. Wipe stage and restore the production dump into it:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-acl --dbname=service=e24_stage /tmp/encuentra24-prod.dump
   ```

5. Validate row counts on stage before using it:
   ```bash
   psql service=e24_stage -c "select count(*) as listings from listings;"
   psql service=e24_stage -c "select count(*) as price_history_rows from price_history;"
   psql service=e24_stage -c "select count(*) as sellers from sellers;"
   ```

### Verify Your Changes
- After modifying any API route, trace every frontend component that consumes it and verify nothing breaks
- After modifying a query, check all places that reference the same fields/aliases
- Run `npx tsc --noEmit` from `web/` after every change to catch type errors
- If you change a data shape (rename a field, add/remove a property), update every consumer

### SQL Query Standards
- Queries hit a real database with tens/hundreds of thousands of rows — write them efficiently
- Use appropriate WHERE clauses, indexes, and FILTER conditions instead of fetching everything and filtering in JS
- Do aggregation, sorting, and pagination server-side in SQL, not client-side
- **Do NOT add arbitrary LIMIT clauses** on aggregation queries — they silently hide data and make totals/averages incorrect
- LIMIT is only appropriate for display pagination (with user-facing page controls) or "latest N" preview lists
- When joining or subquerying, think about the execution plan — avoid N+1 patterns

### Think Before Implementing — Cover ALL Cases
- This project has 4 listing categories (`sale`, `rental`, `vacation`, `new_project`), multiple regions, and varied HTML structures across Encuentra24. **Do not assume behavior from one category applies to all.**
- When building features that depend on page structure (scraping, detection, extraction): test against every category and subcategory, not just a sample. If you tested on `sale/casas` and assumed `vacation` works the same, you will break production.
- When a heuristic could produce false positives/negatives (e.g. "is this listing removed?"), think about all the edge cases BEFORE implementing. Ask: "What if this assumption doesn't hold for vacation rentals? For commercial properties? For new projects?"
- If you're unsure whether a pattern holds across all data, say so and propose a verification step — don't ship it and hope for the best.
- **Never run queries with credentials visible in command history or logs.**

### Change Discipline
- Make the minimal change needed. Don't refactor surrounding code while fixing a bug
- If a change touches multiple files, verify each one compiles and the data flows correctly end-to-end
- When modifying shared types or interfaces, grep for all usages before changing

## Project Overview

Encuentra24 property listing crawler and dashboard. Two main components sharing a PostgreSQL database:
- **Root (`/src`)**: CLI crawler that scrapes Encuentra24.com listings
- **Web (`/web`)**: Next.js dashboard for browsing, analyzing, and managing scraped listings

## Commands

### Web App (run from `web/`)
- `npm run dev` — Next.js dev server on port 3000
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — type-check without emitting
- `npm run db:generate` — generate Drizzle migrations
- `npm run db:migrate` — run migrations
- `npm run db:push` — push schema directly to DB

### CLI Crawler (run from root)
- `npm run build` — compile TypeScript to `./dist`
- `npm run dev` — run CLI with tsx
- `npm run db:generate` / `npm run db:migrate` — Drizzle migrations

## Architecture

### Database
- **PostgreSQL** via Drizzle ORM (do NOT use sqlite3)
- Connection through `postgres` (postgres.js) library
- Schema defined in `src/db/schema.ts` and `web/src/db/schema.ts` (kept in sync)
- Crawler tables: `listings` (60+ fields), `price_history`, `crawl_runs`, `sellers`, `crawl_errors`
- App tables (user-scoped): `favorites`, `pipeline_items`, `property_notes`, `saved_searches`

### Listing Categories
Listings have a `category` field with values: `sale`, `rental`, `vacation`, `new_project`. When aggregating prices, rent and sale prices must be treated separately — they are fundamentally different scales.

### Web App
- Next.js App Router with `(app)` route group for authenticated pages
- Authentication: Stack framework (`requireUser()` in API routes, cookie-based tokens)
- Data fetching: React Query (`@tanstack/react-query`)
- Styling: Tailwind CSS 4
- Maps: Leaflet + react-leaflet with clustering
- Charts: Recharts
- API routes use raw SQL via `db.all<T>(sql\`...\`)` for aggregation queries and Drizzle query builder for simpler queries
- `web/src/db/query-builder.ts` builds dynamic WHERE clauses from `ListingFilters`

### CLI/Crawler
- Commander.js CLI (`e24` binary)
- Crawlee framework with Cheerio for HTML parsing
- Playwright for contact detail scraping (WhatsApp numbers)
- Extractors in `src/crawler/extractors/` parse list pages, detail pages, JSON-LD, and Loopa data
- Categories/regions configured in `src/crawler/categories.ts`

### Key Patterns
- API routes return data shaped for specific frontend components (dashboard tabs, agent pages, leaderboards)
- Price formatting uses `formatPrice()` and `formatCompactPrice()` from `web/src/lib/formatters.ts`
- Location hierarchy: city → location → category/subcategory
