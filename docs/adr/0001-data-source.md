# ADR 0001: Twelve Data as the external source

## Decision

Use Twelve Data for US equities and ETF quote ingestion.

## Why

- free tier is sufficient for a class-sized watchlist system when the worker polls a shared symbol pool instead of polling per user
- the API supports batch requests, which reduces request overhead
- the domain is personally useful and portfolio-relevant

## Tradeoff

The free tier is intentionally tight. That forces a scheduler design and visible degradation states, which is good for data engineering storytelling but means the app cannot guarantee sub-minute freshness for every symbol.

