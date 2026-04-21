# ADR 0002: Clerk for identity, Supabase for storage

## Decision

Use Clerk for user authentication and Supabase for data storage with RLS on personalization tables.

## Why

- Clerk gives a strong user-facing auth experience
- Supabase remains the system of record for personalization and quote data
- only watchlist rows are sensitive; market data itself can be broadly readable

## Tradeoff

This is more integration work than using Supabase Auth alone. The cost is justified because the course explicitly allows Clerk and the app benefits from a polished auth flow.

