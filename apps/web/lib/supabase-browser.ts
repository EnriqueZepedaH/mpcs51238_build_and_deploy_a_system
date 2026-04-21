"use client";

import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnv } from "./env";

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const env = getPublicSupabaseEnv();
  browserClient = createClient(env.url, env.anonKey);
  return browserClient;
}

