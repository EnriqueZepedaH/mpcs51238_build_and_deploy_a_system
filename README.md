# Market Pulse Pipeline

Market Pulse is a realtime stock watchlist system built for a systems architecture course and positioned as a portfolio-grade data engineering project.

## Architecture

`Twelve Data -> Railway worker -> Supabase -> Realtime -> Next.js -> Vercel`

- `apps/worker`: polls Twelve Data, applies scheduling and rate limiting, then writes current and historical quote data into Supabase.
- `apps/web`: Clerk-authenticated dashboard for watchlists, live quotes, and operational health.
- `packages/shared`: shared quote models and freshness logic so the worker and frontend do not drift.

## Why this repo is structured this way

This repo favors explicit service boundaries and operational visibility over raw implementation speed:

- ingestion is idempotent
- quote freshness is visible in the UI
- write paths and read paths are separated
- operational metadata is stored alongside business data

That tradeoff is deliberate. For a portfolio project, correctness, observability, and documentation matter more than cramming in extra features.

## Local development

1. Install dependencies with `npm install`.
2. Use `.env.example` as the source of truth for required variables.
3. Create `apps/web/.env.local` with the web app's public Supabase and Clerk variables.
4. Create `apps/worker/.env.local` with the worker's Supabase service-role and Twelve Data variables.
5. Create the Supabase schema from `supabase/schema.sql`.
6. Run the web app with `npm run dev -- --filter=web`.
7. Run the worker with `npm run dev -- --filter=worker`.

## Quality gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Deployment

- Vercel deploys `apps/web`
- Railway deploys `apps/worker`
- Supabase hosts Postgres, auth-adjacent JWT integration, and Realtime

## Deploy checklist

1. Create one Vercel project with root directory `apps/web`.
2. Create one Railway service with root directory `apps/worker`.
3. Configure the environment variables documented in `docs/runbook.md`.
4. Deploy the worker first and verify `ingestion_runs` succeeds.
5. Deploy the web app and verify sign-in, watchlist mutations, and live updates.

See `CLAUDE.md` for architecture, `docs/database-schema.md` for the data model, and `docs/runbook.md` for operational procedures.
