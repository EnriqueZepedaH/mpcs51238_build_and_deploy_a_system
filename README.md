# Market Pulse Pipeline

Market Pulse is a realtime stock watchlist system built for a systems architecture course and positioned as a portfolio-grade data engineering project. It now supports both live quote monitoring and watchlist-scoped historical performance charts backed by long-range daily price history in Supabase.

## Architecture

`Twelve Data -> Railway worker -> Supabase -> Realtime -> Next.js -> Vercel`

`CSV / yfinance -> Python batch service -> Supabase`

- `apps/worker`: polls Twelve Data, applies scheduling and rate limiting, then writes current and historical quote data into Supabase.
- `apps/history-batch`: imports curated symbol metadata and long-range daily price history for charting and monthly reconciliation.
- `apps/web`: Clerk-authenticated dashboard for watchlists, live quotes, historical performance, and operational health.
- `packages/shared`: shared quote and history models so the worker, frontend, and batch layer do not drift.

## Current product capabilities

- private, authenticated watchlists
- live quote polling with Supabase Realtime updates
- visible pipeline health from `ingestion_runs`
- reference-date historical performance charts for watchlist symbols
- a curated long-range history universe of:
  - current S&P 500 constituents
  - top 50 ETFs by AUM

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
6. If you want the history pipeline locally, create a Python virtualenv in `apps/history-batch`, install `requirements.txt`, and set `SUPABASE_DB_URL`.
   Use the Supabase session-pooler connection string if your local network does not support IPv6.
7. Run the web app with `npm run dev -- --filter=web`.
8. Run the worker with `npm run dev -- --filter=worker`.
9. If you want historical charts locally, run the history batch service to populate `symbol_master` and `daily_price_history` before expecting the chart panel to return data.

## Quality gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Deployment

- Vercel deploys `apps/web`
- Railway deploys `apps/worker`
- Railway cron or another scheduled runtime can execute `apps/history-batch`
- Supabase hosts Postgres, auth-adjacent JWT integration, and Realtime

## Deploy checklist

1. Create one Vercel project with root directory `apps/web`.
2. Create one Railway service for `apps/worker`.
3. Configure the environment variables documented in `docs/runbook.md`.
4. Deploy the worker first and verify `ingestion_runs` succeeds.
5. Deploy the web app and verify sign-in, watchlist mutations, live updates, and historical chart reads.
6. Configure the historical batch runtime separately if you want scheduled symbol-master reconciliation and daily-history maintenance.

## Known constraints

- the current historical backfill is intentionally limited to a curated universe, not the full listed market
- the first large backfill pushed the project past Supabase Free's 500 MB database limit, so storage reduction or a paid tier is now a tracked follow-up
- live quote polling and long-range history are intentionally separate services because their runtime and cost profiles are different

See `CLAUDE.md` for architecture, `docs/database-schema.md` for the data model, and `docs/runbook.md` for operational procedures.
