import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type {
  IngestionRunRecord,
  PortfolioLot,
  QuoteRecord,
  WatchlistItem
} from "@market-pulse/shared";

import { DashboardClient } from "@/components/dashboard-client";
import {
  getFreshnessTargetSeconds,
  getMaxPortfolioSymbols,
  getMaxWatchlistSize
} from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const supabase = await getSupabaseServerClient();
  const [{ data: watchlist }, { data: portfolioLots }] = await Promise.all([
    supabase.from("user_watchlists").select("*").order("symbol"),
    supabase.from("user_portfolio_lots").select("*").order("purchased_at", { ascending: false })
  ]);

  const watchlistSymbols = (watchlist ?? []).map((item: { symbol: string }) => item.symbol);
  const portfolioSymbols = (portfolioLots ?? []).map((item: { symbol: string }) => item.symbol);
  const symbols = Array.from(new Set([...watchlistSymbols, ...portfolioSymbols]));

  const [{ data: quotes }, { data: runs }] = await Promise.all([
    symbols.length > 0
      ? supabase.from("quotes_current").select("*").in("symbol", symbols)
      : Promise.resolve({ data: [] as QuoteRecord[] }),
    supabase.from("ingestion_runs").select("*").order("started_at", { ascending: false }).limit(1)
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.24em] text-tide/70">
            Dashboard
          </p>
          <h1 className="mt-2 font-display text-5xl text-ink">Realtime watchlists with visible pipeline health.</h1>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="rounded-full border border-ink/10 px-5 py-3 text-sm text-ink/80 transition hover:border-tide hover:text-tide"
          >
            Home
          </a>
          <UserButton />
        </div>
      </header>

      <section className="mt-8">
        <DashboardClient
          initialWatchlist={(watchlist ?? []) as WatchlistItem[]}
          initialPortfolioLots={(portfolioLots ?? []) as PortfolioLot[]}
          initialQuotes={(quotes ?? []) as QuoteRecord[]}
          initialRun={(runs?.[0] ?? null) as IngestionRunRecord | null}
          freshnessTargetSeconds={getFreshnessTargetSeconds()}
          maxWatchlistSize={getMaxWatchlistSize()}
          maxPortfolioSymbols={getMaxPortfolioSymbols()}
        />
      </section>
    </main>
  );
}
