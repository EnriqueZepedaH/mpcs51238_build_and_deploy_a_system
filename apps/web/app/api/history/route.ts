import { auth } from "@clerk/nextjs/server";
import {
  buildHistoricalPerformancePoints,
  type DailyPriceHistoryRow,
  type HistoricalSeriesResponse,
  type SymbolMasterRecord,
  isLikelyUsEquityOrEtfSymbol,
  normalizeSymbol
} from "@market-pulse/shared";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const querySchema = z.object({
  symbol: z
    .string()
    .transform(normalizeSymbol)
    .refine((value) => isLikelyUsEquityOrEtfSymbol(value), {
      message: "Use a likely US stock or ETF ticker format"
    }),
  referenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    symbol: url.searchParams.get("symbol") ?? "",
    referenceDate: url.searchParams.get("referenceDate") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServerClient();
  const { symbol, referenceDate } = parsed.data;

  const { data: watchlistItem, error: watchlistError } = await supabase
    .from("user_watchlists")
    .select("symbol")
    .eq("symbol", symbol)
    .maybeSingle();

  if (watchlistError) {
    return NextResponse.json({ error: watchlistError.message }, { status: 500 });
  }

  if (!watchlistItem) {
    return NextResponse.json({ error: "Symbol is not in your watchlist" }, { status: 404 });
  }

  try {
    const { data: symbolMaster, error: symbolError } = await supabase
      .from("symbol_master")
      .select("*")
      .eq("symbol", symbol)
      .maybeSingle();

    if (symbolError) {
      throw symbolError;
    }

    if (!symbolMaster) {
      return NextResponse.json(
        buildUnavailableHistoryResponse(
          symbol,
          "Historical backfill has not been loaded for this symbol yet."
        )
      );
    }

    const typedSymbolMaster = symbolMaster as SymbolMasterRecord;

    const [{ data: firstRow, error: firstError }, { data: lastRow, error: lastError }] =
      await Promise.all([
        supabase
          .from("daily_price_history")
          .select("symbol_id,trading_date,adjusted_close,volume")
          .eq("symbol_id", typedSymbolMaster.id)
          .order("trading_date", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("daily_price_history")
          .select("symbol_id,trading_date,adjusted_close,volume")
          .eq("symbol_id", typedSymbolMaster.id)
          .order("trading_date", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

    if (firstError) {
      throw firstError;
    }

    if (lastError) {
      throw lastError;
    }

    if (!firstRow || !lastRow) {
      return NextResponse.json(
        buildUnavailableHistoryResponse(
          symbol,
          "Historical backfill is scheduled, but no daily price rows are available yet."
        )
      );
    }

    const typedFirstRow = coerceHistoryRow(firstRow);
    const typedLastRow = coerceHistoryRow(lastRow);
    const firstAvailableDate = typedFirstRow.trading_date;
    const lastAvailableDate = typedLastRow.trading_date;
    const clampedToAvailableHistory =
      referenceDate != null && referenceDate < firstAvailableDate;
    const effectiveReferenceDate =
      referenceDate == null || referenceDate < firstAvailableDate
        ? firstAvailableDate
        : referenceDate;

    const { data: rows, error: rowsError } = await supabase
      .from("daily_price_history")
      .select("symbol_id,trading_date,adjusted_close,volume")
      .eq("symbol_id", typedSymbolMaster.id)
      .gte("trading_date", effectiveReferenceDate)
      .order("trading_date", { ascending: true });

    if (rowsError) {
      throw rowsError;
    }

    const typedRows = (rows ?? []).map(coerceHistoryRow);
    const referenceRow = typedRows[0];

    if (!referenceRow) {
      return NextResponse.json(
        buildUnavailableHistoryResponse(
          symbol,
          "No historical rows are available from the selected reference date onward."
        )
      );
    }

    const points = buildHistoricalPerformancePoints(
      typedRows.map((row) => ({
        trading_date: row.trading_date,
        adjusted_close: row.adjusted_close,
        volume: row.volume
      })),
      referenceRow.adjusted_close
    );

    const response: HistoricalSeriesResponse = {
      symbol,
      symbolName: typedSymbolMaster.name,
      firstAvailableDate,
      lastAvailableDate,
      requestedReferenceDate: referenceDate ?? null,
      effectiveReferenceDate,
      clampedToAvailableHistory,
      status: "ready",
      message: clampedToAvailableHistory
        ? `History starts on ${firstAvailableDate}, so the chart begins from the first available stored date.`
        : null,
      points
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Historical data query failed unexpectedly.";

    if (message.includes("symbol_master") || message.includes("daily_price_history")) {
      return NextResponse.json(
        buildUnavailableHistoryResponse(
          symbol,
          "Historical storage is not available in this environment yet."
        )
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildUnavailableHistoryResponse(
  symbol: string,
  message: string
): HistoricalSeriesResponse {
  return {
    symbol,
    symbolName: null,
    firstAvailableDate: null,
    lastAvailableDate: null,
    requestedReferenceDate: null,
    effectiveReferenceDate: null,
    clampedToAvailableHistory: false,
    status: "unavailable",
    message,
    points: []
  };
}

function coerceHistoryRow(row: Record<string, unknown>): DailyPriceHistoryRow {
  return {
    symbol_id: Number(row.symbol_id),
    trading_date: String(row.trading_date),
    adjusted_close: Number(row.adjusted_close),
    volume: row.volume == null ? null : Number(row.volume)
  };
}
