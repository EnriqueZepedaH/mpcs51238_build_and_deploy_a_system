export type SymbolMasterRecord = {
  id: number;
  symbol: string;
  name: string | null;
  exchange: string | null;
  instrument_type: string | null;
  country: string | null;
  is_active: boolean;
  is_curated: boolean;
  curated_rank: number | null;
  last_refreshed_at: string | null;
  source: string;
  source_status: string | null;
};

export type DailyPriceHistoryRow = {
  symbol_id: number;
  trading_date: string;
  adjusted_close: number;
  volume: number | null;
};

export type HistoricalPerformancePoint = {
  trading_date: string;
  adjusted_close: number;
  volume: number | null;
  price_delta: number;
  percent_return: number;
};

export type HistoricalSeriesStatus = "ready" | "empty" | "unavailable";

export type HistoricalSeriesResponse = {
  symbol: string;
  symbolName: string | null;
  firstAvailableDate: string | null;
  lastAvailableDate: string | null;
  requestedReferenceDate: string | null;
  effectiveReferenceDate: string | null;
  clampedToAvailableHistory: boolean;
  status: HistoricalSeriesStatus;
  message: string | null;
  points: HistoricalPerformancePoint[];
};

export function buildHistoricalPerformancePoints(
  rows: Pick<DailyPriceHistoryRow, "trading_date" | "adjusted_close" | "volume">[],
  referenceAdjustedClose: number
): HistoricalPerformancePoint[] {
  return rows.map((row) => ({
    trading_date: row.trading_date,
    adjusted_close: row.adjusted_close,
    volume: row.volume,
    price_delta: row.adjusted_close - referenceAdjustedClose,
    percent_return:
      referenceAdjustedClose === 0
        ? 0
        : ((row.adjusted_close - referenceAdjustedClose) / referenceAdjustedClose) * 100
  }));
}
