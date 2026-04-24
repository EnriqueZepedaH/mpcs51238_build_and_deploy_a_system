export type PortfolioLot = {
  id: string;
  clerk_user_id: string;
  symbol: string;
  shares: number;
  cost_basis: number;
  purchased_at: string;
  note: string | null;
  created_at: string;
};

export type PortfolioPositionSummary = {
  symbol: string;
  lotCount: number;
  totalShares: number;
  totalCost: number;
  weightedAvgCost: number;
};

export function summarizePortfolio(lots: PortfolioLot[]): PortfolioPositionSummary[] {
  const bySymbol = new Map<string, { lotCount: number; totalShares: number; totalCost: number }>();

  for (const lot of lots) {
    const entry = bySymbol.get(lot.symbol) ?? { lotCount: 0, totalShares: 0, totalCost: 0 };
    entry.lotCount += 1;
    entry.totalShares += Number(lot.shares);
    entry.totalCost += Number(lot.shares) * Number(lot.cost_basis);
    bySymbol.set(lot.symbol, entry);
  }

  return [...bySymbol.entries()]
    .map(([symbol, entry]) => ({
      symbol,
      lotCount: entry.lotCount,
      totalShares: entry.totalShares,
      totalCost: entry.totalCost,
      weightedAvgCost: entry.totalShares > 0 ? entry.totalCost / entry.totalShares : 0
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function computeUnrealizedPnl(
  position: Pick<PortfolioPositionSummary, "totalShares" | "totalCost">,
  currentPrice: number | null | undefined
): { marketValue: number | null; pnlDollars: number | null; pnlPercent: number | null } {
  if (currentPrice == null || !Number.isFinite(currentPrice)) {
    return { marketValue: null, pnlDollars: null, pnlPercent: null };
  }

  const marketValue = position.totalShares * currentPrice;
  const pnlDollars = marketValue - position.totalCost;
  const pnlPercent = position.totalCost > 0 ? (pnlDollars / position.totalCost) * 100 : null;

  return { marketValue, pnlDollars, pnlPercent };
}
