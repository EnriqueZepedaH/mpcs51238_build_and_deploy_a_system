import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isLikelyUsEquityOrEtfSymbol, normalizeSymbol } from "@market-pulse/shared";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const querySchema = z.object({
  symbol: z
    .string()
    .transform(normalizeSymbol)
    .refine((value) => isLikelyUsEquityOrEtfSymbol(value), {
      message: "Use a likely US stock or ETF ticker format"
    }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    symbol: url.searchParams.get("symbol") ?? "",
    date: url.searchParams.get("date") ?? ""
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServerClient();
  const { symbol, date } = parsed.data;

  const { data: symbolMaster, error: symbolError } = await supabase
    .from("symbol_master")
    .select("id")
    .eq("symbol", symbol)
    .maybeSingle();

  if (symbolError) {
    return NextResponse.json({ error: symbolError.message }, { status: 500 });
  }

  if (!symbolMaster) {
    return NextResponse.json(
      {
        error: `${symbol} is not in the free tier universe. Upgrade to Pro to track custom symbols.`,
        code: "premium_required"
      },
      { status: 402 }
    );
  }

  const { data: row, error: priceError } = await supabase
    .from("daily_price_history")
    .select("trading_date,adjusted_close")
    .eq("symbol_id", (symbolMaster as { id: number }).id)
    .lte("trading_date", date)
    .order("trading_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priceError) {
    return NextResponse.json({ error: priceError.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json(
      { error: `No stored history for ${symbol} on or before ${date}.` },
      { status: 404 }
    );
  }

  const tradingDate = String((row as { trading_date: string }).trading_date);
  const price = Number((row as { adjusted_close: number | string }).adjusted_close);

  return NextResponse.json({
    symbol,
    requestedDate: date,
    tradingDate,
    price,
    clamped: tradingDate !== date
  });
}
