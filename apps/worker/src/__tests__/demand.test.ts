import { describe, expect, it } from "vitest";

import { mergeDemandSources } from "../lib/supabase.js";

describe("mergeDemandSources", () => {
  it("counts each (user, symbol) pair once, regardless of how many lots a user holds", () => {
    const result = mergeDemandSources(
      [{ clerk_user_id: "u1", symbol: "AAPL" }],
      [
        { clerk_user_id: "u1", symbol: "AAPL" },
        { clerk_user_id: "u1", symbol: "AAPL" },
        { clerk_user_id: "u2", symbol: "AAPL" }
      ],
      []
    );

    const aapl = result.find((row) => row.symbol === "AAPL");
    expect(aapl?.watcherCount).toBe(2);
  });

  it("unions symbols from watchlist and portfolio sources", () => {
    const result = mergeDemandSources(
      [{ clerk_user_id: "u1", symbol: "AAPL" }],
      [{ clerk_user_id: "u1", symbol: "NVDA" }],
      []
    );

    expect(result.map((r) => r.symbol).sort()).toEqual(["AAPL", "NVDA"]);
  });

  it("attaches lastIngestedAt for symbols that already exist in quotes_current", () => {
    const result = mergeDemandSources(
      [{ clerk_user_id: "u1", symbol: "AAPL" }],
      [],
      [{ symbol: "AAPL", last_ingested_at: "2026-04-23T12:00:00Z" }]
    );

    expect(result[0]?.lastIngestedAt).toBe("2026-04-23T12:00:00Z");
  });

  it("returns lastIngestedAt as null for symbols never polled", () => {
    const result = mergeDemandSources(
      [{ clerk_user_id: "u1", symbol: "AAPL" }],
      [],
      []
    );

    expect(result[0]?.lastIngestedAt).toBeNull();
  });
});
