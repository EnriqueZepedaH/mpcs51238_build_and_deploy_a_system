import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { WorkerEnv } from "../env";
import type { NormalizedQuote } from "./normalize";
import type { SymbolDemand } from "./scheduler";

type DbClient = SupabaseClient;

export function createSupabaseAdmin(env: WorkerEnv): DbClient {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function loadSymbolDemand(client: DbClient): Promise<SymbolDemand[]> {
  const [{ data: watchlistRows, error: watchlistError }, { data: currentRows, error: currentError }] =
    await Promise.all([
      client.from("user_watchlists").select("symbol"),
      client.from("quotes_current").select("symbol,last_ingested_at")
    ]);

  if (watchlistError) {
    throw watchlistError;
  }

  if (currentError) {
    throw currentError;
  }

  const lastSeenBySymbol = new Map<string, string | null>();
  for (const row of currentRows ?? []) {
    lastSeenBySymbol.set(row.symbol, row.last_ingested_at);
  }

  const demandBySymbol = new Map<string, number>();
  for (const row of watchlistRows ?? []) {
    demandBySymbol.set(row.symbol, (demandBySymbol.get(row.symbol) ?? 0) + 1);
  }

  return [...demandBySymbol.entries()].map(([symbol, watcherCount]) => ({
    symbol,
    watcherCount,
    lastIngestedAt: lastSeenBySymbol.get(symbol) ?? null
  }));
}

export async function createIngestionRun(client: DbClient) {
  const { data, error } = await client
    .from("ingestion_runs")
    .insert({ status: "running" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function finalizeIngestionRun(
  client: DbClient,
  runId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await client
    .from("ingestion_runs")
    .update({
      ...payload,
      completed_at: new Date().toISOString()
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
}

export async function persistQuotes(
  client: DbClient,
  quotes: NormalizedQuote[],
  watcherCounts: Map<string, number>
): Promise<number> {
  if (quotes.length === 0) {
    return 0;
  }

  const ingestedAt = new Date().toISOString();

  const currentRows = quotes.map((quote) => ({
    symbol: quote.symbol,
    name: quote.name,
    exchange: quote.exchange,
    currency: quote.currency,
    instrument_type: quote.instrument_type,
    is_market_open: quote.is_market_open,
    price: quote.price,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    previous_close: quote.previous_close,
    absolute_change: quote.absolute_change,
    percent_change: quote.percent_change,
    volume: quote.volume,
    watcher_count: watcherCounts.get(quote.symbol) ?? 0,
    source: "twelve_data",
    source_timestamp: quote.source_timestamp,
    last_ingested_at: ingestedAt,
    raw_payload: quote.raw_payload
  }));

  const historyRows = quotes.map((quote) => ({
    symbol: quote.symbol,
    as_of: quote.source_timestamp ?? ingestedAt,
    price: quote.price,
    percent_change: quote.percent_change,
    volume: quote.volume,
    source: "twelve_data",
    ingested_at: ingestedAt,
    raw_payload: quote.raw_payload
  }));

  const [{ error: currentError }, { error: historyError }] = await Promise.all([
    client.from("quotes_current").upsert(currentRows, { onConflict: "symbol" }),
    client.from("quotes_history").upsert(historyRows, { onConflict: "symbol,as_of" })
  ]);

  if (currentError) {
    throw currentError;
  }

  if (historyError) {
    throw historyError;
  }

  return currentRows.length + historyRows.length;
}

export async function computeStaleSymbolCount(
  client: DbClient,
  freshnessTargetSeconds: number,
  now = Date.now()
): Promise<{ staleSymbols: number; maxQuoteAgeSeconds: number | null }> {
  const { data, error } = await client.from("quotes_current").select("symbol,last_ingested_at");

  if (error) {
    throw error;
  }

  let staleSymbols = 0;
  let maxQuoteAgeSeconds: number | null = null;

  for (const row of data ?? []) {
    const ageSeconds = Math.max(
      0,
      Math.floor((now - new Date(row.last_ingested_at).getTime()) / 1000)
    );

    if (ageSeconds > freshnessTargetSeconds) {
      staleSymbols += 1;
    }

    maxQuoteAgeSeconds = maxQuoteAgeSeconds == null ? ageSeconds : Math.max(maxQuoteAgeSeconds, ageSeconds);
  }

  return { staleSymbols, maxQuoteAgeSeconds };
}
