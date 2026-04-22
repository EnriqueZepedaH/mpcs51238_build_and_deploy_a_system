# System Architecture

## Overview

Market Pulse is a multi-service realtime system that ingests stock quote data, stores both current and historical views, and pushes updates to the frontend without page refreshes.

## Service boundaries

### `apps/worker`

- reads the global union of symbols from `user_watchlists`
- prioritizes symbols with a scheduler that balances watcher demand and quote staleness
- fetches batched quotes from Twelve Data within the free-tier credit budget
- upserts `quotes_current`
- appends `quotes_history`
- records run status in `ingestion_runs`

### `apps/web`

- authenticates users with Clerk
- lets users manage a private watchlist
- reads quote snapshots from Supabase
- subscribes to Realtime changes for `quotes_current` and `ingestion_runs`
- renders both business data and operational health

### `supabase`

- stores personalization, serving data, historical snapshots, and ops metadata
- enforces row-level controls on watchlist data
- publishes realtime updates for quote and health tables

## Core data flow

1. A signed-in user adds symbols to `user_watchlists`.
2. The worker aggregates all tracked symbols.
3. The scheduler chooses the next batch based on watcher count and staleness.
4. Quotes are fetched from Twelve Data and normalized.
5. Current state is upserted into `quotes_current`.
6. Historical snapshots are appended into `quotes_history`.
7. Supabase Realtime pushes updates to the frontend.
8. The dashboard updates live and recalculates freshness badges client-side.

## Reliability choices

- current-state writes are idempotent by primary key (`symbol`)
- history writes are idempotent by unique key (`symbol`, `as_of`)
- the worker stores run metrics to make outages and degraded freshness visible
- free-tier limits are treated as a design constraint, not an exception path

## Reference data scope

- v1 will maintain a limited symbol reference strategy aligned with Twelve Data Basic limits
- the system will target US stocks plus watchlist-seen ETFs instead of a full market-wide symbol master
- obvious junk symbols are rejected on write, but true symbol existence should be validated against reference data once the provider integration is enabled
- full symbol-master coverage remains a backlog item because free-tier ETF coverage is incomplete and should not be overstated
