# ADR 0004: Separate serving and history tables

## Decision

Store the latest quote in `quotes_current` and minute snapshots in `quotes_history`.

## Why

- the frontend needs a fast serving table
- the portfolio needs a time-series history story
- separating mutable and append-only data keeps the write path simpler

## Tradeoff

This duplicates some data and increases storage cost. For this project, the clarity of the model is worth more than strict storage efficiency.

