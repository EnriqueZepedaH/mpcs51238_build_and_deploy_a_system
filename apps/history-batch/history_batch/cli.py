from __future__ import annotations

import argparse
from pathlib import Path
from typing import Callable

from .config import load_settings
from .db import db_connection, finish_job_run, mark_job_error, start_job_run
from .jobs import JobStats, append_latest_history, import_history_csv, sync_symbol_master


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="history-batch",
        description="Batch jobs for curated symbols and long-range daily price history.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    sync_parser = subparsers.add_parser(
        "sync-symbol-master",
        help="Upsert the curated symbol manifest into public.symbol_master.",
    )
    sync_parser.add_argument("--manifest", required=True, type=Path)

    import_parser = subparsers.add_parser(
        "import-history-csv",
        help="Bulk-import daily history rows from a CSV file.",
    )
    import_parser.add_argument("--csv", required=True, type=Path)

    append_parser = subparsers.add_parser(
        "append-latest",
        help="Append or refresh a recent history window from yfinance.",
    )
    append_parser.add_argument("--period", default="3mo")

    backfill_parser = subparsers.add_parser(
        "backfill-history",
        help="Backfill the full available daily adjusted-close history from yfinance.",
    )
    backfill_parser.add_argument("--period", default="max")

    reconcile_parser = subparsers.add_parser(
        "monthly-reconcile",
        help="Refresh the curated symbol manifest and pull a recent correction window.",
    )
    reconcile_parser.add_argument("--manifest", required=True, type=Path)
    reconcile_parser.add_argument("--period", default="3mo")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    settings = load_settings()

    with db_connection(settings) as connection:
        if args.command == "sync-symbol-master":
            run_job(
                connection=connection,
                job_type="symbol_master_sync",
                runner=lambda: sync_symbol_master(connection, args.manifest, settings),
            )
        elif args.command == "import-history-csv":
            run_job(
                connection=connection,
                job_type="history_csv_import",
                runner=lambda: import_history_csv(connection, args.csv, settings),
            )
        elif args.command == "append-latest":
            run_job(
                connection=connection,
                job_type="history_append_latest",
                runner=lambda: append_latest_history(connection, settings, args.period),
            )
        elif args.command == "backfill-history":
            run_job(
                connection=connection,
                job_type="history_backfill_full",
                runner=lambda: append_latest_history(connection, settings, args.period),
            )
        elif args.command == "monthly-reconcile":
            run_job(
                connection=connection,
                job_type="history_monthly_reconcile",
                runner=lambda: run_monthly_reconcile(connection, settings, args.manifest, args.period),
            )
        else:  # pragma: no cover - argparse guards this
            parser.error(f"Unsupported command: {args.command}")


def run_job(
    *,
    connection,
    job_type: str,
    runner: Callable[[], JobStats],
) -> None:
    job_run = start_job_run(connection, job_type)

    try:
        stats = runner()
    except Exception as error:
        connection.rollback()
        mark_job_error(connection, job_run, str(error))
        raise

    finish_job_run(
        connection,
        job_run,
        status="partial" if stats.error_count > 0 else "success",
        symbols_considered=stats.symbols_considered,
        rows_inserted=stats.rows_inserted,
        rows_updated=stats.rows_updated,
        rows_deleted=stats.rows_deleted,
        error_count=stats.error_count,
        error_details=stats.error_details,
    )


def run_monthly_reconcile(connection, settings, manifest: Path, period: str) -> JobStats:
    sync_stats = sync_symbol_master(connection, manifest, settings)
    append_stats = append_latest_history(connection, settings, period)

    return JobStats(
        symbols_considered=max(sync_stats.symbols_considered, append_stats.symbols_considered),
        rows_inserted=sync_stats.rows_inserted + append_stats.rows_inserted,
        rows_updated=sync_stats.rows_updated + append_stats.rows_updated,
        rows_deleted=sync_stats.rows_deleted + append_stats.rows_deleted,
        error_count=sync_stats.error_count + append_stats.error_count,
        error_details=sync_stats.error_details + append_stats.error_details,
    )


if __name__ == "__main__":
    main()
