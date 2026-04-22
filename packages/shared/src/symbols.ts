const US_EQUITY_ETF_SYMBOL_PATTERN = /^(?:[A-Z]{1,5}|[A-Z]{1,4}[.-][A-Z])$/;

export function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function isLikelyUsEquityOrEtfSymbol(value: string): boolean {
  return US_EQUITY_ETF_SYMBOL_PATTERN.test(normalizeSymbol(value));
}

