import { afterEach, describe, expect, it, vi } from "vitest";

import { TwelveDataClient } from "../lib/twelve-data.js";

function stubFetch(body: unknown, status = 200) {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
}

describe("TwelveDataClient.fetchQuotes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const client = new TwelveDataClient({
    apiKey: "test",
    baseUrl: "https://api.twelvedata.com"
  });

  it("returns normalized quotes for a batch object payload", async () => {
    stubFetch({
      AAPL: {
        symbol: "AAPL",
        close: "100.00",
        datetime: "2026-04-23 14:30:00"
      },
      MSFT: {
        symbol: "MSFT",
        close: "200.00",
        datetime: "2026-04-23 14:30:00"
      }
    });

    const quotes = await client.fetchQuotes(["AAPL", "MSFT"]);

    expect(quotes.map((q) => q.symbol)).toEqual(["AAPL", "MSFT"]);
  });

  it("throws on a top-level error envelope (e.g., quota exhausted)", async () => {
    stubFetch({
      code: 429,
      status: "error",
      message: "You have run out of API credits for the current minute"
    });

    await expect(client.fetchQuotes(["AAPL"])).rejects.toThrow(/code=429/);
  });

  it("throws when every symbol in a batch response is an error envelope", async () => {
    stubFetch({
      BADX: { code: 400, status: "error", message: "symbol not found" },
      BADY: { code: 400, status: "error", message: "symbol not found" }
    });

    await expect(client.fetchQuotes(["BADX", "BADY"])).rejects.toThrow(/symbol not found/);
  });

  it("keeps valid quotes in a batch even when some symbols error out", async () => {
    stubFetch({
      AAPL: {
        symbol: "AAPL",
        close: "100.00",
        datetime: "2026-04-23 14:30:00"
      },
      BADX: { code: 400, status: "error", message: "symbol not found" }
    });

    const quotes = await client.fetchQuotes(["AAPL", "BADX"]);

    expect(quotes.map((q) => q.symbol)).toEqual(["AAPL"]);
  });
});
