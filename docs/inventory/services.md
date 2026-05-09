# Service Inventory

Non-secret inventory for deployed resources. Do not store passwords, tokens, or full connection strings here.

## Encuentra24

Coolify project:
- Name: `Encuentra24`
- UUID: `e42ax6tdsu98817izek5cfld`
- Environment: `production`
- Environment UUID: `dp0u9b5klwxms2gp4njlgxck`

Production database:
- Name: `encuentra24-db`
- UUID: `vl1l6zp76jkgc2uiu03oopiy`
- Type: standalone PostgreSQL
- Image: `postgres:18.3-alpine`
- Public port: `54321`
- Database/user: `encuentra24`
- Limits: `2` CPU, `2g` memory

Stage database:
- Name: `encuentra24-stage-db`
- UUID: `z8svayjxuxcj5xowgd78m2bh`
- Type: standalone PostgreSQL
- Image: `postgres:18.3-alpine`
- Public port: `54322`
- Database/user: `encuentra24_stage`
- Limits: `1` CPU, `1g` memory, `0` swap
- Created: 2026-05-03
- Purpose: disposable stage copy of production data for the Vercel `stage` custom environment.

Crawlee migration database:
- Name: `encuentra24-crawlee-db`
- UUID: `z11hfr52rm9dcdb66rxt0vk3`
- Type: standalone PostgreSQL
- Image: `postgres:18.3-alpine`
- Public port: `54323`
- Database/user: `encuentra24_crawlee`
- Limits: `1` CPU, `1g` memory, `0` swap
- Created: 2026-05-09
- Purpose: parallel Crawlee Cloud migration validation database. Keep legacy production crawler on `encuentra24-db` while actor runs write here.
- Last seed: production restore on 2026-05-09. Matching post-restore counts: `listings` 101062, `price_history` 18038, `sellers` 1542, `crawl_runs` 1389, `crawl_errors` 3284, `crawl_seen_listings` 86320.
- Smoke: actor-style incremental `new_project/proyectos-nuevos` run `1390` completed with 1 page, 4 listings found, 0 errors.

Crawlee Cloud platform:
- Name: `encuentra24-crawlee-cloud`
- UUID: `bdvayjem0bz9pes8fmt5rc19`
- Type: custom Docker Compose service
- Domains: `https://crawlee.llermaly.com`, `https://crawlee-dashboard.llermaly.com`
- Components: API, dashboard, runner, scheduler, Postgres, Redis, MinIO
- Source: `crawlee-cloud/crawlee-cloud` pinned to commit `8b40c8d8371a431cbcfe785c632091981bbc5328`
- Status as of 2026-05-09: stopped. Initial start made the Coolify panel/API intermittently unavailable; service was stopped and the panel recovered.
- Notes: upstream API enables PostgreSQL SSL automatically when `NODE_ENV=production`, which fails against the bundled local Postgres. The stopped service definition uses a startup command workaround for the API migration/start path and patches the runner container at runtime to skip its broad Docker cleanup calls. Do not restart without a controlled maintenance window and live monitoring.

Vercel project:
- Name: `encuentra24-api`
- Project ID: `prj_LccjoDXiORVjhSM2fWo5eUXtskQg`
- Team slug: `my-team-43dbe230`
- Team ID: `team_AZDD5XdLKWjaDiWBNWcpKX2t`
- Production branch: `main`
- Stage branch/custom environment: `stage`
- Stage environment ID: `env_xb8IK0rFusqCHDjJRVtMapAiBR6z`
- Stage alias: `https://encuentra24-api-env-stage-my-team-43dbe230.vercel.app`
