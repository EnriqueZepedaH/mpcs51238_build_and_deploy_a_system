import { normalizeQuote, type NormalizedQuote } from "./normalize.js";

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

      if (isErrorEnvelope(maybeRecord)) {
        throw new Error(describeTwelveDataError(maybeRecord));
      }

      if ("symbol" in maybeRecord) {
        return [maybeRecord];
      }

      const entries = Object.entries(maybeRecord).filter(
        (entry): entry is [string, Record<string, unknown>] => {
          const [, value] = entry;
          return Boolean(value) && typeof value === "object";
        }
      );

      const perSymbolErrors = entries.filter(([, value]) => isErrorEnvelope(value));
      const quoteEntries = entries.filter(
        ([, value]) => !isErrorEnvelope(value) && "symbol" in value
      );

      const firstError = perSymbolErrors[0];
      if (quoteEntries.length === 0 && firstError) {
        const [firstSymbol, firstErrorEnvelope] = firstError;
        throw new Error(
          `${describeTwelveDataError(firstErrorEnvelope)} (symbol=${firstSymbol}, total_failed=${perSymbolErrors.length})`
        );
      }

      return quoteEntries.map(([, value]) => value);
    }

    return [];
  }
}

function isErrorEnvelope(value: Record<string, unknown>): boolean {
  return value.status === "error" || typeof value.code === "number";
}

function describeTwelveDataError(value: Record<string, unknown>): string {
  const code = typeof value.code === "number" ? value.code : "unknown";
  const message = typeof value.message === "string" ? value.message : "Twelve Data error";
  return `Twelve Data error (code=${code}): ${message}`;
}
