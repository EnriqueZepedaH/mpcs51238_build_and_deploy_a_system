"use client";

import { useMemo } from "react";
import clsx from "clsx";
import type { QuoteRecord } from "@market-pulse/shared";

import { formatCurrency } from "@/lib/format";

type TickerTapeProps = {
  symbols: string[];
  quotes: Record<string, QuoteRecord>;
};

export function TickerTape({ symbols, quotes }: TickerTapeProps) {
  const items = useMemo(
    () =>
      symbols
        .map((symbol) => quotes[symbol])
        .filter((q): q is QuoteRecord => Boolean(q)),
    [symbols, quotes]
  );

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div className="ticker-tape rounded-full border border-ink/10 bg-ink/95 py-2.5 text-white">
      <div className="ticker-tape__track gap-10 px-6">
        {doubled.map((quote, i) => (
          <TickerItem key={`${quote.symbol}-${i}`} quote={quote} />
        ))}
      </div>
    </div>
  );
}

function TickerItem({ quote }: { quote: QuoteRecord }) {
  const pct = quote.percent_change ?? 0;
  const up = pct >= 0;
  return (
    <div className="flex shrink-0 items-baseline gap-3 font-display text-sm">
      <span className="font-semibold tracking-[0.08em] text-white">{quote.symbol}</span>
      <span className="tabular-nums text-white/85">{formatCurrency(quote.price)}</span>
      <span
        className={clsx(
          "inline-flex items-center gap-1 tabular-nums",
          up ? "text-emerald-400" : "text-rose-400"
        )}
      >
        <span aria-hidden>{up ? "▲" : "▼"}</span>
        {pct >= 0 ? "+" : ""}
        {pct.toFixed(2)}%
      </span>
    </div>
  );
}
