"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";

import { getClerkSupabaseAccessToken } from "./clerk-supabase-auth";
import { getPublicSupabaseEnv } from "./env";

export function useSupabaseBrowserClient() {
  const { session } = useSession();
  const env = getPublicSupabaseEnv();
  const [realtimeReady, setRealtimeReady] = useState(false);

  const client = useMemo(
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

  useEffect(() => {
    let cancelled = false;
    setRealtimeReady(false);

    async function syncRealtimeAuth() {
      if (!session) {
        setRealtimeReady(true);
        return;
      }

      const token = await getClerkSupabaseAccessToken((options) => session.getToken(options));
      if (!token || cancelled) {
        return;
      }

      client.realtime.setAuth(token);
      if (!cancelled) {
        setRealtimeReady(true);
      }
    }

    void syncRealtimeAuth();

    return () => {
      cancelled = true;
    };
  }, [client, session]);

  return {
    client,
    realtimeReady
  };
}
