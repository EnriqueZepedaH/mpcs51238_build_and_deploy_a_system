from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Iterator, Sequence, TypeVar
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from .config import Settings


@dataclass(frozen=True)
class JobRunContext:
    id: UUID
    job_type: str


@contextmanager
def db_connection(settings: Settings) -> Iterator[psycopg.Connection[Any]]:
    connection = psycopg.connect(settings.supabase_db_url, row_factory=dict_row)
    try:
        yield connection
    finally:
        connection.close()


T = TypeVar("T")


def chunked(items: Sequence[T], size: int) -> Iterator[Sequence[T]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def start_job_run(connection: psycopg.Connection[Any], job_type: str) -> JobRunContext:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            insert into public.historical_job_runs (job_type, status)
            values (%s, 'running')
            returning id
            """,
            (job_type,),
        )
        row = cursor.fetchone()

    if row is None:
        raise RuntimeError("Failed to create historical job run row.")

    connection.commit()
    return JobRunContext(id=row["id"], job_type=job_type)


def finish_job_run(
    connection: psycopg.Connection[Any],
    job_run: JobRunContext,
    *,
    status: str,
    symbols_considered: int,
    rows_inserted: int,
    rows_updated: int,
    rows_deleted: int,
    error_count: int,
    error_details: Iterable[dict[str, Any]],
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            update public.historical_job_runs
            set completed_at = %s,
                status = %s,
                symbols_considered = %s,
                rows_inserted = %s,
                rows_updated = %s,
                rows_deleted = %s,
                error_count = %s,
                error_details = %s::jsonb
            where id = %s
            """,
            (
                datetime.now(timezone.utc),
                status,
                symbols_considered,
                rows_inserted,
                rows_updated,
                rows_deleted,
                error_count,
                Json(list(error_details)),
                job_run.id,
            ),
        )

    connection.commit()


def mark_job_error(
    connection: psycopg.Connection[Any], job_run: JobRunContext, message: str
) -> None:
    finish_job_run(
        connection,
        job_run,
        status="error",
        symbols_considered=0,
        rows_inserted=0,
        rows_updated=0,
        rows_deleted=0,
        error_count=1,
        error_details=[{"message": message}],
    )
