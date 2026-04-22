import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getMaxWatchlistSize } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const symbolSchema = z.object({
  symbol: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(value), {
      message: "Use a valid US stock or ETF ticker"
    })
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = symbolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid symbol" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("user_watchlists")
    .select("*", { count: "exact", head: true })

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) >= getMaxWatchlistSize()) {
    const { data: existing } = await supabase
      .from("user_watchlists")
      .select("*")
      .eq("symbol", parsed.data.symbol)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Watchlist limit reached" }, { status: 400 });
    }
  }

  const { data: item, error } = await supabase
    .from("user_watchlists")
    .upsert(
      {
        clerk_user_id: userId,
        symbol: parsed.data.symbol
      },
      { onConflict: "clerk_user_id,symbol" }
    )
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

  return NextResponse.json({ item, quote });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = symbolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid symbol" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("user_watchlists")
    .delete()
    .eq("symbol", parsed.data.symbol);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
