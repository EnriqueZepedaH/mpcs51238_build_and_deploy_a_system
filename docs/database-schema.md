# Database Schema

This project uses a layered schema so the pipeline is easy to reason about and operate:

- personalization data is isolated from market data
- current serving state is separated from historical storage
- operational metadata is stored explicitly instead of hidden in logs

## Tables

### `public.user_watchlists`

Purpose: stores each signed-in user's selected ticker symbols.

Key columns:
- `id`: surrogate primary key
- `clerk_user_id`: external identity from Clerk
- `symbol`: uppercase stock or ETF ticker
- `created_at`: when the user started tracking the symbol

Rules:
- one row per `(clerk_user_id, symbol)`
- RLS restricts reads and writes to the owning user

Why it exists:
- this is the personalization layer
- the worker uses the union of these rows to decide what to poll

### `public.quotes_current`

Purpose: stores the latest known quote per symbol for fast dashboard reads and Realtime updates.

Key columns:
- `symbol`: primary key
- `price`: latest normalized price
- `percent_change`, `volume`, `previous_close`: market metrics shown in the UI
- `watcher_count`: how many users currently track the symbol
- `source_timestamp`: timestamp from Twelve Data when available
- `last_ingested_at`: when the worker last stored this record
- `raw_payload`: original source payload for debugging

Why it exists:
- this is the serving table for the frontend
- it supports idempotent upserts by symbol
- it is part of the Supabase Realtime publication

### `public.quotes_history`

Purpose: stores append-only snapshots of quote data over time.

Key columns:
- `id`: identity primary key
- `symbol`: foreign key to `quotes_current.symbol`
- `as_of`: timestamp representing the quote snapshot time
- `price`, `percent_change`, `volume`: time-series values
- `ingested_at`: when the worker stored the snapshot
- `raw_payload`: original source payload for replay/debugging

Rules:
- unique on `(symbol, as_of)` to prevent duplicate snapshots

Why it exists:
- this is the historical analytics layer
- it supports charts, trend analysis, and auditability
- it is currently Realtime-enabled because the worker writes to it, though this may be revisited if event volume becomes unnecessary

### `public.ingestion_runs`

Purpose: records worker execution outcomes and pipeline health.

Key columns:
- `id`: primary key
- `started_at`, `completed_at`: run duration
- `status`: `running`, `success`, `partial`, or `error`
- `symbols_considered`, `symbols_polled`: scheduler coverage
- `rows_written`: total database writes
- `api_credits_used`: external API cost proxy
- `stale_symbols`, `max_quote_age_seconds`: freshness metrics
- `error_count`, `error_details`: failure diagnostics

Why it exists:
- this is the observability layer
- the frontend can surface pipeline health without reading logs
- it is part of the Supabase Realtime publication

## Derived objects

### `public.symbol_watchlist_rollup`

Purpose: derives watcher counts per symbol from `user_watchlists`.

Why it exists:
- lets the worker understand demand without duplicating logic in application code
- uses `security_invoker = true` so it respects caller permissions instead of bypassing them

## Data flow

1. A user adds symbols to `user_watchlists`.
2. The worker reads the union of tracked symbols.
3. The scheduler prioritizes symbols using watcher demand and staleness.
4. The worker fetches quotes from Twelve Data.
5. Latest state is upserted into `quotes_current`.
6. Snapshots are appended into `quotes_history`.
7. Operational results are written into `ingestion_runs`.
8. Supabase Realtime pushes `quotes_current` and `ingestion_runs` updates to the dashboard.

## Security model

- `user_watchlists` is user-scoped with RLS based on Clerk identity propagated into Supabase JWT claims
- `quotes_current`, `quotes_history`, and `ingestion_runs` are readable only to authenticated clients with valid Supabase-compatible Clerk tokens
- writes to quote and ops tables are intended to come from the worker using the service-role key

This is a stronger security posture than the initial scaffold because the web app no longer uses the service-role key for normal user access. The remaining hard dependency is Clerk-to-Supabase token compatibility, which must be configured either through Supabase Third-Party Auth with Clerk or the older JWT template fallback.
