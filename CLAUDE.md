# System Architecture

## Overview

Market Pulse is a multi-service system that combines realtime quote ingestion with a separate batch history pipeline, stores both current and long-range views, and pushes updates to the frontend without page refreshes.

## Service boundaries

### `apps/worker`

- reads the global union of symbols from `user_watchlists` and `user_portfolio_lots` so owned positions stay fresh even when they are not watched
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
- lets users manage a private watchlist and a private portfolio of buy lots, capped at 15 distinct symbols per user
- computes unrealized P&L in the browser from current quotes and stored cost basis
- reads quote snapshots from Supabase and per-symbol sparkline data from `quotes_history`
- reads long-range daily history for watchlist-scoped charts and for the portfolio "fill from historical close" action
- subscribes to Realtime changes for `quotes_current` and `ingestion_runs`
- renders business data and operational health on two URL-routed dashboard tabs:
  - `/dashboard` — portfolio, watchlist, ticker-tape marquee, and historical performance chart
  - `/dashboard/observability` — ingestion-run KPIs, a run timeline strip, and a stalest-symbols grid
- the pipeline status tile remains visible on both tabs via the shared KPI strip so degraded worker state is never hidden behind a click

### `supabase`

- stores personalization, serving data, historical snapshots, and ops metadata
- enforces row-level controls on watchlist and portfolio data
- publishes realtime updates for quote and health tables

## Core data flow

1. A signed-in user adds symbols to `user_watchlists` or buy lots to `user_portfolio_lots`.
2. The live worker aggregates all tracked symbols across both tables.
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
- the current curated universe is the live S&P 500 constituent list plus the top 50 ETFs by AUM, for a total of 553 symbols
- watchlist users can query historical performance only for symbols they already track; chart access is intentionally scoped by watchlist membership
- the portfolio lot entry flow only accepts curated-universe symbols; non-curated symbols surface a "premium" lock in the UI and a 402 response from `/api/portfolio`, which stands in for a future paid tier rather than a real paywall
