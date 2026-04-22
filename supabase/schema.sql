create extension if not exists pgcrypto;

create table if not exists public.user_watchlists (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  symbol text not null check (symbol = upper(symbol)),
  created_at timestamptz not null default now(),
  unique (clerk_user_id, symbol)
);

create table if not exists public.quotes_current (
  symbol text primary key,
  name text,
  exchange text,
  currency text,
  instrument_type text,
  is_market_open boolean,
  price numeric(18,6) not null,
  open numeric(18,6),
  high numeric(18,6),
  low numeric(18,6),
  previous_close numeric(18,6),
  absolute_change numeric(18,6),
  percent_change numeric(10,4),
  volume bigint,
  watcher_count integer not null default 0,
  source text not null default 'twelve_data',
  source_timestamp timestamptz,
  last_ingested_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb
);

create table if not exists public.quotes_history (
  id bigint generated always as identity primary key,
  symbol text not null references public.quotes_current(symbol) on delete cascade,
  as_of timestamptz not null,
  price numeric(18,6) not null,
  percent_change numeric(10,4),
  volume bigint,
  source text not null default 'twelve_data',
  ingested_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  unique (symbol, as_of)
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'success', 'partial', 'error')),
  symbols_considered integer not null default 0,
  symbols_polled integer not null default 0,
  rows_written integer not null default 0,
  api_credits_used integer not null default 0,
  stale_symbols integer not null default 0,
  max_quote_age_seconds integer,
  error_count integer not null default 0,
  error_details jsonb not null default '[]'::jsonb
);

create or replace view public.symbol_watchlist_rollup
with (security_invoker = true) as
select
  symbol,
  count(*)::int as watcher_count
from public.user_watchlists
group by symbol;

alter table public.user_watchlists enable row level security;
alter table public.quotes_current enable row level security;
alter table public.quotes_history enable row level security;
alter table public.ingestion_runs enable row level security;

drop policy if exists "watchlist_select_own" on public.user_watchlists;
create policy "watchlist_select_own"
on public.user_watchlists
for select
using ((((select auth.jwt()) ->> 'sub')) = clerk_user_id);

drop policy if exists "watchlist_insert_own" on public.user_watchlists;
create policy "watchlist_insert_own"
on public.user_watchlists
for insert
with check ((((select auth.jwt()) ->> 'sub')) = clerk_user_id);

drop policy if exists "watchlist_delete_own" on public.user_watchlists;
create policy "watchlist_delete_own"
on public.user_watchlists
for delete
using ((((select auth.jwt()) ->> 'sub')) = clerk_user_id);

drop policy if exists "quotes_public_read" on public.quotes_current;
create policy "quotes_public_read"
on public.quotes_current
for select
using (true);

drop policy if exists "history_public_read" on public.quotes_history;
create policy "history_public_read"
on public.quotes_history
for select
using (true);

drop policy if exists "runs_public_read" on public.ingestion_runs;
create policy "runs_public_read"
on public.ingestion_runs
for select
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel rel
    join pg_publication pub on pub.oid = rel.prpubid
    join pg_class cls on cls.oid = rel.prrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where pub.pubname = 'supabase_realtime'
      and ns.nspname = 'public'
      and cls.relname = 'quotes_current'
  ) then
    alter publication supabase_realtime add table public.quotes_current;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel rel
    join pg_publication pub on pub.oid = rel.prpubid
    join pg_class cls on cls.oid = rel.prrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where pub.pubname = 'supabase_realtime'
      and ns.nspname = 'public'
      and cls.relname = 'quotes_history'
  ) then
    alter publication supabase_realtime add table public.quotes_history;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel rel
    join pg_publication pub on pub.oid = rel.prpubid
    join pg_class cls on cls.oid = rel.prrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where pub.pubname = 'supabase_realtime'
      and ns.nspname = 'public'
      and cls.relname = 'ingestion_runs'
  ) then
    alter publication supabase_realtime add table public.ingestion_runs;
  end if;
end
$$;

create index if not exists user_watchlists_symbol_idx on public.user_watchlists(symbol);
create index if not exists quotes_history_symbol_as_of_idx on public.quotes_history(symbol, as_of desc);
create index if not exists ingestion_runs_started_at_idx on public.ingestion_runs(started_at desc);
