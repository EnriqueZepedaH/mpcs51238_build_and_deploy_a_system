import "server-only";

import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

import { getClerkSupabaseAccessTokenOrThrow } from "./clerk-supabase-auth";
import { getPublicSupabaseEnv } from "./env";

export async function getSupabaseServerClient() {
  const env = getPublicSupabaseEnv();
  const { getToken } = await auth();
  const accessToken = await getClerkSupabaseAccessTokenOrThrow(getToken);

  return createClient(env.url, env.publishableKey, {
    accessToken: async () => accessToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
