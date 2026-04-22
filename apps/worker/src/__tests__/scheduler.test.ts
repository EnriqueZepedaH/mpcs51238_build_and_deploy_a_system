import { describe, expect, it } from "vitest";

import { rankSymbolsForPolling } from "../lib/scheduler.js";

describe("rankSymbolsForPolling", () => {
  it("prioritizes watcher count before age", () => {
    const selected = rankSymbolsForPolling(
      [
        { symbol: "ZZZ", watcherCount: 1, lastIngestedAt: "2026-04-21T10:00:00Z" },
        { symbol: "AAPL", watcherCount: 3, lastIngestedAt: "2026-04-21T19:59:00Z" }
      ],
      1,
      new Date("2026-04-21T20:00:00Z").getTime()
    );

    expect(selected[0]?.symbol).toBe("AAPL");
  });

  it("prioritizes unseen symbols next", () => {
    const selected = rankSymbolsForPolling(
      [
        { symbol: "MSFT", watcherCount: 2, lastIngestedAt: "2026-04-21T19:59:00Z" },
        { symbol: "NVDA", watcherCount: 2, lastIngestedAt: null }
      ],
      2,
      new Date("2026-04-21T20:00:00Z").getTime()
    );

    expect(selected[0]?.symbol).toBe("NVDA");
  });
});
