import { z } from "zod";

const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string().nullish(),
  exchange: z.string().nullish(),
  currency: z.string().nullish(),
  type: z.string().nullish(),
  is_market_open: z.boolean().nullish(),
  datetime: z.string().nullish(),
  timestamp: z.number().nullish(),
  open: z.string().nullish(),
  high: z.string().nullish(),
  low: z.string().nullish(),
  close: z.string(),
  previous_close: z.string().nullish(),
  change: z.string().nullish(),
  percent_change: z.string().nullish(),
  volume: z.string().nullish(),
  fifty_two_week: z
    .object({
      high: z.string().nullish(),
      low: z.string().nullish()
    })
    .nullish()
});

export type NormalizedQuote = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  instrument_type: string | null;
  is_market_open: boolean | null;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previous_close: number | null;
  absolute_change: number | null;
  percent_change: number | null;
  volume: number | null;
  source_timestamp: string | null;
  raw_payload: Record<string, unknown>;
};

export function normalizeQuote(input: unknown): NormalizedQuote {
  const quote = quoteSchema.parse(input);

  return {
    symbol: quote.symbol.toUpperCase(),
    name: quote.name ?? null,
    exchange: quote.exchange ?? null,
    currency: quote.currency ?? null,
    instrument_type: quote.type ?? null,
    is_market_open: quote.is_market_open ?? null,
    price: toNumber(quote.close),
    open: toOptionalNumber(quote.open),
    high: toOptionalNumber(quote.high),
    low: toOptionalNumber(quote.low),
    previous_close: toOptionalNumber(quote.previous_close),
    absolute_change: toOptionalNumber(quote.change),
    percent_change: toOptionalNumber(quote.percent_change),
    volume: toOptionalInteger(quote.volume),
    source_timestamp: normalizeTimestamp(quote.datetime, quote.timestamp),
    raw_payload: quote as Record<string, unknown>
  };
}

function toNumber(value: string): number {
  const result = Number(value);
  if (Number.isNaN(result)) {
    throw new Error(`Expected numeric value, received ${value}`);
  }

  return result;
}

function toOptionalNumber(value: string | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  return toNumber(value);
}

function toOptionalInteger(value: string | null | undefined): number | null {
  const numeric = toOptionalNumber(value);
  return numeric == null ? null : Math.trunc(numeric);
}

function normalizeTimestamp(
  datetime: string | null | undefined,
  unixTimestamp: number | null | undefined
): string | null {
  if (datetime) {
    const isoLike = datetime.replace(" ", "T");
    return isoLike.endsWith("Z") ? isoLike : `${isoLike}Z`;
  }

  if (unixTimestamp) {
    return new Date(unixTimestamp * 1000).toISOString();
  }

  return null;
}

