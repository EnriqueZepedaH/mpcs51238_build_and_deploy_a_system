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
- historical batch health surfaced in the UI from `historical_job_runs`
- symbol search backed by the expanded `symbol_master`
- incident timeline page for ops debugging
- multi-source failover if Twelve Data becomes unavailable
