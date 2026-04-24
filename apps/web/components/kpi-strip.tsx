"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Activity, ArrowDownRight, ArrowUpRight, Eye, Minus } from "lucide-react";
import {
  computeUnrealizedPnl,
  getFreshnessStatus,
  summarizePortfolio,
  type IngestionRunRecord,
  type PortfolioLot,
  type QuoteRecord
} from "@market-pulse/shared";

import { formatCurrency } from "@/lib/format";

import type { HistoryPoint } from "@/components/dashboard-client";

type KpiStripProps = {
  lots: PortfolioLot[];
  quotes: Record<string, QuoteRecord>;
  history: Record<string, HistoryPoint[]>;
  watchlistCount: number;
  latestRun: IngestionRunRecord | null;
  freshnessTargetSeconds: number;
  clockMs: number;
};

const SPARK_POINTS = 48;

export function KpiStrip({
  lots,
  quotes,
  history,
  watchlistCount,
  latestRun,
  freshnessTargetSeconds,
  clockMs
}: KpiStripProps) {
  const positions = summarizePortfolio(lots);

  let totalMarketValue = 0;
  let totalCost = 0;
  let totalMarketValueKnown = true;

  for (const position of positions) {
    totalCost += position.totalCost;
    const price = quotes[position.symbol]?.price ?? null;
    const { marketValue } = computeUnrealizedPnl(position, price);
    if (marketValue == null) {
      totalMarketValueKnown = false;
    } else {
      totalMarketValue += marketValue;
    }
  }

  const pnlDollars = totalMarketValueKnown ? totalMarketValue - totalCost : null;
  const pnlPercent =
    totalMarketValueKnown && totalCost > 0 ? ((totalMarketValue - totalCost) / totalCost) * 100 : null;

  const portfolioIndex = useMemo(
    () => buildPortfolioIndex(positions, history),
    [positions, history]
  );

  const freshestQuote = Object.values(quotes).reduce<string | null>((acc, quote) => {
    if (!quote.last_ingested_at) return acc;
    if (!acc) return quote.last_ingested_at;
    return quote.last_ingested_at > acc ? quote.last_ingested_at : acc;
  }, null);

  const freshness = getFreshnessStatus(freshestQuote, freshnessTargetSeconds, clockMs);
  const pipelineLabel = latestRun?.status ?? "Idle";
  const pipelineDot =
    freshness === "fresh"
      ? "bg-emerald-500"
      : freshness === "degraded"
        ? "bg-amber-400"
        : "bg-rose-500";

  const distinctPortfolioSymbols = positions.length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <HeroTile
        marketValue={totalMarketValueKnown ? totalMarketValue : null}
        pnlDollars={pnlDollars}
        pnlPercent={pnlPercent}
        positionsCount={positions.length}
        lotsCount={lots.length}
        series={portfolioIndex}
      />

      <Tile
        icon={<Eye className="h-4 w-4" />}
        label="Symbols tracked"
        value={String(watchlistCount + distinctPortfolioSymbols)}
        hint={`${watchlistCount} watchlist · ${distinctPortfolioSymbols} portfolio`}
      />

      <Tile
        icon={<Activity className="h-4 w-4" />}
        label="Pipeline"
        value={capitalize(pipelineLabel)}
        valueClassName={
          pipelineLabel === "error"
            ? "text-rose-600"
            : pipelineLabel === "partial"
              ? "text-amber-600"
              : pipelineLabel === "running"
                ? "text-tide"
                : "text-ink"
        }
        hint={
          <span className="flex items-center gap-2">
            <span className={clsx("h-2 w-2 rounded-full", pipelineDot)} />
            {latestRun
              ? `${latestRun.symbols_polled}/${latestRun.symbols_considered} polled`
              : "Worker idle"}
          </span>
        }
      />
    </div>
  );
}

function HeroTile({
  marketValue,
  pnlDollars,
  pnlPercent,
  positionsCount,
  lotsCount,
  series
}: {
  marketValue: number | null;
  pnlDollars: number | null;
  pnlPercent: number | null;
  positionsCount: number;
  lotsCount: number;
  series: number[];
}) {
  const up = (pnlDollars ?? 0) >= 0;
  const flat = pnlDollars == null || Math.abs(pnlDollars) < 0.01;
  const accent = flat ? "stroke-ink/40" : up ? "stroke-emerald-500" : "stroke-rose-500";
  const accentFill = flat
    ? "url(#hero-fill-neutral)"
    : up
      ? "url(#hero-fill-up)"
      : "url(#hero-fill-down)";

  return (
    <article className="panel relative col-span-1 flex min-h-[11rem] flex-col justify-between overflow-hidden p-6 lg:col-span-2">
      <HeroSparkline series={series} accent={accent} accentFill={accentFill} />
      <div className="relative flex items-center justify-between">
        <p className="font-display text-xs uppercase tracking-[0.24em] text-tide/70">
          Portfolio
        </p>
        <span className="rounded-full border border-ink/10 bg-white/70 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.18em] text-ink/55">
          {positionsCount === 0
            ? "No positions"
            : `${positionsCount} positions · ${lotsCount} lots`}
        </span>
      </div>
      <div className="relative mt-2">
        <p className="font-display text-5xl font-semibold tracking-tight text-ink md:text-6xl">
          {marketValue == null ? (
            <span className="text-ink/40">—</span>
          ) : (
            <AnimatedCurrency value={marketValue} />
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <PnlBadge dollars={pnlDollars} percent={pnlPercent} flat={flat} up={up} />
          {pnlPercent != null ? (
            <span className="text-xs uppercase tracking-[0.18em] text-ink/45">
              Unrealized P&amp;L
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PnlBadge({
  dollars,
  percent,
  flat,
  up
}: {
  dollars: number | null;
  percent: number | null;
  flat: boolean;
  up: boolean;
}) {
  if (dollars == null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/70 px-3 py-1 text-sm text-ink/50">
        <Minus className="h-3.5 w-3.5" />
        Awaiting quotes
      </span>
    );
  }

  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = flat
    ? "text-ink/60 bg-ink/5 border-ink/10"
    : up
      ? "text-emerald-700 bg-emerald-500/12 border-emerald-500/25"
      : "text-rose-700 bg-rose-500/12 border-rose-500/25";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-base font-semibold tabular-nums",
        color
      )}
    >
      <Icon className="h-4 w-4" />
      <AnimatedCurrency value={dollars} signed />
      {percent != null ? (
        <span className="text-sm font-medium opacity-75">
          ({percent >= 0 ? "+" : ""}
          {percent.toFixed(2)}%)
        </span>
      ) : null}
    </span>
  );
}

function HeroSparkline({
  series,
  accent,
  accentFill
}: {
  series: number[];
  accent: string;
  accentFill: string;
}) {
  if (series.length < 2) {
    return null;
  }

  const width = 600;
  const height = 120;
  const padding = 6;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (series.length - 1);

  const points = series.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + (height - padding * 2) * (1 - (v - min) / range);
    return { x, y };
  });

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const area = firstPoint && lastPoint
    ? `${line} L${lastPoint.x.toFixed(1)},${height - padding} L${firstPoint.x.toFixed(1)},${height - padding} Z`
    : line;

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="hero-fill-up" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hero-fill-down" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hero-fill-neutral" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0d3b66" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#0d3b66" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={accentFill} stroke="none" />
      <path
        d={line}
        fill="none"
        className={accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Tile({
  icon,
  label,
  value,
  valueClassName,
  hint
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  hint?: React.ReactNode;
}) {
  return (
    <article className="panel flex flex-col gap-2 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-tide/70">
        <span className="text-tide">{icon}</span>
        <span>{label}</span>
      </div>
      <p className={clsx("font-display text-3xl text-ink", valueClassName)}>{value}</p>
      {hint ? <div className="text-sm text-ink/60">{hint}</div> : null}
    </article>
  );
}

function AnimatedCurrency({ value, signed }: { value: number; signed?: boolean }) {
  const [displayed, setDisplayed] = useState(value);
  const fromRef = useRef(value);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      fromRef.current = 0;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplayed(to);
      return;
    }
    const durationMs = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    fromRef.current = to;
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const formatted = formatCurrency(displayed);
  if (!signed) return <>{formatted}</>;
  if (displayed >= 0 && !formatted.startsWith("-")) return <>+{formatted}</>;
  return <>{formatted}</>;
}

function buildPortfolioIndex(
  positions: ReturnType<typeof summarizePortfolio>,
  history: Record<string, HistoryPoint[]>
): number[] {
  if (positions.length === 0) return [];

  const totalShares = new Map(positions.map((p) => [p.symbol, p.totalShares]));
  const symbolsWithData = positions.filter(
    (p) => (history[p.symbol]?.length ?? 0) >= 2
  );
  if (symbolsWithData.length === 0) return [];

  const n = Math.min(
    SPARK_POINTS,
    ...symbolsWithData.map((p) => history[p.symbol]!.length)
  );

  const series: number[] = [];
  for (let i = 0; i < n; i++) {
    let value = 0;
    for (const position of symbolsWithData) {
      const seriesForSymbol = history[position.symbol]!;
      const offset = seriesForSymbol.length - n + i;
      const point = seriesForSymbol[offset];
      if (!point) continue;
      const shares = totalShares.get(position.symbol) ?? 0;
      value += shares * point.price;
    }
    series.push(value);
  }
  return series;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
