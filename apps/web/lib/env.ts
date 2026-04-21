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
    anonKey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  };
}

export function getSupabaseServiceEnv() {
  return {
    url: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  };
}

export function getFreshnessTargetSeconds(): number {
  return Number(process.env.FRESHNESS_TARGET_SECONDS ?? "120");
}

export function getMaxWatchlistSize(): number {
  return Number(process.env.MAX_WATCHLIST_SIZE ?? "15");
}

