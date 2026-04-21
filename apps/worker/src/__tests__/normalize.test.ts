import { describe, expect, it } from "vitest";

import { normalizeQuote } from "../lib/normalize";

describe("normalizeQuote", () => {
  it("normalizes Twelve Data quote payloads", () => {
    const normalized = normalizeQuote({
      symbol: "aapl",
      name: "Apple Inc",
      exchange: "NASDAQ",
      currency: "USD",
      type: "Common Stock",
      is_market_open: true,
      datetime: "2026-04-21 14:33:00",
      open: "193.10",
      high: "194.01",
      low: "192.82",
      close: "193.76",
      previous_close: "192.44",
      change: "1.32",
      percent_change: "0.69",
      volume: "1029482"
    });

    expect(normalized.symbol).toBe("AAPL");
    expect(normalized.price).toBe(193.76);
    expect(normalized.volume).toBe(1029482);
    expect(normalized.source_timestamp).toBe("2026-04-21T14:33:00Z");
  });
});

