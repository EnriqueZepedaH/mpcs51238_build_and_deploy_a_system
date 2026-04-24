function getRequiredValue(name: string, value: string | undefined): string {

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return {
    // Next.js only exposes NEXT_PUBLIC_* env vars to client bundles when they
    // are referenced statically. Dynamic process.env[name] lookups break in the browser.
    url: getRequiredValue("NEXT_PUBLIC_SUPABASE_URL", url),
    publishableKey: getRequiredValue(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      publishableKey
    )
  };
}

export function getFreshnessTargetSeconds(): number {
  return Number(process.env.FRESHNESS_TARGET_SECONDS ?? "1800");
}

export function getMaxWatchlistSize(): number {
  return Number(process.env.MAX_WATCHLIST_SIZE ?? "15");
}

export function getMaxPortfolioSymbols(): number {
  return Number(process.env.MAX_PORTFOLIO_SYMBOLS ?? "15");
}
