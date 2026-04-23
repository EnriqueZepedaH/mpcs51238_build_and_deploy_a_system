from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, raw_value = stripped.split("=", 1)
        key = key.strip()
        value = raw_value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


def get_required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")

    return value


def get_int_env(name: str, default: int) -> int:
    value = os.environ.get(name)
    if not value:
        return default

    return int(value)


def normalize_postgres_url(raw_url: str) -> str:
    parsed = urlsplit(raw_url)

    if parsed.scheme not in {"postgres", "postgresql"}:
        return raw_url

    try:
        if parsed.hostname is not None and parsed.port is not None:
            return raw_url
    except ValueError:
        pass

    scheme, remainder = raw_url.split("://", 1)
    credentials, host_and_path = remainder.rsplit("@", 1)
    username, password = credentials.split(":", 1)

    if "/" in host_and_path:
        host_port, path_and_query = host_and_path.split("/", 1)
        path_and_query = "/" + path_and_query
    else:
        host_port = host_and_path
        path_and_query = ""

    safe_username = quote(username, safe="")
    safe_password = quote(password, safe="")

    rebuilt = f"{scheme}://{safe_username}:{safe_password}@{host_port}{path_and_query}"
    reparsed = urlsplit(rebuilt)

    if reparsed.hostname is None or reparsed.port is None:
        raise RuntimeError(
            "SUPABASE_DB_URL could not be normalized into a valid Postgres URI."
        )

    return urlunsplit(reparsed)


@dataclass(frozen=True)
class Settings:
    supabase_db_url: str
    chunk_size: int
    yfinance_group_size: int


def load_settings() -> Settings:
    load_env_file(Path.cwd() / ".env.local")

    return Settings(
        supabase_db_url=normalize_postgres_url(get_required_env("SUPABASE_DB_URL")),
        chunk_size=get_int_env("HISTORY_BATCH_CHUNK_SIZE", 1000),
        yfinance_group_size=get_int_env("YFINANCE_GROUP_SIZE", 50),
    )
