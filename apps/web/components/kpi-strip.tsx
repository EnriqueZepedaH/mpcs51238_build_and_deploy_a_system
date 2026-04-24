"use client";

import clsx from "clsx";
import { Activity, Briefcase, Eye, TrendingDown, TrendingUp } from "lucide-react";
import {
  computeUnrealizedPnl,
  getFreshnessStatus,
  summarizePortfolio,
  type IngestionRunRecord,
  type PortfolioLot,
  type QuoteRecord
} from "@market-pulse/shared";

import { formatCurrency, formatPercent } from "@/lib/format";

type KpiStripProps = {
  lots: PortfolioLot[];
  quotes: Record<string, QuoteRecord>;
  watchlistCount: number;
  latestRun: IngestionRunRecord | null;
  freshnessTargetSeconds: number;
  clockMs: number;
};

export function KpiStrip({
  lots,
  quotes,
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

  const freshestQuote = Object.values(quotes).reduce<string | null>((acc, quote) => {
    if (!quote.last_ingested_at) return acc;
    if (!acc) return quote.last_ingested_at;
    return quote.last_ingested_at > acc ? quote.last_ingested_at : acc;
  }, null);

  const freshness = getFreshnessStatus(freshestQuote, freshnessTargetSeconds, clockMs);
  const pipelineLabel = latestRun?.status ?? "No runs";
  const pipelineDot =
    freshness === "fresh" ? "bg-mint" : freshness === "degraded" ? "bg-amber-400" : "bg-ember";

  const distinctPortfolioSymbols = positions.length;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <KpiTile
        icon={<Briefcase className="h-4 w-4 text-tide" />}
        label="Portfolio value"
        value={totalMarketValueKnown ? formatCurrency(totalMarketValue) : "--"}
        hint={positions.length === 0 ? "No positions yet" : `${positions.length} positions · ${lots.length} lots`}
      />
      <KpiTile
        icon={
          pnlDollars != null && pnlDollars < 0 ? (
            <TrendingDown className="h-4 w-4 text-ember" />
          ) : (
            <TrendingUp className="h-4 w-4 text-tide" />
          )
        }
        label="Unrealized P&L"
        value={formatCurrency(pnlDollars)}
        valueClassName={clsx(
          pnlDollars == null
            ? "text-ink/60"
            : pnlDollars >= 0
              ? "text-tide"
              : "text-ember"
        )}
        hint={pnlPercent == null ? "Awaiting quotes" : formatPercent(pnlPercent)}
      />
      <KpiTile
        icon={<Eye className="h-4 w-4 text-tide" />}
        label="Symbols tracked"
        value={String(watchlistCount + distinctPortfolioSymbols)}
        hint={`${watchlistCount} watchlist · ${distinctPortfolioSymbols} portfolio`}
      />
      <KpiTile
        icon={<Activity className="h-4 w-4 text-tide" />}
        label="Pipeline"
        value={pipelineLabel}
        valueClassName="capitalize"
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

function KpiTile({
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
        {icon}
        <span>{label}</span>
      </div>
      <p className={clsx("font-display text-3xl text-ink", valueClassName)}>{value}</p>
      {hint ? <p className="text-sm text-ink/60">{hint}</p> : null}
    </article>
  );
}
