# ADR 0003: Priority-based shared polling

## Decision

The worker polls the global union of tracked symbols and ranks them by watcher demand and staleness.

## Why

- avoids the anti-pattern of per-user polling
- keeps the system within free-tier limits
- makes freshness a system-level optimization problem instead of a UI concern

## Tradeoff

Low-demand symbols can become stale under load. The app surfaces this instead of hiding it.

