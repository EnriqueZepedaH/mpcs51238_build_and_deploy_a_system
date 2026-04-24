# Backlog

## Full symbol-master coverage beyond the curated history universe

Goal: expand validation and symbol search beyond the curated charting universe without overstating market-wide coverage.

Current implementation:
- `symbol_master` now exists and supports the historical charting subsystem
- the charting pipeline is intentionally limited to a curated universe instead of the full listed market

Backlog scope:
- ingest a broader US stock universe for validation and search
- decide whether ETF coverage should remain watchlist-driven or expand into a fuller reference dataset
- keep the charting universe and the validation universe explicit so the product does not claim complete market coverage by accident

Provider options to evaluate:
- Twelve Data reference endpoints for a single-provider story
- Alpaca `GET /v2/assets`
  - useful `active` and `tradable` fields
  - caveat: tradability is Alpaca-specific, not universal market truth
- SEC EDGAR API
  - useful supplemental issuer metadata
  - not sufficient alone as the canonical exchange and symbol directory

Acceptance criteria:
- watchlist add flow can validate existence against `symbol_master`
- symbol search works without granting access to non-watchlist chart data
- docs continue to describe any ETF or market-coverage limits honestly

Follow-on backlog:
- full market-wide symbol search and reference-data reconciliation

## Operations and Product

- alerting for stale quote thresholds and repeated worker failures
- richer historical charts and anomaly detection
- comparative multi-symbol history views
- historical batch health surfaced on the observability tab from `historical_job_runs` (requires a new RLS policy and shared types; the batch job row schema already exists)
- symbol search backed by the expanded `symbol_master`
- run history table and per-run metrics chart on the observability tab — the run timeline strip already ships, so the next adds are a sortable table with expandable `error_details` and a time-series chart of `rows_written` / `api_credits_used`
- multi-source failover if Twelve Data becomes unavailable

## Storage and historical-pipeline hardening

Current state:
- the first full curated-history backfill loaded about 4.64 million rows into `daily_price_history`
- total project database size is now above the Supabase Free limit
- `historical_job_runs` currently under-reports successful inserts during full backfills

Backlog scope:
- reduce long-range history storage cost without deleting core end-user functionality
- fix batch job accounting so `historical_job_runs` reflects inserted and updated row counts accurately
- decide whether to keep the full 553-symbol universe on Supabase, shrink the retained universe, or move long-range history to a different storage tier

Candidate directions:
- remove or redesign nonessential indexes on `daily_price_history`
- partition or compress long-range history
- reduce ETF/history retention scope while keeping the watchlist chart useful
- move archival history to cheaper analytical storage while keeping recent chart-serving slices in Supabase

Acceptance criteria:
- database size returns to a sustainable operational target for the chosen hosting tier
- historical chart queries remain fast for end users
- `historical_job_runs` accurately reports inserts, updates, and failures for batch jobs
