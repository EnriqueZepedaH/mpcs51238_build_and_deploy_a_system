from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yfinance as yf
from psycopg import Connection

from .config import Settings
from .db import chunked


@dataclass(frozen=True)
class SymbolManifestRow:
    symbol: str
    name: str | None
    exchange: str | None
    instrument_type: str | None
    country: str | None
    is_active: bool
    curated_rank: int | None


@dataclass(frozen=True)
class DailyHistoryCsvRow:
    symbol: str
    trading_date: date
    adjusted_close: float
    volume: int | None


@dataclass(frozen=True)
class JobStats:
    symbols_considered: int = 0
    rows_inserted: int = 0
    rows_updated: int = 0
    rows_deleted: int = 0
    error_count: int = 0
    error_details: tuple[dict[str, Any], ...] = ()


def sync_symbol_master(
    connection: Connection[Any], manifest_path: Path, settings: Settings
) -> JobStats:
    manifest_rows = load_symbol_manifest(manifest_path)

    with connection.cursor() as cursor:
        for batch in chunked(manifest_rows, settings.chunk_size):
            payload = [
                (
                    row.symbol,
                    row.name,
                    row.exchange,
                    row.instrument_type,
                    row.country,
                    row.is_active,
                    True,
                    row.curated_rank,
                    datetime.utcnow(),
                    "curated_manifest",
                    "active" if row.is_active else "inactive",
                    {
                        "symbol": row.symbol,
                        "name": row.name,
                        "exchange": row.exchange,
                        "instrument_type": row.instrument_type,
                        "country": row.country,
                        "is_active": row.is_active,
                        "curated_rank": row.curated_rank,
                    },
                )
                for row in batch
            ]
            cursor.executemany(
                """
                insert into public.symbol_master (
                  symbol,
                  name,
                  exchange,
                  instrument_type,
                  country,
                  is_active,
                  is_curated,
                  curated_rank,
                  last_refreshed_at,
                  source,
                  source_status,
                  raw_payload
                )
                values (
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
                )
                on conflict (symbol) do update
                set name = excluded.name,
                    exchange = excluded.exchange,
                    instrument_type = excluded.instrument_type,
                    country = excluded.country,
                    is_active = excluded.is_active,
                    is_curated = excluded.is_curated,
                    curated_rank = excluded.curated_rank,
                    last_refreshed_at = excluded.last_refreshed_at,
                    source = excluded.source,
                    source_status = excluded.source_status,
                    raw_payload = excluded.raw_payload
                """,
                payload,
            )

    connection.commit()
    return JobStats(symbols_considered=len(manifest_rows), rows_updated=len(manifest_rows))


def import_history_csv(
    connection: Connection[Any], csv_path: Path, settings: Settings
) -> JobStats:
    symbol_id_by_symbol = load_symbol_ids(connection)
    rows = load_history_csv(csv_path)
    payload: list[tuple[Any, ...]] = []
    missing_symbols: list[str] = []

    for row in rows:
        symbol_id = symbol_id_by_symbol.get(row.symbol)
        if symbol_id is None:
            missing_symbols.append(row.symbol)
            continue

        payload.append((symbol_id, row.trading_date, row.adjusted_close, row.volume))

    if missing_symbols:
        unique_missing = sorted(set(missing_symbols))
        raise RuntimeError(
            "CSV contains symbols missing from symbol_master: "
            + ", ".join(unique_missing[:10])
            + ("..." if len(unique_missing) > 10 else "")
        )

    inserted_rows = 0
    with connection.cursor() as cursor:
        for batch in chunked(payload, settings.chunk_size):
            cursor.executemany(
                """
                insert into public.daily_price_history (
                  symbol_id,
                  trading_date,
                  adjusted_close,
                  volume
                )
                values (%s, %s, %s, %s)
                on conflict (symbol_id, trading_date) do update
                set adjusted_close = excluded.adjusted_close,
                    volume = excluded.volume
                """,
                batch,
            )
            inserted_rows += len(batch)

    connection.commit()
    return JobStats(
        symbols_considered=len({row.symbol for row in rows}),
        rows_updated=inserted_rows,
    )


def append_latest_history(
    connection: Connection[Any], settings: Settings, period: str
) -> JobStats:
    symbols = load_curated_symbols(connection)
    if not symbols:
        return JobStats()

    symbol_id_by_symbol = load_symbol_ids(connection)
    rows_written = 0
    error_details: list[dict[str, Any]] = []

    for batch in chunked(symbols, settings.yfinance_group_size):
        download_symbol_by_symbol = {
            symbol: to_yfinance_symbol(symbol)
            for symbol in batch
        }
        tickers = " ".join(download_symbol_by_symbol.values())
        try:
            history = yf.download(
                tickers=tickers,
                period=period,
                interval="1d",
                auto_adjust=False,
                actions=False,
                progress=False,
                group_by="ticker",
                threads=False,
            )
        except Exception as error:  # pragma: no cover - third-party runtime path
            error_details.append({"tickers": batch, "message": str(error)})
            continue

        rows_to_upsert = flatten_yfinance_history(
            history, batch, symbol_id_by_symbol, download_symbol_by_symbol
        )
        rows_written += upsert_history_rows(connection, rows_to_upsert, settings.chunk_size)

    return JobStats(
        symbols_considered=len(symbols),
        rows_updated=rows_written,
        error_count=len(error_details),
        error_details=tuple(error_details),
    )


def load_symbol_manifest(path: Path) -> list[SymbolManifestRow]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for raw_row in reader:
            symbol = normalize_symbol(raw_row.get("symbol", ""))
            if not symbol:
                continue

            rows.append(
                SymbolManifestRow(
                    symbol=symbol,
                    name=empty_to_none(raw_row.get("name")),
                    exchange=empty_to_none(raw_row.get("exchange")),
                    instrument_type=empty_to_none(raw_row.get("instrument_type")),
                    country=empty_to_none(raw_row.get("country")),
                    is_active=parse_bool(raw_row.get("is_active"), default=True),
                    curated_rank=parse_int(raw_row.get("curated_rank")),
                )
            )

        return rows


def load_history_csv(path: Path) -> list[DailyHistoryCsvRow]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for raw_row in reader:
            symbol = normalize_symbol(raw_row.get("symbol", ""))
            trading_date = raw_row.get("trading_date", "").strip()
            adjusted_close = raw_row.get("adjusted_close", "").strip()

            if not symbol or not trading_date or not adjusted_close:
                continue

            rows.append(
                DailyHistoryCsvRow(
                    symbol=symbol,
                    trading_date=date.fromisoformat(trading_date),
                    adjusted_close=float(adjusted_close),
                    volume=parse_int(raw_row.get("volume")),
                )
            )

        return rows


def load_symbol_ids(connection: Connection[Any]) -> dict[str, int]:
    with connection.cursor() as cursor:
        cursor.execute("select id, symbol from public.symbol_master")
        rows = cursor.fetchall()

    return {row["symbol"]: row["id"] for row in rows}


def load_curated_symbols(connection: Connection[Any]) -> list[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select symbol
            from public.symbol_master
            where is_curated = true
              and is_active = true
            order by curated_rank nulls last, symbol
            """
        )
        rows = cursor.fetchall()

    return [row["symbol"] for row in rows]


def flatten_yfinance_history(
    history: Any,
    symbols: list[str],
    symbol_id_by_symbol: dict[str, int],
    download_symbol_by_symbol: dict[str, str],
) -> list[tuple[int, date, float, int | None]]:
    rows: list[tuple[int, date, float, int | None]] = []

    if getattr(history, "empty", True):
        return rows

    multi_symbol = len(symbols) > 1

    for symbol in symbols:
        symbol_id = symbol_id_by_symbol.get(symbol)
        if symbol_id is None:
            continue
        download_symbol = download_symbol_by_symbol[symbol]

        if multi_symbol:
            symbol_frame = history.get(download_symbol)
        else:
            symbol_frame = history

        if symbol_frame is None or getattr(symbol_frame, "empty", True):
            continue

        for trading_day, values in symbol_frame.iterrows():
            adjusted_close = coerce_float(values.get("Adj Close"))
            if adjusted_close is None:
                continue

            volume = coerce_int(values.get("Volume"))
            rows.append(
                (
                    symbol_id,
                    trading_day.date(),
                    adjusted_close,
                    volume,
                )
            )

    return rows


def upsert_history_rows(
    connection: Connection[Any],
    rows_to_upsert: list[tuple[int, date, float, int | None]],
    chunk_size: int,
) -> int:
    if not rows_to_upsert:
        return 0

    rows_written = 0
    with connection.cursor() as cursor:
        for batch in chunked(rows_to_upsert, chunk_size):
            cursor.executemany(
                """
                insert into public.daily_price_history (
                  symbol_id,
                  trading_date,
                  adjusted_close,
                  volume
                )
                values (%s, %s, %s, %s)
                on conflict (symbol_id, trading_date) do update
                set adjusted_close = excluded.adjusted_close,
                    volume = excluded.volume
                """,
                batch,
            )
            rows_written += len(batch)

    connection.commit()
    return rows_written


def to_yfinance_symbol(symbol: str) -> str:
    return symbol.replace(".", "-")


def coerce_float(value: Any) -> float | None:
    if value is None:
        return None

    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    if math.isnan(numeric):
        return None

    return numeric


def coerce_int(value: Any) -> int | None:
    numeric = coerce_float(value)
    if numeric is None:
        return None

    return int(numeric)


def normalize_symbol(value: str) -> str:
    return value.strip().upper()


def empty_to_none(value: str | None) -> str | None:
    if value is None:
        return None

    stripped = value.strip()
    return stripped or None


def parse_bool(value: str | None, default: bool) -> bool:
    if value is None or value.strip() == "":
        return default

    return value.strip().lower() in {"1", "true", "yes", "y"}


def parse_int(value: str | None, default: int | None = None) -> int | None:
    if value is None or value.strip() == "":
        return default

    return int(value)
