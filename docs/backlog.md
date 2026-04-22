# Backlog

## Symbol reference ingestion: US stocks + watchlist-seen ETFs

Goal: add an application-level `symbol_master` reference table for server-side symbol validation and future symbol search without claiming full market-wide coverage.

Planned scope:
- load US stocks from a reference-data source with a daily refresh cadence
- enrich ETFs only when they appear in user watchlists
- keep v1 coverage explicit: US stocks plus watchlist-seen ETFs, not a universal symbol master

Primary implementation approach:
- add a `symbol_master` table in Supabase
- run a dedicated worker job once per day
- fetch US stock reference data from Twelve Data reference endpoints
- upsert rows idempotently by `symbol`
- mark ETF rows that were introduced through watchlist usage so the app can validate them without claiming full ETF coverage

Alternative provider options:
- Alpaca `GET /v2/assets`
  - plausible source for app-level US equities and ETF reference data
  - useful `active` and `tradable` metadata
  - caveat: Alpaca status flags reflect Alpaca platform tradability, not universal market truth
- SEC EDGAR API
  - useful as a supplemental issuer/company metadata source
  - not sufficient by itself as the canonical symbol master
  - weak fit for ETF coverage, exchange truth, and tradability state

Proposed schema fields:
- `symbol`
- `name`
- `exchange`
- `instrument_type`
- `country`
- `is_active`
- `is_watchlist_seen_etf`
- `source`
- `source_status`
- `last_refreshed_at`
- `raw_payload`

Acceptance criteria:
- daily refresh job upserts stock reference rows without duplicates
- watchlist-seen ETFs can be inserted and enriched without requiring full ETF coverage
- watchlist add flow can validate symbol existence against `symbol_master`
- invalid/nonexistent symbols are rejected once reference-data validation is enabled
- docs continue to state that full symbol-master coverage remains backlog

Follow-on backlog:
- full symbol-master refresh beyond US stocks plus watchlist-seen ETFs

## Operations and Product

- alerting for stale quote thresholds and repeated worker failures
- richer historical charts and anomaly detection
- symbol search backed by `symbol_master`
- incident timeline page for ops debugging
- multi-source failover if Twelve Data becomes unavailable
