"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Loader2, Lock, Sparkles, Trash2 } from "lucide-react";
import {
  computeUnrealizedPnl,
  summarizePortfolio,
  type PortfolioLot,
  type QuoteRecord
} from "@market-pulse/shared";

import { formatCurrency, formatPercent } from "@/lib/format";

type PortfolioPanelProps = {
  lots: PortfolioLot[];
  quotes: Record<string, QuoteRecord>;
  maxSymbols: number;
  onAddLot: (input: {
    symbol: string;
    shares: number;
    cost_basis: number;
    purchased_at?: string;
    note?: string;
  }) => Promise<{ error?: string; code?: string }>;
  onRemoveLot: (id: string) => Promise<{ error?: string }>;
};

type View = "summary" | "lots";

const initialForm = {
  symbol: "",
  shares: "",
  costBasis: "",
  purchasedAt: "",
  note: ""
};

export function PortfolioPanel({
  lots,
  quotes,
  maxSymbols,
  onAddLot,
  onRemoveLot
}: PortfolioPanelProps) {
  const [view, setView] = useState<View>("summary");
  const [form, setForm] = useState(initialForm);
  const [pending, setPending] = useState(false);
  const [fillPending, setFillPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumLock, setPremiumLock] = useState<string | null>(null);
  const [fillNote, setFillNote] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const positions = useMemo(() => summarizePortfolio(lots), [lots]);
  const distinctSymbols = positions.length;

  async function submitLot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setPremiumLock(null);
    setFillNote(null);

    const shares = Number(form.shares);
    const costBasis = Number(form.costBasis);

    if (!form.symbol.trim()) {
      setError("Symbol is required");
      setPending(false);
      return;
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      setError("Shares must be a positive number");
      setPending(false);
      return;
    }
    if (!Number.isFinite(costBasis) || costBasis <= 0) {
      setError("Cost basis must be greater than zero");
      setPending(false);
      return;
    }

    const purchased_at = form.purchasedAt
      ? new Date(`${form.purchasedAt}T00:00:00Z`).toISOString()
      : undefined;

    const result = await onAddLot({
      symbol: form.symbol.trim().toUpperCase(),
      shares,
      cost_basis: costBasis,
      purchased_at,
      note: form.note.trim() || undefined
    });

    if (result.error) {
      if (result.code === "premium_required") {
        setPremiumLock(result.error);
      } else {
        setError(result.error);
      }
      setPending(false);
      return;
    }

    setForm(initialForm);
    setPending(false);
  }

  async function fillCostBasisFromHistory() {
    setFillPending(true);
    setError(null);
    setPremiumLock(null);
    setFillNote(null);

    const symbol = form.symbol.trim().toUpperCase();
    if (!symbol) {
      setError("Enter a symbol first");
      setFillPending(false);
      return;
    }

    const date = form.purchasedAt || new Date().toISOString().slice(0, 10);

    const response = await fetch(
      `/api/portfolio/historical-price?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`
    );

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      price?: number;
      tradingDate?: string;
      clamped?: boolean;
    };

    if (!response.ok) {
      if (payload.code === "premium_required") {
        setPremiumLock(payload.error ?? "Premium feature");
      } else {
        setError(payload.error ?? "Could not load historical price");
      }
      setFillPending(false);
      return;
    }

    if (payload.price != null) {
      setForm((s) => ({
        ...s,
        costBasis: payload.price!.toFixed(2),
        purchasedAt: payload.tradingDate ?? s.purchasedAt
      }));
      setFillNote(
        payload.clamped
          ? `Used close from ${payload.tradingDate} (nearest trading day on or before ${date}).`
          : `Filled with close from ${payload.tradingDate}.`
      );
    }

    setFillPending(false);
  }

  async function deleteLot(id: string) {
    setDeletingId(id);
    setError(null);
    const result = await onRemoveLot(id);
    if (result.error) {
      setError(result.error);
    }
    setDeletingId(null);
  }

  async function deletePosition(symbol: string) {
    const targetLots = lots.filter((lot) => lot.symbol === symbol);
    if (targetLots.length === 0) return;

    const confirmed = window.confirm(
      `Remove the entire ${symbol} position? This deletes ${targetLots.length} lot${targetLots.length === 1 ? "" : "s"}.`
    );
    if (!confirmed) return;

    setDeletingId(symbol);
    setError(null);
    for (const lot of targetLots) {
      const result = await onRemoveLot(lot.id);
      if (result.error) {
        setError(result.error);
        break;
      }
    }
    setDeletingId(null);
  }

  const totals = positions.reduce(
    (acc, position) => {
      const price = quotes[position.symbol]?.price ?? null;
      const { marketValue, pnlDollars } = computeUnrealizedPnl(position, price);
      acc.cost += position.totalCost;
      if (marketValue != null) {
        acc.marketValue += marketValue;
        acc.allPricesKnown = acc.allPricesKnown && true;
      } else {
        acc.allPricesKnown = false;
      }
      if (pnlDollars != null) {
        acc.pnl += pnlDollars;
      }
      return acc;
    },
    { cost: 0, marketValue: 0, pnl: 0, allPricesKnown: true }
  );

  const totalPnlPercent =
    totals.allPricesKnown && totals.cost > 0
      ? ((totals.marketValue - totals.cost) / totals.cost) * 100
      : null;

  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.24em] text-tide/70">Portfolio</p>
          <h2 className="mt-2 font-display text-3xl text-ink">Track what you actually own.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
            Record each buy as a lot. Unrealized P&L updates live as the worker refreshes quotes.
          </p>
          <p className="mt-3 text-sm text-ink/60">
            {distinctSymbols} / {maxSymbols} symbols tracked · {lots.length} total lots
          </p>
        </div>

        <div className="inline-flex self-start rounded-full border border-ink/10 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setView("summary")}
            className={clsx(
              "rounded-full px-4 py-1.5 transition",
              view === "summary" ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
            )}
          >
            Summary
          </button>
          <button
            type="button"
            onClick={() => setView("lots")}
            className={clsx(
              "rounded-full px-4 py-1.5 transition",
              view === "lots" ? "bg-ink text-white" : "text-ink/60 hover:text-ink"
            )}
          >
            Lots ({lots.length})
          </button>
        </div>
      </div>

      <form
        onSubmit={submitLot}
        className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.1fr_auto]"
      >
        <input
          name="symbol"
          value={form.symbol}
          onChange={(event) => setForm((s) => ({ ...s, symbol: event.target.value.toUpperCase() }))}
          maxLength={10}
          placeholder="Symbol (AAPL)"
          className="rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ember"
        />
        <input
          name="shares"
          inputMode="decimal"
          value={form.shares}
          onChange={(event) => setForm((s) => ({ ...s, shares: event.target.value }))}
          placeholder="Shares"
          className="rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ember"
        />
        <input
          name="costBasis"
          inputMode="decimal"
          value={form.costBasis}
          onChange={(event) => setForm((s) => ({ ...s, costBasis: event.target.value }))}
          placeholder="Cost basis ($/share)"
          className="rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ember"
        />
        <input
          name="purchasedAt"
          type="date"
          value={form.purchasedAt}
          onChange={(event) => setForm((s) => ({ ...s, purchasedAt: event.target.value }))}
          className="rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ember"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-tide disabled:cursor-not-allowed disabled:bg-ink/60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? "Adding..." : "Add lot"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void fillCostBasisFromHistory()}
          disabled={fillPending || !form.symbol.trim()}
          className="inline-flex items-center gap-2 rounded-full border border-tide/30 bg-tide/5 px-4 py-1.5 text-xs font-medium text-tide transition hover:border-tide hover:bg-tide/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fillPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Fill cost basis from historical close
        </button>
        {fillNote ? <span className="text-xs text-ink/60">{fillNote}</span> : null}
      </div>

      {premiumLock ? (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-ember/30 bg-ember/5 p-4">
          <div className="rounded-full bg-ember/15 p-2 text-ember">
            <Lock className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-display text-sm text-ink">Premium feature</p>
            <p className="mt-1 text-sm text-ink/70">{premiumLock}</p>
            <p className="mt-2 text-xs text-ink/50">
              The free tier covers the S&amp;P 500 plus the top 50 ETFs by AUM. Pro unlocks custom symbols and extended history.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-tide"
            onClick={() => setPremiumLock(null)}
          >
            Upgrade
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}

      <div className="mt-6">
        {lots.length === 0 ? (
          <EmptyState maxSymbols={maxSymbols} />
        ) : view === "summary" ? (
          <SummaryView
            positions={positions}
            quotes={quotes}
            totals={totals}
            totalPnlPercent={totalPnlPercent}
            deletingSymbol={deletingId}
            onDeletePosition={deletePosition}
          />
        ) : (
          <LotsView lots={lots} quotes={quotes} deletingId={deletingId} onDelete={deleteLot} />
        )}
      </div>
    </section>
  );
}

function EmptyState({ maxSymbols }: { maxSymbols: number }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-lg text-ink">No positions yet</p>
      <p className="mt-2 text-sm text-ink/60">
        Track up to {maxSymbols} symbols to see live unrealized P&L. Add as many lots per symbol as you need.
      </p>
    </div>
  );
}

function SummaryView({
  positions,
  quotes,
  totals,
  totalPnlPercent,
  deletingSymbol,
  onDeletePosition
}: {
  positions: ReturnType<typeof summarizePortfolio>;
  quotes: Record<string, QuoteRecord>;
  totals: { cost: number; marketValue: number; pnl: number; allPricesKnown: boolean };
  totalPnlPercent: number | null;
  deletingSymbol: string | null;
  onDeletePosition: (symbol: string) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-ink/10 text-left">
          <thead className="text-xs uppercase tracking-[0.2em] text-tide/70">
            <tr>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Shares</th>
              <th className="px-4 py-3">Avg cost</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Market value</th>
              <th className="px-4 py-3">Unrealized P&L</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {positions.map((position) => {
              const quote = quotes[position.symbol];
              const { marketValue, pnlDollars, pnlPercent } = computeUnrealizedPnl(
                position,
                quote?.price ?? null
              );
              const isDeleting = deletingSymbol === position.symbol;
              return (
                <tr key={position.symbol}>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-display text-lg text-ink">{position.symbol}</p>
                      <p className="text-xs text-ink/50">
                        {position.lotCount} lot{position.lotCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-ink">{formatShares(position.totalShares)}</td>
                  <td className="px-4 py-4 text-sm text-ink">{formatCurrency(position.weightedAvgCost)}</td>
                  <td className="px-4 py-4 text-sm text-ink">{formatCurrency(quote?.price ?? null)}</td>
                  <td className="px-4 py-4 text-sm text-ink">{formatCurrency(marketValue)}</td>
                  <td className="px-4 py-4 text-sm">
                    <PnlCell dollars={pnlDollars} percent={pnlPercent} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => onDeletePosition(position.symbol)}
                      className="rounded-full border border-ink/10 p-2 text-ink/70 transition hover:border-ember hover:text-ember disabled:opacity-50"
                      aria-label={`Remove ${position.symbol} position`}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-white/40 text-sm">
            <tr className="border-t border-ink/15">
              <td className="px-4 py-3 font-display text-ink">Total</td>
              <td colSpan={2} className="px-4 py-3 text-ink/60">
                {formatCurrency(totals.cost)} cost basis
              </td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-ink">
                {totals.allPricesKnown ? formatCurrency(totals.marketValue) : "--"}
              </td>
              <td className="px-4 py-3">
                <PnlCell
                  dollars={totals.allPricesKnown ? totals.pnl : null}
                  percent={totalPnlPercent}
                />
              </td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {positions.map((position) => {
          const quote = quotes[position.symbol];
          const { marketValue, pnlDollars, pnlPercent } = computeUnrealizedPnl(
            position,
            quote?.price ?? null
          );
          const isDeleting = deletingSymbol === position.symbol;
          return (
            <div
              key={position.symbol}
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-ink">{position.symbol}</p>
                  <p className="text-xs text-ink/50">
                    {formatShares(position.totalShares)} sh · avg {formatCurrency(position.weightedAvgCost)}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-right">
                    <p className="font-display text-base text-ink">{formatCurrency(marketValue)}</p>
                    <PnlCell dollars={pnlDollars} percent={pnlPercent} compact />
                  </div>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => onDeletePosition(position.symbol)}
                    className="rounded-full border border-ink/10 p-2 text-ink/70 transition hover:border-ember hover:text-ember disabled:opacity-50"
                    aria-label={`Remove ${position.symbol} position`}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div className="rounded-2xl border border-ink/15 bg-white/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-tide/70">Total</span>
            <span className="font-display text-lg text-ink">
              {totals.allPricesKnown ? formatCurrency(totals.marketValue) : "--"}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-ink/60">Cost {formatCurrency(totals.cost)}</span>
            <PnlCell
              dollars={totals.allPricesKnown ? totals.pnl : null}
              percent={totalPnlPercent}
              compact
            />
          </div>
        </div>
      </div>
    </>
  );
}

function LotsView({
  lots,
  quotes,
  deletingId,
  onDelete
}: {
  lots: PortfolioLot[];
  quotes: Record<string, QuoteRecord>;
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-ink/10 text-left">
        <thead className="text-xs uppercase tracking-[0.2em] text-tide/70">
          <tr>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Shares</th>
            <th className="px-4 py-3">Cost basis</th>
            <th className="px-4 py-3">Purchased</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">P&L</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {lots.map((lot) => {
            const quote = quotes[lot.symbol];
            const currentPrice = quote?.price ?? null;
            const { pnlDollars, pnlPercent } = computeUnrealizedPnl(
              { totalShares: Number(lot.shares), totalCost: Number(lot.shares) * Number(lot.cost_basis) },
              currentPrice
            );
            return (
              <tr key={lot.id}>
                <td className="px-4 py-3">
                  <p className="font-display text-base text-ink">{lot.symbol}</p>
                  {lot.note ? <p className="text-xs text-ink/50">{lot.note}</p> : null}
                </td>
                <td className="px-4 py-3 text-sm text-ink">{formatShares(Number(lot.shares))}</td>
                <td className="px-4 py-3 text-sm text-ink">{formatCurrency(Number(lot.cost_basis))}</td>
                <td className="px-4 py-3 text-sm text-ink/70">{formatDateTime(lot.purchased_at)}</td>
                <td className="px-4 py-3 text-sm text-ink">{formatCurrency(currentPrice)}</td>
                <td className="px-4 py-3 text-sm">
                  <PnlCell dollars={pnlDollars} percent={pnlPercent} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={deletingId === lot.id}
                    onClick={() => onDelete(lot.id)}
                    className="rounded-full border border-ink/10 p-2 text-ink/70 transition hover:border-ember hover:text-ember disabled:opacity-50"
                    aria-label={`Remove ${lot.symbol} lot`}
                  >
                    {deletingId === lot.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PnlCell({
  dollars,
  percent,
  compact = false
}: {
  dollars: number | null;
  percent: number | null;
  compact?: boolean;
}) {
  if (dollars == null) {
    return <span className="text-ink/50">--</span>;
  }

  const positive = dollars >= 0;
  const tone = positive ? "bg-mint/25 text-tide" : "bg-ember/15 text-ember";

  return (
    <span className={clsx("inline-flex items-baseline gap-2 rounded-full px-2 py-0.5", tone)}>
      <span className="font-medium">{formatCurrency(dollars)}</span>
      {percent != null ? (
        <span className={clsx("text-xs", compact && "text-[11px]")}>{formatPercent(percent)}</span>
      ) : null}
    </span>
  );
}

function formatShares(value: number): string {
  if (!Number.isFinite(value)) return "--";
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
