export type FreshnessStatus = "fresh" | "degraded" | "stale";

export type QuoteRecord = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  instrument_type: string | null;
  is_market_open: boolean | null;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previous_close: number | null;
  absolute_change: number | null;
  percent_change: number | null;
  volume: number | null;
  watcher_count: number;
  source: string;
  source_timestamp: string | null;
  last_ingested_at: string;
};

export type IngestionRunRecord = {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "success" | "partial" | "error";
  symbols_considered: number;
  symbols_polled: number;
  rows_written: number;
  api_credits_used: number;
  stale_symbols: number;
  max_quote_age_seconds: number | null;
  error_count: number;
  error_details: unknown[];
};

export type WatchlistItem = {
  id: string;
  clerk_user_id: string;
  symbol: string;
  created_at: string;
};

export const MAX_DEGRADED_MULTIPLIER = 3;

export function getFreshnessStatus(
  lastIngestedAt: string | null | undefined,
  freshnessTargetSeconds: number,
  now = Date.now()
): FreshnessStatus {
  if (!lastIngestedAt) {
    return "stale";
  }

  const ageSeconds = Math.max(
    0,
    Math.floor((now - new Date(lastIngestedAt).getTime()) / 1000)
  );

  if (ageSeconds <= freshnessTargetSeconds) {
    return "fresh";
  }

  if (ageSeconds <= freshnessTargetSeconds * MAX_DEGRADED_MULTIPLIER) {
    return "degraded";
  }

  return "stale";
}

export function getQuoteAgeSeconds(
  lastIngestedAt: string | null | undefined,
  now = Date.now()
): number | null {
  if (!lastIngestedAt) {
    return null;
  }

  return Math.max(0, Math.floor((now - new Date(lastIngestedAt).getTime()) / 1000));
}

