import { describe, expect, it } from "vitest";

import { isLikelyUsEquityOrEtfSymbol, normalizeSymbol } from "../symbols";

describe("symbol utilities", () => {
  it("normalizes symbols for consistent storage", () => {
    expect(normalizeSymbol(" aapl ")).toBe("AAPL");
  });

  it("accepts likely US stock and ETF symbols", () => {
    expect(isLikelyUsEquityOrEtfSymbol("AAPL")).toBe(true);
    expect(isLikelyUsEquityOrEtfSymbol("MSFT")).toBe(true);
    expect(isLikelyUsEquityOrEtfSymbol("BRK.B")).toBe(true);
  });

  it("rejects obviously invalid watchlist symbols", () => {
    expect(isLikelyUsEquityOrEtfSymbol("LOLLLLL")).toBe(false);
    expect(isLikelyUsEquityOrEtfSymbol("AAPL1")).toBe(false);
    expect(isLikelyUsEquityOrEtfSymbol("AA-PR")).toBe(false);
  });
});
