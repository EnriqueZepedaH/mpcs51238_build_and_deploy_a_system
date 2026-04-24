import { describe, expect, it } from "vitest";

import { computeUnrealizedPnl, summarizePortfolio, type PortfolioLot } from "../portfolio";

function lot(partial: Partial<PortfolioLot> & Pick<PortfolioLot, "symbol" | "shares" | "cost_basis">): PortfolioLot {
  return {
    id: partial.id ?? "lot-id",
    clerk_user_id: partial.clerk_user_id ?? "user_1",
    symbol: partial.symbol,
    shares: partial.shares,
    cost_basis: partial.cost_basis,
    purchased_at: partial.purchased_at ?? "2026-04-01T00:00:00Z",
    note: partial.note ?? null,
    created_at: partial.created_at ?? "2026-04-01T00:00:00Z"
  };
}

describe("summarizePortfolio", () => {
  it("aggregates multiple lots of a symbol with weighted-average cost", () => {
    const lots = [
      lot({ id: "a", symbol: "AAPL", shares: 10, cost_basis: 100 }),
      lot({ id: "b", symbol: "AAPL", shares: 30, cost_basis: 200 })
    ];

    const [position] = summarizePortfolio(lots);

    expect(position).toBeDefined();
    expect(position?.symbol).toBe("AAPL");
    expect(position?.lotCount).toBe(2);
    expect(position?.totalShares).toBe(40);
    expect(position?.totalCost).toBe(10 * 100 + 30 * 200);
    expect(position?.weightedAvgCost).toBe((10 * 100 + 30 * 200) / 40);
  });

  it("returns one summary per distinct symbol, sorted alphabetically", () => {
    const summaries = summarizePortfolio([
      lot({ id: "1", symbol: "NVDA", shares: 2, cost_basis: 500 }),
      lot({ id: "2", symbol: "AAPL", shares: 1, cost_basis: 100 }),
      lot({ id: "3", symbol: "MSFT", shares: 3, cost_basis: 300 })
    ]);

    expect(summaries.map((s) => s.symbol)).toEqual(["AAPL", "MSFT", "NVDA"]);
  });

  it("returns an empty array when there are no lots", () => {
    expect(summarizePortfolio([])).toEqual([]);
  });
});

describe("computeUnrealizedPnl", () => {
  it("computes market value, dollar P&L, and percent P&L", () => {
    const result = computeUnrealizedPnl({ totalShares: 10, totalCost: 1000 }, 150);

    expect(result.marketValue).toBe(1500);
    expect(result.pnlDollars).toBe(500);
    expect(result.pnlPercent).toBe(50);
  });

  it("returns nulls when the current price is unknown", () => {
    const result = computeUnrealizedPnl({ totalShares: 10, totalCost: 1000 }, null);

    expect(result.marketValue).toBeNull();
    expect(result.pnlDollars).toBeNull();
    expect(result.pnlPercent).toBeNull();
  });

  it("avoids divide-by-zero when cost is zero", () => {
    const result = computeUnrealizedPnl({ totalShares: 5, totalCost: 0 }, 10);

    expect(result.marketValue).toBe(50);
    expect(result.pnlDollars).toBe(50);
    expect(result.pnlPercent).toBeNull();
  });
});
