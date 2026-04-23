# Historical Batch Service

This service owns the long-horizon historical dataset and the curated symbol dimension used by the charting feature.

It is intentionally separate from `apps/worker`:

- `apps/worker` is the realtime quote pipeline
- `apps/history-batch` is the batch reference-data and historical-maintenance pipeline

That split is deliberate. Realtime quote freshness and multi-year historical maintenance have different runtimes, error modes, and storage concerns.

## Responsibilities

- upsert the curated `symbol_master` universe
- bulk-import historical daily price data from CSV
- append the latest daily history using `yfinance`
- run monthly reconciliation for symbol metadata and recent history
- write operational audit rows into `historical_job_runs`

## Required environment variables

- `SUPABASE_DB_URL`
- `HISTORY_BATCH_CHUNK_SIZE` optional, defaults to `1000`
- `YFINANCE_GROUP_SIZE` optional, defaults to `50`

`SUPABASE_DB_URL` should be a direct Postgres connection string. Bulk historical imports should not go through the Supabase REST API.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Commands

### Sync the curated symbol manifest

```bash
python -m history_batch.cli sync-symbol-master --manifest ./config/curated_symbols.example.csv
```

Expected manifest columns:

- `symbol`
- `name`
- `exchange`
- `instrument_type`
- `country`
- `is_active`
- `curated_rank`

### Import a CSV backfill

```bash
python -m history_batch.cli import-history-csv --csv ./data/history.csv
```

Expected CSV columns:

- `symbol`
- `trading_date`
- `adjusted_close`
- `volume`

The importer requires every symbol to exist in `symbol_master` first. That is intentional: the dimension table remains the source of truth for symbol identity.

### Append the latest history with yfinance

```bash
python -m history_batch.cli append-latest --period 3mo
```

This pulls history only for curated, active symbols and upserts by `(symbol_id, trading_date)`.

### Run the monthly reconcile job

```bash
python -m history_batch.cli monthly-reconcile --manifest ./config/curated_symbols.example.csv --period 3mo
```

This command:

1. refreshes the curated symbol manifest
2. appends a recent correction window from `yfinance`
3. records the combined run in `historical_job_runs`

## Operational notes

- The chart feature reads from `daily_price_history`, not from `quotes_history`.
- Monthly reconcile is a batch maintenance job, not a replacement for the live quote worker.
- For large one-time imports, preload the curated symbol manifest, then import CSV history in chunks.
