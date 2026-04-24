"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Loader2, Trash2 } from "lucide-react";
import {
  getFreshnessStatus,
  getQuoteAgeSeconds,
  type IngestionRunRecord,
  type PortfolioLot,
  type QuoteRecord,
  type WatchlistItem
} from "@market-pulse/shared";

import { formatCompactNumber, formatCurrency, formatPercent, formatRelativeSeconds } from "@/lib/format";
import { useSupabaseBrowserClient } from "@/lib/supabase-browser";
import { HistoricalPerformancePanel } from "@/components/historical-performance-panel";
import { KpiStrip } from "@/components/kpi-strip";
import { PortfolioPanel } from "@/components/portfolio-panel";

type DashboardClientProps = {
  initialWatchlist: WatchlistItem[];
  initialPortfolioLots: PortfolioLot[];
  initialQuotes: QuoteRecord[];
  initialRun: IngestionRunRecord | null;
  freshnessTargetSeconds: number;
  maxWatchlistSize: number;
  maxPortfolioSymbols: number;
};

type MutationState = {
  pending: boolean;
  error: string | null;
};

export function DashboardClient({
  initialWatchlist,
  initialPortfolioLots,
  initialQuotes,
  initialRun,
  freshnessTargetSeconds,
  maxWatchlistSize,
  maxPortfolioSymbols
}: DashboardClientProps) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [portfolioLots, setPortfolioLots] = useState(initialPortfolioLots);
  const [quotes, setQuotes] = useState<Record<string, QuoteRecord>>(
    () => Object.fromEntries(initialQuotes.map((quote) => [quote.symbol, quote]))
  );
  const [latestRun, setLatestRun] = useState(initialRun);
  const [symbolInput, setSymbolInput] = useState("");
  const [mutation, setMutation] = useState<MutationState>({ pending: false, error: null });
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const { client: supabase, realtimeReady } = useSupabaseBrowserClient();

  const watchlistSymbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist]);
  const trackedSymbols = useMemo(() => {
    const set = new Set<string>(watchlistSymbols);
    for (const lot of portfolioLots) set.add(lot.symbol);
    return Array.from(set);
  }, [watchlistSymbols, portfolioLots]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockMs(Date.now());
    }, 15_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!realtimeReady) {
      return;
    }

    const quoteChannel = supabase
      .channel("quotes_current_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes_current" },
        (payload: { new: unknown }) => {
          const next = payload.new as QuoteRecord;
          if (!trackedSymbols.includes(next.symbol)) {
            return;
          }

          setQuotes((current) => ({
            ...current,
            [next.symbol]: next
          }));
        }
      )
      .subscribe();

    const runChannel = supabase
      .channel("ingestion_run_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ingestion_runs" },
        (payload: { new: unknown }) => {
          setLatestRun(payload.new as IngestionRunRecord);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(quoteChannel);
      void supabase.removeChannel(runChannel);
    };
  }, [realtimeReady, supabase, trackedSymbols]);

  async function addSymbol(formData: FormData) {
    const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
    if (!symbol) {
      return;
    }

    setMutation({ pending: true, error: null });

    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ symbol })
    });

    const payload = (await response.json()) as {
      error?: string;
      item?: WatchlistItem;
      quote?: QuoteRecord | null;
    };

    if (!response.ok || !payload.item) {
      setMutation({ pending: false, error: payload.error ?? "Failed to add symbol" });
      return;
    }

    const item = payload.item;

    setWatchlist((current) => {
      if (current.some((existing) => existing.symbol === item.symbol)) {
        return current;
      }

      return [...current, item];
    });

    const quote = payload.quote;
    if (quote) {
      setQuotes((current) => ({
        ...current,
        [quote.symbol]: quote
      }));
    }

    setSymbolInput("");
    setMutation({ pending: false, error: null });
  }

  async function removeSymbol(symbol: string) {
    setRemovingSymbol(symbol);
    setMutation({ pending: true, error: null });

    const response = await fetch("/api/watchlist", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ symbol })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMutation({ pending: false, error: payload.error ?? "Failed to remove symbol" });
      setRemovingSymbol(null);
      return;
    }

    setWatchlist((current) => current.filter((item) => item.symbol !== symbol));
    setMutation({ pending: false, error: null });
    setRemovingSymbol(null);
  }

  async function addLot(input: {
    symbol: string;
    shares: number;
    cost_basis: number;
    purchased_at?: string;
    note?: string;
  }) {
    const response = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });

    const payload = (await response.json()) as {
      error?: string;
      code?: string;
      lot?: PortfolioLot;
      quote?: QuoteRecord | null;
    };

    if (!response.ok || !payload.lot) {
      return { error: payload.error ?? "Failed to add lot", code: payload.code };
    }

    const lot = payload.lot;
    setPortfolioLots((current) => [lot, ...current]);
    if (payload.quote) {
      const quote = payload.quote;
      setQuotes((current) => ({ ...current, [quote.symbol]: quote }));
    }
    return {};
  }

  async function removeLot(id: string) {
    const response = await fetch("/api/portfolio", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return { error: payload.error ?? "Failed to remove lot" };
    }

    setPortfolioLots((current) => current.filter((lot) => lot.id !== id));
    return {};
  }

  return (
    <div className="space-y-6">
      <KpiStrip
        lots={portfolioLots}
        quotes={quotes}
        watchlistCount={watchlist.length}
        latestRun={latestRun}
        freshnessTargetSeconds={freshnessTargetSeconds}
        clockMs={clockMs}
      />

      <PortfolioPanel
        lots={portfolioLots}
        quotes={quotes}
        maxSymbols={maxPortfolioSymbols}
        onAddLot={addLot}
        onRemoveLot={removeLot}
      />

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <div className="space-y-4">
          <section className="panel p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-display text-sm uppercase tracking-[0.24em] text-tide/70">
                  Watchlist
                </p>
                <h2 className="mt-2 font-display text-2xl text-ink">
                  Symbols you want to keep an eye on.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
                  Private to you, but the worker polls a shared pool to keep API costs bounded.
                </p>
              </div>

              <form action={addSymbol} className="flex flex-col gap-3 sm:flex-row">
                <input
                  name="symbol"
                  value={symbolInput}
                  onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
                  maxLength={10}
                  placeholder="AAPL"
                  className="rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm outline-none transition focus:border-ember"
                />
                <button
                  type="submit"
                  disabled={mutation.pending || watchlist.length >= maxWatchlistSize}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-tide disabled:cursor-not-allowed disabled:bg-ink/60"
                >
                  {mutation.pending && !removingSymbol ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {mutation.pending && !removingSymbol ? "Adding..." : "Add symbol"}
                </button>
              </form>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink/60">
              <span>{watchlist.length} / {maxWatchlistSize} symbols tracked</span>
              {mutation.error ? <span className="text-ember">{mutation.error}</span> : null}
            </div>
          </section>

          <div className="panel overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-ink/10 text-left">
                <thead className="bg-white/70 text-xs uppercase tracking-[0.24em] text-tide/70">
                  <tr>
                    <th className="px-6 py-4">Symbol</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Change</th>
                    <th className="px-6 py-4">Volume</th>
                    <th className="px-6 py-4">Freshness</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10 bg-white/50">
                  {watchlist.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-sm text-ink/60" colSpan={6}>
                        Add symbols to start feeding the worker queue.
                      </td>
                    </tr>
                  ) : (
                    watchlist.map((item) => {
                      const quote = quotes[item.symbol];
                      const ageSeconds = getQuoteAgeSeconds(quote?.last_ingested_at, clockMs);
                      const freshness = getFreshnessStatus(
                        quote?.last_ingested_at,
                        freshnessTargetSeconds,
                        clockMs
                      );

                      return (
                        <tr key={item.id}>
                          <td className="px-6 py-5">
                            <div>
                              <p className="font-display text-lg text-ink">{item.symbol}</p>
                              <p className="text-sm text-ink/60">{quote?.name ?? "Awaiting poll"}</p>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm text-ink">{formatCurrency(quote?.price)}</td>
                          <td className="px-6 py-5">
                            <div
                              className={clsx(
                                "inline-flex rounded-full px-3 py-1 text-sm font-medium",
                                (quote?.percent_change ?? 0) >= 0
                                  ? "bg-mint/25 text-tide"
                                  : "bg-ember/15 text-ember"
                              )}
                            >
                              {formatPercent(quote?.percent_change)}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm text-ink/70">
                            {formatCompactNumber(quote?.volume)}
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <span
                                className={clsx(
                                  "h-3 w-3 rounded-full",
                                  freshness === "fresh" && "bg-mint",
                                  freshness === "degraded" && "bg-amber-400",
                                  freshness === "stale" && "bg-ember"
                                )}
                              />
                              <div className="text-sm text-ink/70">
                                <p className="capitalize text-ink">{freshness}</p>
                                <p>{formatRelativeSeconds(ageSeconds)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <button
                              type="button"
                              disabled={removingSymbol === item.symbol}
                              onClick={() => void removeSymbol(item.symbol)}
                              className="rounded-full border border-ink/10 p-2 text-ink/70 transition hover:border-ember hover:text-ember disabled:opacity-50"
                              aria-label={`Remove ${item.symbol}`}
                            >
                              {removingSymbol === item.symbol ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 p-4 md:hidden">
              {watchlist.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink/60">
                  Add symbols to start feeding the worker queue.
                </p>
              ) : (
                watchlist.map((item) => {
                  const quote = quotes[item.symbol];
                  const ageSeconds = getQuoteAgeSeconds(quote?.last_ingested_at, clockMs);
                  const freshness = getFreshnessStatus(
                    quote?.last_ingested_at,
                    freshnessTargetSeconds,
                    clockMs
                  );
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-ink/10 bg-white p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-display text-lg text-ink">{item.symbol}</p>
                          <p className="text-xs text-ink/50">{quote?.name ?? "Awaiting poll"}</p>
                        </div>
                        <button
                          type="button"
                          disabled={removingSymbol === item.symbol}
                          onClick={() => void removeSymbol(item.symbol)}
                          className="rounded-full border border-ink/10 p-2 text-ink/70 transition hover:border-ember hover:text-ember disabled:opacity-50"
                          aria-label={`Remove ${item.symbol}`}
                        >
                          {removingSymbol === item.symbol ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-tide/70">Price</p>
                          <p className="text-ink">{formatCurrency(quote?.price)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-tide/70">Change</p>
                          <p
                            className={clsx(
                              "font-medium",
                              (quote?.percent_change ?? 0) >= 0 ? "text-tide" : "text-ember"
                            )}
                          >
                            {formatPercent(quote?.percent_change)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-tide/70">Volume</p>
                          <p className="text-ink/70">{formatCompactNumber(quote?.volume)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-tide/70">Freshness</p>
                          <div className="flex items-center gap-2">
                            <span
                              className={clsx(
                                "h-2 w-2 rounded-full",
                                freshness === "fresh" && "bg-mint",
                                freshness === "degraded" && "bg-amber-400",
                                freshness === "stale" && "bg-ember"
                              )}
                            />
                            <span className="text-ink/70">{formatRelativeSeconds(ageSeconds)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="panel p-6">
            <p className="font-display text-sm uppercase tracking-[0.24em] text-tide/70">
              Pipeline health
            </p>
            <h3 className="mt-2 font-display text-2xl text-ink">Operational visibility is part of the product.</h3>
            <div className="mt-6 space-y-4">
              <MetricRow label="Latest run" value={latestRun?.status ?? "No runs yet"} />
              <MetricRow
                label="Symbols polled"
                value={
                  latestRun
                    ? `${latestRun.symbols_polled} / ${latestRun.symbols_considered}`
                    : "--"
                }
              />
              <MetricRow
                label="Rows written"
                value={latestRun ? String(latestRun.rows_written) : "--"}
              />
              <MetricRow
                label="Stale symbols"
                value={latestRun ? String(latestRun.stale_symbols) : "--"}
              />
              <MetricRow
                label="Error count"
                value={latestRun ? String(latestRun.error_count) : "--"}
              />
            </div>
          </section>

          <section className="panel p-6">
            <p className="font-display text-sm uppercase tracking-[0.24em] text-tide/70">
              Design tradeoff
            </p>
            <p className="mt-3 text-sm leading-7 text-ink/75">
              Per-user polling would feel simpler to reason about, but it burns API credits fast
              and scales poorly. This system polls a shared demand pool and then fans data out via
              Supabase Realtime, which is the right architecture for low-cost shared live data.
            </p>
          </section>
        </aside>
      </section>

      <HistoricalPerformancePanel symbols={watchlistSymbols} />
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white px-4 py-3">
      <span className="text-sm text-ink/60">{label}</span>
      <span className="font-display text-lg text-ink">{value}</span>
    </div>
  );
}
