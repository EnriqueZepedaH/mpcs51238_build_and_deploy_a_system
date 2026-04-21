import { describe, expect, it } from "vitest";

import {
  getFreshnessStatus,
  getQuoteAgeSeconds,
  MAX_DEGRADED_MULTIPLIER
} from "../quotes";

describe("freshness helpers", () => {
  it("marks a recent quote as fresh", () => {
    const now = new Date("2026-04-21T20:00:00Z").getTime();
    const result = getFreshnessStatus("2026-04-21T19:58:30Z", 120, now);

    expect(result).toBe("fresh");
  });

  it("marks an aging quote as degraded", () => {
    const now = new Date("2026-04-21T20:00:00Z").getTime();
    const result = getFreshnessStatus("2026-04-21T19:55:30Z", 120, now);

    expect(result).toBe("degraded");
  });

  it("marks a very old quote as stale", () => {
    const now = new Date("2026-04-21T20:00:00Z").getTime();
    const result = getFreshnessStatus(
      "2026-04-21T19:45:00Z",
      120,
      now
    );

    expect(result).toBe("stale");
  });

  it("computes quote age in seconds", () => {
    const now = new Date("2026-04-21T20:00:00Z").getTime();
    const result = getQuoteAgeSeconds("2026-04-21T19:59:10Z", now);

    expect(result).toBe(50);
  });

  it("keeps degraded boundary below stale", () => {
    expect(MAX_DEGRADED_MULTIPLIER).toBeGreaterThan(1);
  });
});

