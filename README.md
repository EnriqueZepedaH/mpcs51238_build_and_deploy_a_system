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

1. Copy `.env.example` to `.env.local` at the repo root.
2. Create the Supabase schema from `supabase/schema.sql`.
3. Install dependencies with `npm install`.
4. Run the web app with `npm run dev -- --filter=web`.
5. Run the worker with `npm run dev -- --filter=worker`.

## Quality gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Deployment

- Vercel deploys `apps/web`
- Railway deploys `apps/worker`
- Supabase hosts Postgres, auth-adjacent JWT integration, and Realtime

See `CLAUDE.md` for architecture, `docs/database-schema.md` for the data model, and `docs/runbook.md` for operational procedures.
