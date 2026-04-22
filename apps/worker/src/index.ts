import { getWorkerEnv } from "./env.js";
import { log } from "./logger.js";
import {
  computeStaleSymbolCount,
  createIngestionRun,
  createSupabaseAdmin,
  finalizeIngestionRun,
  loadSymbolDemand,
  persistQuotes
} from "./lib/supabase.js";
import { rankSymbolsForPolling } from "./lib/scheduler.js";
import { TwelveDataClient } from "./lib/twelve-data.js";

async function runWorkerCycle(): Promise<void> {
  const env = getWorkerEnv();
  const supabase = createSupabaseAdmin(env);
  const twelveData = new TwelveDataClient({
    apiKey: env.TWELVE_DATA_API_KEY,
    baseUrl: env.TWELVE_DATA_BASE_URL
  });

  const startedAt = Date.now();
  const run = await createIngestionRun(supabase);
  const errors: string[] = [];

  try {
    const demand = await loadSymbolDemand(supabase);
    const selectedSymbols = rankSymbolsForPolling(demand, env.MAX_SYMBOLS_PER_RUN);
    const watcherCounts = new Map(demand.map((row) => [row.symbol, row.watcherCount]));
    const quotes = await twelveData.fetchQuotes(selectedSymbols.map((row) => row.symbol));
    const rowsWritten = await persistQuotes(supabase, quotes, watcherCounts);
    const freshness = await computeStaleSymbolCount(supabase, env.FRESHNESS_TARGET_SECONDS);

    await finalizeIngestionRun(supabase, run.id, {
      status: errors.length > 0 ? "partial" : "success",
      symbols_considered: demand.length,
      symbols_polled: selectedSymbols.length,
      rows_written: rowsWritten,
      api_credits_used: selectedSymbols.length,
      stale_symbols: freshness.staleSymbols,
      max_quote_age_seconds: freshness.maxQuoteAgeSeconds,
      error_count: errors.length,
      error_details: errors
    });

    log("INFO", "worker cycle completed", {
      durationMs: Date.now() - startedAt,
      symbolsConsidered: demand.length,
      symbolsPolled: selectedSymbols.length,
      rowsWritten
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    errors.push(message);

    await finalizeIngestionRun(supabase, run.id, {
      status: "error",
      symbols_considered: 0,
      symbols_polled: 0,
      rows_written: 0,
      api_credits_used: 0,
      stale_symbols: 0,
      max_quote_age_seconds: null,
      error_count: errors.length,
      error_details: errors
    });

    log("ERROR", "worker cycle failed", {
      durationMs: Date.now() - startedAt,
      error: message
    });
  }
}

async function main(): Promise<void> {
  const env = getWorkerEnv();

  log("INFO", "worker booted", {
    pollIntervalMs: env.POLL_INTERVAL_MS,
    maxSymbolsPerRun: env.MAX_SYMBOLS_PER_RUN
  });

  await runWorkerCycle();

  setInterval(() => {
    void runWorkerCycle();
  }, env.POLL_INTERVAL_MS);
}

void main();
