"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

import {
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatRelativeSeconds
} from "@/lib/format";
import { useSupabaseBrowserClient } from "@/lib/supabase-browser";
import { HistoricalPerformancePanel } from "@/components/historical-performance-panel";
import { KpiStrip } from "@/components/kpi-strip";
import { PortfolioPanel } from "@/components/portfolio-panel";
import { TickerTape } from "@/components/ticker-tape";

export type HistoryPoint = {
  symbol: string;
  as_of: string;
  price: number;
};

type DashboardClientProps = {
  initialWatchlist: WatchlistItem[];
  initialPortfolioLots: PortfolioLot[];
  initialQuotes: QuoteRecord[];
  initialRun: IngestionRunRecord | null;
  initialHistory: HistoryPoint[];
  freshnessTargetSeconds: number;
  maxWatchlistSize: number;
  maxPortfolioSymbols: number;
};

type MutationState = {
  pending: boolean;
  error: string | null;
};

const HISTORY_CAP_PER_SYMBOL = 60;
const FLASH_DURATION_MS = 900;

export function DashboardClient({
  initialWatchlist,
  initialPortfolioLots,
  initialQuotes,
  initialRun,
  initialHistory,
  freshnessTargetSeconds,
  maxWatchlistSize,
  maxPortfolioSymbols
}: DashboardClientProps) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [portfolioLots, setPortfolioLots] = useState(initialPortfolioLots);
  const [quotes, setQuotes] = useState<Record<string, QuoteRecord>>(
    () => Object.fromEntries(initialQuotes.map((quote) => [quote.symbol, quote]))
  );
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>(() =>
    groupHistory(initialHistory)
  );
  const [latestRun, setLatestRun] = useState(initialRun);
  const [symbolInput, setSymbolInput] = useState("");
  const [mutation, setMutation] = useState<MutationState>({ pending: false, error: null });
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [flashMap, setFlashMap] = useState<Record<string, "up" | "down">>({});
  const flashTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
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
    return () => {
      flashTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      flashTimeoutsRef.current.clear();
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

          setQuotes((current) => {
            const previous = current[next.symbol];
            const prevPrice = previous?.price;
            if (
              prevPrice != null &&
              next.price != null &&
              Number(prevPrice) !== Number(next.price)
            ) {
              const direction: "up" | "down" =
                Number(next.price) > Number(prevPrice) ? "up" : "down";
              setFlashMap((flashCurrent) => ({ ...flashCurrent, [next.symbol]: direction }));
              const existing = flashTimeoutsRef.current.get(next.symbol);
              if (existing) clearTimeout(existing);
              const timeout = setTimeout(() => {
                setFlashMap((flashCurrent) => {
                  if (!(next.symbol in flashCurrent)) return flashCurrent;
                  const copy = { ...flashCurrent };
                  delete copy[next.symbol];
                  return copy;
                });
                flashTimeoutsRef.current.delete(next.symbol);
              }, FLASH_DURATION_MS);
              flashTimeoutsRef.current.set(next.symbol, timeout);
            }
            return { ...current, [next.symbol]: next };
          });

          if (next.last_ingested_at && next.price != null) {
            const point: HistoryPoint = {
              symbol: next.symbol,
              as_of: next.last_ingested_at,
              price: Number(next.price)
            };
            setHistory((current) => {
              const existing = current[next.symbol] ?? [];
              const last = existing[existing.length - 1];
              if (last && last.as_of === point.as_of) {
                return current;
              }
              return {
                ...current,
                [next.symbol]: [...existing, point].slice(-HISTORY_CAP_PER_SYMBOL)
              };
            });
          }
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
        history={history}
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

      <TickerTape symbols={watchlistSymbols} quotes={quotes} />

      <section className="space-y-4">
        <section className="panel p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.24em] text-tide/70">
                Watchlist
              </p>
              <h2 className="mt-1 font-display text-2xl text-ink">Instruments under surveillance.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
                Private to you. The worker polls a shared pool so API credits scale with activity, not with accounts.
              </p>
            </div>

            <form action={addSymbol} className="flex flex-col gap-3 sm:flex-row">
              <input
                name="symbol"
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
                maxLength={10}
                placeholder="AAPL"
                className="rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm tabular-nums outline-none transition focus:border-ember"
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
            <span>
              {watchlist.length} / {maxWatchlistSize} symbols tracked
            </span>
            {mutation.error ? <span className="text-ember">{mutation.error}</span> : null}
          </div>
        </section>

        <div className="panel overflow-hidden p-0">
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left">
              <thead className="border-b border-ink/10 bg-white/60 text-[11px] uppercase tracking-[0.22em] text-tide/70">
                <tr>
                  <th className="px-5 py-3 font-medium">Symbol</th>
                  <th className="px-5 py-3 font-medium">Trend · last {HISTORY_CAP_PER_SYMBOL}</th>
                  <th className="px-5 py-3 text-right font-medium">Price</th>
                  <th className="px-5 py-3 text-right font-medium">Δ day</th>
                  <th className="px-5 py-3 text-right font-medium">Volume</th>
                  <th className="px-5 py-3 text-right font-medium">Updated</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {watchlist.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-sm text-ink/50" colSpan={7}>
                      Add a symbol to start feeding the worker queue.
                    </td>
                  </tr>
                ) : (
                  watchlist.map((item, index) => {
                    const quote = quotes[item.symbol];
                    const ageSeconds = getQuoteAgeSeconds(quote?.last_ingested_at, clockMs);
                    const freshness = getFreshnessStatus(
                      quote?.last_ingested_at,
                      freshnessTargetSeconds,
                      clockMs
                    );
                    const pct = quote?.percent_change ?? null;
                    const up = (pct ?? 0) >= 0;
                    const flash = flashMap[item.symbol];
                    const symbolHistory = history[item.symbol] ?? [];

                    return (
                      <tr
                        key={item.id}
                        className={clsx(
                          "transition-colors",
                          index % 2 === 1 && "bg-ink/[0.015]",
                          flash === "up" && "price-flash-up",
                          flash === "down" && "price-flash-down"
                        )}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <FreshnessDot freshness={freshness} />
                            <div>
                              <p className="font-display text-base font-semibold tracking-tight text-ink">
                                {item.symbol}
                              </p>
                              <p className="truncate text-xs text-ink/50">
                                {quote?.name ?? "Awaiting poll"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <RowSparkline
                            points={symbolHistory}
                            fallbackPercent={pct}
                          />
                        </td>
                        <td className="px-5 py-4 text-right font-display text-base tabular-nums text-ink">
                          {formatCurrency(quote?.price)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {pct == null ? (
                            <span className="text-sm text-ink/40">—</span>
                          ) : (
                            <span
                              className={clsx(
                                "inline-flex items-center gap-1 font-display text-sm font-semibold tabular-nums",
                                up ? "text-emerald-700" : "text-rose-700"
                              )}
                            >
                              <span aria-hidden>{up ? "▲" : "▼"}</span>
                              {formatPercent(Math.abs(pct))}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right text-sm tabular-nums text-ink/65">
                          {formatCompactNumber(quote?.volume)}
                        </td>
                        <td className="px-5 py-4 text-right text-xs tabular-nums text-ink/50">
                          {formatRelativeSeconds(ageSeconds)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            disabled={removingSymbol === item.symbol}
                            onClick={() => void removeSymbol(item.symbol)}
                            className="rounded-full border border-ink/10 p-2 text-ink/55 transition hover:border-rose-400 hover:text-rose-600 disabled:opacity-50"
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
                Add a symbol to start feeding the worker queue.
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
                const pct = quote?.percent_change ?? null;
                const up = (pct ?? 0) >= 0;
                const flash = flashMap[item.symbol];
                const symbolHistory = history[item.symbol] ?? [];

                return (
                  <div
                    key={item.id}
                    className={clsx(
                      "rounded-2xl border border-ink/10 bg-white p-4 transition-colors",
                      flash === "up" && "price-flash-up",
                      flash === "down" && "price-flash-down"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <FreshnessDot freshness={freshness} />
                        <div>
                          <p className="font-display text-lg font-semibold text-ink">
                            {item.symbol}
                          </p>
                          <p className="text-xs text-ink/50">{quote?.name ?? "Awaiting poll"}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={removingSymbol === item.symbol}
                        onClick={() => void removeSymbol(item.symbol)}
                        className="rounded-full border border-ink/10 p-2 text-ink/60 transition hover:border-rose-400 hover:text-rose-600 disabled:opacity-50"
                        aria-label={`Remove ${item.symbol}`}
                      >
                        {removingSymbol === item.symbol ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="mt-3">
                      <RowSparkline points={symbolHistory} fallbackPercent={pct} height={32} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-tide/70">
                          Price
                        </p>
                        <p className="font-display tabular-nums text-ink">
                          {formatCurrency(quote?.price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-tide/70">
                          Δ day
                        </p>
                        {pct == null ? (
                          <p className="text-ink/40">—</p>
                        ) : (
                          <p
                            className={clsx(
                              "font-display tabular-nums",
                              up ? "text-emerald-700" : "text-rose-700"
                            )}
                          >
                            {up ? "▲ +" : "▼ "}
                            {pct.toFixed(2)}%
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-tide/70">
                          Volume
                        </p>
                        <p className="tabular-nums text-ink/70">
                          {formatCompactNumber(quote?.volume)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-tide/70">
                          Updated
                        </p>
                        <p className="tabular-nums text-ink/70">
                          {formatRelativeSeconds(ageSeconds)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <HistoricalPerformancePanel symbols={watchlistSymbols} />
    </div>
  );
}

function FreshnessDot({ freshness }: { freshness: "fresh" | "degraded" | "stale" }) {
  const bg =
    freshness === "fresh"
      ? "bg-emerald-500"
      : freshness === "degraded"
        ? "bg-amber-400"
        : "bg-rose-500";
  const ring =
    freshness === "fresh"
      ? "ring-emerald-500/25"
      : freshness === "degraded"
        ? "ring-amber-400/30"
        : "ring-rose-500/25";
  return (
    <span
      aria-hidden
      className={clsx("inline-block h-2 w-2 shrink-0 rounded-full ring-4", bg, ring)}
      title={`Freshness: ${freshness}`}
    />
  );
}

function RowSparkline({
  points,
  fallbackPercent,
  height = 28
}: {
  points: HistoryPoint[];
  fallbackPercent: number | null;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <span className="inline-block h-[1px] w-16 bg-ink/10" aria-hidden />
    );
  }

  const values = points.map((p) => p.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 110;
  const stepX = width / (values.length - 1);

  const first = values[0];
  const last = values[values.length - 1];
  const up = first != null && last != null ? last >= first : (fallbackPercent ?? 0) >= 0;
  const stroke = up ? "#10b981" : "#f43f5e";

  const d = values
    .map((v, i) => {
      const x = (i * stepX).toFixed(1);
      const y = (height - 1 - ((v - min) / range) * (height - 2)).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-[110px]"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function groupHistory(rows: HistoryPoint[]): Record<string, HistoryPoint[]> {
  const grouped: Record<string, HistoryPoint[]> = {};
  for (const row of rows) {
    (grouped[row.symbol] ??= []).push({
      symbol: row.symbol,
      as_of: row.as_of,
      price: Number(row.price)
    });
  }
  for (const symbol in grouped) {
    grouped[symbol]!.sort((a, b) => a.as_of.localeCompare(b.as_of));
    if (grouped[symbol]!.length > HISTORY_CAP_PER_SYMBOL) {
      grouped[symbol] = grouped[symbol]!.slice(-HISTORY_CAP_PER_SYMBOL);
    }
  }
  return grouped;
}
