import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isLikelyUsEquityOrEtfSymbol, normalizeSymbol } from "@market-pulse/shared";

import { getMaxPortfolioSymbols } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const addLotSchema = z.object({
  symbol: z
    .string()
    .transform(normalizeSymbol)
    .refine((value) => isLikelyUsEquityOrEtfSymbol(value), {
      message: "Use a likely US stock or ETF ticker format, for example AAPL, MSFT, or BRK.B"
    }),
  shares: z.coerce.number().positive().finite(),
  cost_basis: z.coerce.number().positive().finite(),
  purchased_at: z.string().datetime().optional(),
  note: z.string().trim().max(200).optional()
});

const deleteLotSchema = z.object({
  id: z.string().uuid()
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = addLotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid lot" },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServerClient();

  const { data: curatedRow, error: curatedError } = await supabase
    .from("symbol_master")
    .select("symbol")
    .eq("symbol", parsed.data.symbol)
    .maybeSingle();

  if (curatedError) {
    return NextResponse.json({ error: curatedError.message }, { status: 500 });
  }

  if (!curatedRow) {
    return NextResponse.json(
      {
        error: `${parsed.data.symbol} is not in the free tier universe. Upgrade to Pro to track custom symbols.`,
        code: "premium_required"
      },
      { status: 402 }
    );
  }

  const { data: existingSymbols, error: listError } = await supabase
    .from("user_portfolio_lots")
    .select("symbol");

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const distinctSymbols = new Set((existingSymbols ?? []).map((row) => row.symbol));
  const isNewSymbol = !distinctSymbols.has(parsed.data.symbol);

  if (isNewSymbol && distinctSymbols.size >= getMaxPortfolioSymbols()) {
    return NextResponse.json(
      {
        error: `Portfolio symbol limit reached (${getMaxPortfolioSymbols()}). Remove a position before adding a new symbol.`
      },
      { status: 409 }
    );
  }

  const { data: lot, error } = await supabase
    .from("user_portfolio_lots")
    .insert({
      clerk_user_id: userId,
      symbol: parsed.data.symbol,
      shares: parsed.data.shares,
      cost_basis: parsed.data.cost_basis,
      purchased_at: parsed.data.purchased_at,
      note: parsed.data.note ?? null
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: quote } = await supabase
    .from("quotes_current")
    .select("*")
    .eq("symbol", parsed.data.symbol)
    .maybeSingle();

  return NextResponse.json({ lot, quote });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = deleteLotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid lot id" },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("user_portfolio_lots")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
