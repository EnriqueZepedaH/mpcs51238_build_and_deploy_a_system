function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPublicSupabaseEnv() {
  return {
    url: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  };
}

export function getFreshnessTargetSeconds(): number {
  return Number(process.env.FRESHNESS_TARGET_SECONDS ?? "120");
}

export function getMaxWatchlistSize(): number {
  return Number(process.env.MAX_WATCHLIST_SIZE ?? "15");
}
