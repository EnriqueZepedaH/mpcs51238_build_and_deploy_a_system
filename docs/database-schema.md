# Database Schema

This project uses a layered schema so the pipeline is easy to reason about and operate:

- personalization data is isolated from market data
- current serving state is separated from historical storage
- long-range chart history is separated from live operational snapshots
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

### `public.user_portfolio_lots`

Purpose: stores each signed-in user's owned positions as individual buy lots so the dashboard can show unrealized P&L.

Key columns:
- `id`: surrogate primary key
- `clerk_user_id`: external identity from Clerk
- `symbol`: uppercase stock or ETF ticker
- `shares`: number of shares in this lot (positive)
- `cost_basis`: per-share purchase price (non-negative)
- `purchased_at`: timestamp the lot was acquired
- `note`: optional free-text annotation
- `created_at`: when the row was recorded

Rules:
- unlimited lots per `(clerk_user_id, symbol)` — each buy is a separate row
- a user is capped at 15 distinct symbols; the API enforces this on insert
- RLS restricts reads, inserts, and deletes to the owning user
- indexed on `(clerk_user_id, symbol)` for fast per-user aggregation

Why it exists:
- separates owned positions from watchlist interest so users can track holdings they do not watch, or watch symbols they do not own
- the worker unions this table with `user_watchlists` when deciding what to poll, so owned symbols stay fresh even if they are not on the watchlist
- multi-lot storage enables both an aggregated summary view and a per-buy detail view without losing cost-basis history

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
- it supports recent trend analysis, replay/debugging, and auditability for the live quote worker
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

### `public.symbol_master`

Purpose: stores the curated symbol dimension used by the historical charting pipeline.

Key columns:
- `id`: stable surrogate key used by long-range history rows
- `symbol`: unique ticker symbol
- `name`, `exchange`, `instrument_type`, `country`: descriptive metadata
- `is_active`: whether the symbol should still be considered active in the curated universe
- `is_curated`, `curated_rank`: whether the symbol belongs to the maintained universe and its ranking within that list
- `last_refreshed_at`: when the symbol metadata was last reconciled
- `source`, `source_status`, `raw_payload`: provenance and raw metadata from the batch pipeline

Why it exists:
- this is the reference-data dimension for long-horizon history
- it avoids duplicating symbol text on every daily history row
- it lets the app keep a stable `symbol_id` even if metadata changes later
- the current loaded universe is 553 curated symbols:
  - 503 S&P 500 constituents
  - 50 ETFs by AUM

### `public.daily_price_history`

Purpose: stores the lean daily adjusted-close history used for long-range performance charts.

Key columns:
- `symbol_id`: foreign key to `symbol_master.id`
- `trading_date`: daily grain for the chart dataset
- `adjusted_close`: adjusted closing price used as the chart baseline
- `volume`: daily volume when available

Rules:
- unique on `(symbol_id, trading_date)` to make imports and monthly refreshes idempotent

Why it exists:
- this is the chart-serving history table
- it is intentionally separate from `quotes_history`
- it keeps storage lean enough for multi-year daily history

Current operational note:
- a full backfill for the 553-symbol curated universe produced about 4.64 million rows
- most of the storage cost is currently in indexes, not the base heap table
- this is now large enough to exceed Supabase Free, so future storage work should focus on retention, index shape, or pricing tier changes

### `public.historical_job_runs`

Purpose: records the outcomes of symbol-master refreshes, CSV imports, and monthly history reconciliation jobs.

Key columns:
- `job_type`: batch job name such as `symbol_master_sync` or `history_csv_import`
- `started_at`, `completed_at`: execution window
- `status`: `running`, `success`, `partial`, or `error`
- `symbols_considered`: how many symbols the batch job touched
- `rows_inserted`, `rows_updated`, `rows_deleted`: data-change counts
- `error_count`, `error_details`: diagnostics for partial or failed runs

Why it exists:
- this is the observability layer for the batch history pipeline
- it makes the monthly reconciliation job auditable without reading service logs

## Derived objects

### `public.symbol_watchlist_rollup`

Purpose: derives watcher counts per symbol from `user_watchlists`.

Why it exists:
- lets the worker understand demand without duplicating logic in application code
- uses `security_invoker = true` so it respects caller permissions instead of bypassing them

## Data flow

1. A user adds symbols to `user_watchlists` or buy lots to `user_portfolio_lots`.
2. The worker reads the union of tracked symbols across both tables.
3. The scheduler prioritizes symbols using watcher demand and staleness.
4. The worker fetches quotes from Twelve Data.
5. Latest state is upserted into `quotes_current`.
6. Snapshots are appended into `quotes_history`.
7. In parallel, the batch service maintains `symbol_master` and `daily_price_history`.
8. Operational results are written into `ingestion_runs` and `historical_job_runs`.
9. Supabase Realtime pushes `quotes_current` and `ingestion_runs` updates to the dashboard.
10. The historical chart route reads `symbol_master` and `daily_price_history`, clamps the requested reference date to the first available stored row, and computes percentage return or price delta in the application layer.

## Security model

- `user_watchlists` and `user_portfolio_lots` are user-scoped with RLS based on Clerk identity propagated into Supabase JWT claims
- `quotes_current`, `quotes_history`, and `ingestion_runs` are readable only to authenticated clients with valid Supabase-compatible Clerk tokens
- `symbol_master` and `daily_price_history` are readable only for symbols already present in the caller's watchlist
- `historical_job_runs` is readable to authenticated users so the product can expose batch-pipeline health later if needed
- writes to quote and ops tables are intended to come from the worker using the service-role key

This is a stronger security posture than the initial scaffold because the web app no longer uses the service-role key for normal user access. The remaining hard dependency is Clerk-to-Supabase token compatibility, which must be configured either through Supabase Third-Party Auth with Clerk or the older JWT template fallback.
