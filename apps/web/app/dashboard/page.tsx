import type {
  IngestionRunRecord,
  PortfolioLot,
  QuoteRecord,
  WatchlistItem
} from "@market-pulse/shared";

import { DashboardClient, type HistoryPoint } from "@/components/dashboard-client";
import {
  getFreshnessTargetSeconds,
  getMaxPortfolioSymbols,
  getMaxWatchlistSize
} from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const [{ data: watchlist }, { data: portfolioLots }] = await Promise.all([
    supabase.from("user_watchlists").select("*").order("symbol"),
    supabase.from("user_portfolio_lots").select("*").order("purchased_at", { ascending: false })
  ]);

  const watchlistSymbols = (watchlist ?? []).map((item: { symbol: string }) => item.symbol);
  const portfolioSymbols = (portfolioLots ?? []).map((item: { symbol: string }) => item.symbol);
  const symbols = Array.from(new Set([...watchlistSymbols, ...portfolioSymbols]));

  const [{ data: quotes }, { data: runs }, { data: history }] = await Promise.all([
    symbols.length > 0
      ? supabase.from("quotes_current").select("*").in("symbol", symbols)
      : Promise.resolve({ data: [] as QuoteRecord[] }),
    supabase.from("ingestion_runs").select("*").order("started_at", { ascending: false }).limit(1),
    symbols.length > 0
      ? supabase
          .from("quotes_history")
          .select("symbol,as_of,price")
          .in("symbol", symbols)
          .order("as_of", { ascending: false })
          .limit(1500)
      : Promise.resolve({ data: [] as HistoryPoint[] })
  ]);

  return (
    <DashboardClient
      initialWatchlist={(watchlist ?? []) as WatchlistItem[]}
      initialPortfolioLots={(portfolioLots ?? []) as PortfolioLot[]}
      initialQuotes={(quotes ?? []) as QuoteRecord[]}
      initialRun={(runs?.[0] ?? null) as IngestionRunRecord | null}
      initialHistory={(history ?? []) as HistoryPoint[]}
      freshnessTargetSeconds={getFreshnessTargetSeconds()}
      maxWatchlistSize={getMaxWatchlistSize()}
      maxPortfolioSymbols={getMaxPortfolioSymbols()}
    />
  );
}
