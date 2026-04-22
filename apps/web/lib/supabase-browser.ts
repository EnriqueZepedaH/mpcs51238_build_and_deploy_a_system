"use client";

import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";

import { getClerkSupabaseAccessToken } from "./clerk-supabase-auth";
import { getPublicSupabaseEnv } from "./env";

export function useSupabaseBrowserClient() {
  const { session } = useSession();
  const env = getPublicSupabaseEnv();

  return useMemo(
    () =>
      createClient(env.url, env.publishableKey, {
        accessToken: async () => {
          if (!session) {
            return null;
          }

          return getClerkSupabaseAccessToken((options) => session.getToken(options));
        }
      }),
    [env.publishableKey, env.url, session]
  );
}
