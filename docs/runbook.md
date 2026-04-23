# Runbook

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SUPABASE_TEMPLATE` (optional legacy fallback)
- `CLERK_SUPABASE_TEMPLATE`
- `TWELVE_DATA_API_KEY`
- `TWELVE_DATA_BASE_URL`
- `POLL_INTERVAL_MS`
- `MAX_SYMBOLS_PER_RUN`
- `MAX_WATCHLIST_SIZE`
- `FRESHNESS_TARGET_SECONDS`
- `SUPABASE_DB_URL`
- `HISTORY_BATCH_CHUNK_SIZE`
- `YFINANCE_GROUP_SIZE`

## Local startup

1. Create the database objects from `supabase/schema.sql`.
2. Populate `apps/web/.env.local` with the web app variables.
3. Populate `apps/worker/.env.local` with the worker variables.
4. Configure Supabase Third-Party Auth with Clerk. If you are using the older JWT template flow, set the optional Clerk Supabase template env vars instead.
5. Restart the web dev server after any auth or env changes. Next.js can keep stale auth config in memory during local development.
6. Start the frontend and confirm Clerk renders sign-in controls.
7. Start the worker and verify `ingestion_runs` receives a successful row.
8. Add a symbol to a user watchlist and confirm `quotes_current` updates.
9. If you are testing the history pipeline, activate `apps/history-batch`, sync a curated manifest, and import or append daily history before expecting charts to render.

## Deployment order

1. Apply the latest schema to Supabase.
2. Create the Vercel project with root directory `apps/web`.
3. Configure web env vars in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `MAX_WATCHLIST_SIZE`
   - `FRESHNESS_TARGET_SECONDS`
   - optional legacy Clerk template vars only if Third-Party Auth with Clerk is not configured
4. Create the Railway service with root directory `apps/worker`.
5. Configure worker env vars in Railway:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TWELVE_DATA_API_KEY`
   - `TWELVE_DATA_BASE_URL`
   - `POLL_INTERVAL_MS`
   - `MAX_SYMBOLS_PER_RUN`
   - `FRESHNESS_TARGET_SECONDS`
6. Set the Railway start command to `npm run start` for the worker service.
7. Deploy the worker first and verify successful ingestion.
8. Deploy the web app and verify auth plus live updates.
9. If you want the historical subsystem in production, deploy `apps/history-batch` as a separate scheduled runtime and configure:
   - `SUPABASE_DB_URL`
   - `HISTORY_BATCH_CHUNK_SIZE`
   - `YFINANCE_GROUP_SIZE`
10. Schedule batch commands separately:
   - daily append: `python -m history_batch.cli append-latest --period 3mo`
   - monthly reconcile: `python -m history_batch.cli monthly-reconcile --manifest ./config/curated_symbols.example.csv --period 3mo`

## Production verification

1. Sign in through the deployed web app.
2. Add `AAPL` and `MSFT` to the watchlist.
3. Confirm `quotes_current` is populated and dashboard rows stop showing `Awaiting poll`.
4. Leave the dashboard open through at least one additional poll cycle and verify the UI updates without refresh.
5. Remove a symbol and confirm the watchlist updates immediately.
6. Confirm the latest `ingestion_runs` row is `success`.
7. If `symbol_master` and `daily_price_history` have been loaded, confirm the historical chart renders for a watchlist symbol and that a reference date earlier than stored history is clamped with a visible explanation.

## Failure modes

- `429` from Twelve Data: expected under bad scheduling or oversized demand; reduce `MAX_SYMBOLS_PER_RUN` or widen freshness targets.
- worker fails fast on missing env: expected if `apps/worker/.env.local` is missing or the process was started without loading that file.
- empty dashboard rows: usually means the symbol has not been polled yet or the API rejected the symbol.
- watchlist accepts a ticker-looking symbol that is not real: current behavior only validates symbol format until market-data polling is configured with a provider key.
- historical chart is unavailable: `symbol_master` or `daily_price_history` has not been loaded for that symbol yet, or the batch service has not been run in that environment.
- monthly reconcile writes zero rows: often means the curated symbol manifest was never synced, so the batch app has no active symbols to refresh.
- browser-side `Missing required environment variable` for Supabase: usually means a `NEXT_PUBLIC_*` env var is being read dynamically instead of statically in client code.
- stale data badges: worker is down, rate-limited, or not keeping up with demand.

## Rollback

- revert the latest deploy on Vercel or Railway
- restore the previous schema migration if a breaking table change was introduced
- verify `ingestion_runs` starts succeeding again before declaring recovery
