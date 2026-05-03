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

Vercel project:
- Name: `encuentra24-api`
- Project ID: `prj_LccjoDXiORVjhSM2fWo5eUXtskQg`
- Team slug: `my-team-43dbe230`
- Team ID: `team_AZDD5XdLKWjaDiWBNWcpKX2t`
- Production branch: `main`
- Stage branch/custom environment: `stage`
- Stage environment ID: `env_xb8IK0rFusqCHDjJRVtMapAiBR6z`
- Stage alias: `https://encuentra24-api-env-stage-my-team-43dbe230.vercel.app`
