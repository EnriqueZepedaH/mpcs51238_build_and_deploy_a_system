"use client";

import { useEffect, useMemo, useState } from "react";
import type { IngestionRunRecord } from "@market-pulse/shared";

import { useSupabaseBrowserClient } from "@/lib/supabase-browser";
import { OpsKpiStrip } from "@/components/observability/ops-kpi-strip";
import { RunTimeline } from "@/components/observability/run-timeline";
import { StaleSymbolsGrid } from "@/components/observability/stale-symbols-grid";

export type FreshnessRow = {
  symbol: string;
  name: string | null;
  last_ingested_at: string | null;
  watcher_count: number;
};

type ObservabilityClientProps = {
  initialRuns: IngestionRunRecord[];
  initialFreshness: FreshnessRow[];
  freshnessTargetSeconds: number;
};

const MAX_RUNS_KEPT = 50;

export function ObservabilityClient({
  initialRuns,
  initialFreshness,
  freshnessTargetSeconds
}: ObservabilityClientProps) {
  const [runs, setRuns] = useState<IngestionRunRecord[]>(initialRuns);
  const [freshness, setFreshness] = useState<FreshnessRow[]>(initialFreshness);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const { client: supabase, realtimeReady } = useSupabaseBrowserClient();

  useEffect(() => {
    const interval = window.setInterval(() => setClockMs(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!realtimeReady) return;

    const runChannel = supabase
      .channel("observability_runs_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ingestion_runs" },
        (payload: { eventType?: string; new: unknown; old: unknown }) => {
          const record = payload.new as IngestionRunRecord | null;
          if (!record?.id) return;

          setRuns((current) => {
            const existingIdx = current.findIndex((r) => r.id === record.id);
            if (existingIdx >= 0) {
              const next = [...current];
              next[existingIdx] = record;
              return next;
            }
            return [record, ...current].slice(0, MAX_RUNS_KEPT);
          });
        }
      )
      .subscribe();

    const quoteChannel = supabase
      .channel("observability_quotes_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes_current" },
        (payload: { new: unknown }) => {
          const record = payload.new as {
            symbol: string;
            name: string | null;
            last_ingested_at: string | null;
            watcher_count: number | null;
          };
          if (!record?.symbol) return;

          setFreshness((current) => {
            const row: FreshnessRow = {
              symbol: record.symbol,
              name: record.name ?? null,
              last_ingested_at: record.last_ingested_at ?? null,
              watcher_count: record.watcher_count ?? 0
            };
            const idx = current.findIndex((r) => r.symbol === row.symbol);
            if (idx >= 0) {
              const next = [...current];
              next[idx] = row;
              return next;
            }
            return [...current, row];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(runChannel);
      void supabase.removeChannel(quoteChannel);
    };
  }, [realtimeReady, supabase]);

  const latestRun = runs[0] ?? null;

  const stalestRow = useMemo(() => {
    let worst: FreshnessRow | null = null;
    let worstAge = -1;
    for (const row of freshness) {
      if (!row.last_ingested_at) continue;
      const age = clockMs - new Date(row.last_ingested_at).getTime();
      if (age > worstAge) {
        worstAge = age;
        worst = row;
      }
    }
    return { row: worst, ageMs: worstAge };
  }, [freshness, clockMs]);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.24em] text-tide/70">
          Pipeline health
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">
          Observability
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
          Live telemetry from the ingestion worker. Status, latency, throughput, and data
          freshness — updated as runs complete.
        </p>
      </div>

      <OpsKpiStrip
        runs={runs}
        latestRun={latestRun}
        stalestRow={stalestRow.row}
        stalestAgeMs={stalestRow.ageMs}
        clockMs={clockMs}
      />

      <RunTimeline runs={runs} clockMs={clockMs} />

      <StaleSymbolsGrid
        rows={freshness}
        freshnessTargetSeconds={freshnessTargetSeconds}
        clockMs={clockMs}
      />
    </div>
  );
}
