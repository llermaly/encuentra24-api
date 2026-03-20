# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ THIS IS A PRODUCTION PROJECT

This app runs against a live PostgreSQL database with real crawled data. Treat every change with the seriousness that demands:

### No Destructive Actions
- **NEVER** run DROP, DELETE, TRUNCATE, or ALTER that removes columns on the production database
- **NEVER** use `db:push` against production — use migrations only
- **NEVER** suggest `git reset --hard`, `git clean -f`, or force-pushes
- Before any schema change, confirm with the user — data loss is unrecoverable

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
