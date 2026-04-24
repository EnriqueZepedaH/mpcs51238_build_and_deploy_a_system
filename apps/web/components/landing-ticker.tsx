"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type TickerRow = {
  symbol: string;
  name: string;
  price: number;
  dayChangePct: number;
  spark: number[];
  flash: "up" | "down" | null;
};

const INITIAL_ROWS: TickerRow[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 227.48,
    dayChangePct: 1.24,
    spark: [48, 46, 49, 51, 50, 52, 54, 53, 55, 57, 56, 58, 57, 59, 60, 62, 61, 63, 64, 65, 64, 66, 67, 68],
    flash: null
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    price: 438.92,
    dayChangePct: -0.38,
    spark: [62, 63, 61, 60, 61, 59, 58, 57, 58, 56, 55, 57, 56, 54, 55, 53, 52, 54, 53, 51, 52, 50, 51, 49],
    flash: null
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    price: 142.17,
    dayChangePct: 2.85,
    spark: [42, 44, 43, 46, 48, 47, 50, 52, 51, 54, 56, 55, 58, 60, 59, 62, 64, 63, 66, 68, 67, 70, 72, 74],
    flash: null
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    price: 176.54,
    dayChangePct: 0.62,
    spark: [54, 55, 53, 54, 56, 55, 57, 56, 58, 57, 58, 56, 57, 58, 59, 58, 60, 59, 60, 61, 60, 62, 61, 62],
    flash: null
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    price: 248.31,
    dayChangePct: -1.12,
    spark: [66, 67, 65, 64, 66, 63, 62, 64, 61, 60, 62, 59, 58, 60, 57, 56, 58, 55, 54, 56, 53, 52, 54, 51],
    flash: null
  }
];

function sparkPath(values: number[], width: number, height: number): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function LandingTicker() {
  const [rows, setRows] = useState<TickerRow[]>(INITIAL_ROWS);
  const [mounted, setMounted] = useState(false);
  const clearTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      setRows((prev) => {
        const idx = Math.floor(Math.random() * prev.length);
        const direction: "up" | "down" = Math.random() > 0.5 ? "up" : "down";
        const deltaPct = (direction === "up" ? 1 : -1) * (0.05 + Math.random() * 0.18);

        return prev.map((row, i) => {
          if (i !== idx) return row.flash ? { ...row, flash: null } : row;
          const newPrice = Math.max(1, row.price * (1 + deltaPct / 100));
          const lastSpark = row.spark[row.spark.length - 1] ?? 50;
          const nextSpark = Math.max(10, Math.min(90, lastSpark + deltaPct * 4));
          return {
            ...row,
            price: newPrice,
            dayChangePct: row.dayChangePct + deltaPct,
            spark: [...row.spark.slice(1), nextSpark],
            flash: direction
          };
        });
      });

      const timeout = setTimeout(() => {
        setRows((prev) => prev.map((r) => (r.flash ? { ...r, flash: null } : r)));
      }, 650);
      clearTimeoutsRef.current.push(timeout);
    }, 1800);

    return () => {
      clearInterval(interval);
      clearTimeoutsRef.current.forEach(clearTimeout);
      clearTimeoutsRef.current = [];
    };
  }, [mounted]);

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/70">Live</span>
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-tide/70">Watchlist preview</span>
      </div>
      <ul className="divide-y divide-ink/5">
        {rows.map((row) => {
          const up = row.dayChangePct >= 0;
          return (
            <li
              key={row.symbol}
              className={clsx(
                "flex items-center gap-4 px-5 py-3 transition-colors duration-700",
                row.flash === "up" && "bg-emerald-500/10",
                row.flash === "down" && "bg-rose-500/10"
              )}
            >
              <div className="flex w-24 flex-col">
                <span className="font-display text-sm font-semibold text-ink">{row.symbol}</span>
                <span className="text-[11px] text-ink/50">{row.name}</span>
              </div>
              <svg viewBox="0 0 100 28" className="h-7 flex-1" preserveAspectRatio="none">
                <path
                  d={sparkPath(row.spark, 100, 28)}
                  fill="none"
                  stroke={up ? "#10b981" : "#f43f5e"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex w-24 flex-col items-end">
                <span className="font-display text-sm tabular-nums text-ink">
                  $
                  {row.price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
                <span
                  className={clsx(
                    "text-xs tabular-nums",
                    up ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {up ? "+" : ""}
                  {row.dayChangePct.toFixed(2)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
