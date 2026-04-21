import { normalizeQuote, type NormalizedQuote } from "./normalize";

type TwelveDataClientOptions = {
  apiKey: string;
  baseUrl: string;
};

export class TwelveDataClient {
  constructor(private readonly options: TwelveDataClientOptions) {}

  async fetchQuotes(symbols: string[]): Promise<NormalizedQuote[]> {
    if (symbols.length === 0) {
      return [];
    }

    const url = new URL("/quote", this.options.baseUrl);
    url.searchParams.set("symbol", symbols.join(","));
    url.searchParams.set("apikey", this.options.apiKey);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Twelve Data request failed (${response.status}): ${message}`);
    }

    const payload = (await response.json()) as unknown;
    const quotePayloads = this.unwrapBatchPayload(payload);

    return quotePayloads.map(normalizeQuote);
  }

  private unwrapBatchPayload(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === "object") {
      const maybeRecord = payload as Record<string, unknown>;

      if ("symbol" in maybeRecord) {
        return [maybeRecord];
      }

      return Object.values(maybeRecord).filter(
        (value): value is Record<string, unknown> => {
          if (!value || typeof value !== "object") {
            return false;
          }

          return "symbol" in value;
        }
      );
    }

    return [];
  }
}
