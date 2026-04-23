"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Trash2 } from "lucide-react";
import {
  getFreshnessStatus,
  getQuoteAgeSeconds,
  type IngestionRunRecord,
  type QuoteRecord,
  type WatchlistItem
} from "@market-pulse/shared";

import { formatCompactNumber, formatCurrency, formatPercent, formatRelativeSeconds } from "@/lib/format";
import { useSupabaseBrowserClient } from "@/lib/supabase-browser";
import { HistoricalPerformancePanel } from "@/components/historical-performance-panel";

type DashboardClientProps = {
  initialWatchlist: WatchlistItem[];
  initialQuotes: QuoteRecord[];
  initialRun: IngestionRunRecord | null;
  freshnessTargetSeconds: number;
  maxWatchlistSize: number;
};

type MutationState = {
  pending: boolean;
  error: string | null;
};

export function DashboardClient({
  initialWatchlist,
  initialQuotes,
  initialRun,
  freshnessTargetSeconds,
  maxWatchlistSize
}: DashboardClientProps) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [quotes, setQuotes] = useState<Record<string, QuoteRecord>>(
    () => Object.fromEntries(initialQuotes.map((quote) => [quote.symbol, quote]))
  );
  const [latestRun, setLatestRun] = useState(initialRun);
  const [symbolInput, setSymbolInput] = useState("");
  const [mutation, setMutation] = useState<MutationState>({ pending: false, error: null });
  const supabase = useSupabaseBrowserClient();

  const symbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist]);

  useEffect(() => {
    const quoteChannel = supabase
      .channel("quotes_current_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes_current" },
        (payload: { new: unknown }) => {
          const next = payload.new as QuoteRecord;
          if (!symbols.includes(next.symbol)) {
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
  }, [supabase, symbols]);

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
      return;
    }

    setWatchlist((current) => current.filter((item) => item.symbol !== symbol));
    setMutation({ pending: false, error: null });
  }

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.24em] text-tide/70">
              Personalized watchlist
            </p>
            <h2 className="mt-2 font-display text-3xl text-ink">Track the symbols you actually use.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
              The app stores private watchlists, but it polls quotes from a shared symbol pool.
              That tradeoff keeps API cost under control while still delivering realtime updates
              for the most followed symbols.
            </p>
          </div>

          <form action={addSymbol} className="flex flex-col gap-3 sm:flex-row">
            <input
              name="symbol"
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
              maxLength={10}
              placeholder="AAPL"
              className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm outline-none ring-0 transition focus:border-ember"
            />
            <button
              type="submit"
              disabled={mutation.pending || watchlist.length >= maxWatchlistSize}
              className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide disabled:cursor-not-allowed disabled:bg-ink/50"
            >
              Add symbol
            </button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink/70">
          <span>{watchlist.length} / {maxWatchlistSize} tracked symbols</span>
          <span>Format is validated on add. Symbol existence is confirmed once market polling is configured.</span>
          {mutation.error ? <span className="text-ember">{mutation.error}</span> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <div className="panel overflow-hidden">
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
                  const ageSeconds = getQuoteAgeSeconds(quote?.last_ingested_at);
                  const freshness = getFreshnessStatus(
                    quote?.last_ingested_at,
                    freshnessTargetSeconds
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
                          onClick={() => void removeSymbol(item.symbol)}
                          className="rounded-full border border-ink/10 p-2 text-ink/70 transition hover:border-ember hover:text-ember"
                          aria-label={`Remove ${item.symbol}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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

      <HistoricalPerformancePanel symbols={symbols} />
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
