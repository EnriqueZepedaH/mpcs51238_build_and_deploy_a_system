import type { IngestionRunRecord } from "@market-pulse/shared";

import { ObservabilityClient } from "@/components/observability-client";
import type { FreshnessRow } from "@/components/observability-client";
import { getFreshnessTargetSeconds } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ObservabilityPage() {
  const supabase = await getSupabaseServerClient();

  const [{ data: runs }, { data: freshness }] = await Promise.all([
    supabase
      .from("ingestion_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("quotes_current")
      .select("symbol,name,last_ingested_at,watcher_count")
      .order("last_ingested_at", { ascending: true, nullsFirst: true })
  ]);

  return (
    <ObservabilityClient
      initialRuns={(runs ?? []) as IngestionRunRecord[]}
      initialFreshness={(freshness ?? []) as FreshnessRow[]}
      freshnessTargetSeconds={getFreshnessTargetSeconds()}
    />
  );
}
