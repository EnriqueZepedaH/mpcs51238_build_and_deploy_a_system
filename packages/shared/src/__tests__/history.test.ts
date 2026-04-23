import { describe, expect, it } from "vitest";

import { buildHistoricalPerformancePoints } from "../history";

describe("buildHistoricalPerformancePoints", () => {
  it("computes price delta and percent return from a reference close", () => {
    const points = buildHistoricalPerformancePoints(
      [
        {
          trading_date: "2026-04-20",
          adjusted_close: 100,
          volume: 1000
        },
        {
          trading_date: "2026-04-21",
          adjusted_close: 125,
          volume: 1200
        }
      ],
      100
    );

    expect(points[0]?.price_delta).toBe(0);
    expect(points[0]?.percent_return).toBe(0);
    expect(points[1]?.price_delta).toBe(25);
    expect(points[1]?.percent_return).toBe(25);
  });
});
