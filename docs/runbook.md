# Runbook

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_SUPABASE_TEMPLATE`
- `TWELVE_DATA_API_KEY`
- `TWELVE_DATA_BASE_URL`
- `POLL_INTERVAL_MS`
- `MAX_SYMBOLS_PER_RUN`
- `MAX_WATCHLIST_SIZE`
- `FRESHNESS_TARGET_SECONDS`

## Local startup

1. Create the database objects from `supabase/schema.sql`.
2. Populate `.env.local`.
3. Start the frontend and confirm Clerk renders sign-in controls.
4. Start the worker and verify `ingestion_runs` receives a successful row.
5. Add a symbol to a user watchlist and confirm `quotes_current` updates.

## Deployment order

1. Apply the latest schema to Supabase.
2. Configure env vars in Vercel and Railway.
3. Deploy the worker first and verify successful ingestion.
4. Deploy the web app and verify auth plus live updates.

## Failure modes

- `429` from Twelve Data: expected under bad scheduling or oversized demand; reduce `MAX_SYMBOLS_PER_RUN` or widen freshness targets.
- empty dashboard rows: usually means the symbol has not been polled yet or the API rejected the symbol.
- stale data badges: worker is down, rate-limited, or not keeping up with demand.

## Rollback

- revert the latest deploy on Vercel or Railway
- restore the previous schema migration if a breaking table change was introduced
- verify `ingestion_runs` starts succeeding again before declaring recovery
