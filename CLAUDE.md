# System Architecture

## Overview

Market Pulse is a multi-service system that combines realtime quote ingestion with a separate batch history pipeline, stores both current and long-range views, and pushes updates to the frontend without page refreshes.

## Service boundaries

### `apps/worker`

- reads the global union of symbols from `user_watchlists`
- prioritizes symbols with a scheduler that balances watcher demand and quote staleness
- fetches batched quotes from Twelve Data within the free-tier credit budget
- upserts `quotes_current`
- appends `quotes_history`
- records run status in `ingestion_runs`

### `apps/history-batch`

- maintains the curated `symbol_master` dimension
- bulk-imports historical CSV backfills
- appends `daily_price_history` from `yfinance`
- runs scheduled reconciliation jobs and records them in `historical_job_runs`
- is intentionally separate from the live quote worker so monthly reconciliation does not interfere with realtime freshness

### `apps/web`

- authenticates users with Clerk
- lets users manage a private watchlist
- reads quote snapshots from Supabase
- reads long-range daily history for watchlist-scoped charts
- subscribes to Realtime changes for `quotes_current` and `ingestion_runs`
- renders both business data and operational health

### `supabase`

- stores personalization, serving data, historical snapshots, and ops metadata
- enforces row-level controls on watchlist data
- publishes realtime updates for quote and health tables

## Core data flow

1. A signed-in user adds symbols to `user_watchlists`.
2. The live worker aggregates all tracked symbols.
3. The scheduler chooses the next batch based on watcher count and staleness.
4. Quotes are fetched from Twelve Data and normalized.
5. Current state is upserted into `quotes_current`.
6. Recent operational snapshots are appended into `quotes_history`.
7. In parallel, the batch service maintains `symbol_master` and `daily_price_history`.
8. Supabase Realtime pushes `quotes_current` and `ingestion_runs` updates to the frontend.
9. The dashboard updates live and the historical panel computes performance from stored daily history.

## Reliability choices

- current-state writes are idempotent by primary key (`symbol`)
- history writes are idempotent by unique key (`symbol`, `as_of`)
- long-range chart history is idempotent by unique key (`symbol_id`, `trading_date`)
- the worker stores run metrics to make outages and degraded freshness visible
- the batch service stores monthly and import outcomes in `historical_job_runs`
- free-tier limits are treated as a design constraint, not an exception path

## Reference and historical data scope

- the charting subsystem uses a curated symbol universe instead of a market-wide master
- `symbol_master` and `daily_price_history` are the long-range storage path, not `quotes_history`
- obvious junk symbols are rejected on write, but full market-wide symbol validation remains a backlog item
- monthly reconciliation keeps the curated symbol dimension and recent history window healthy without claiming universal market coverage
