"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CircleDashed,
  Coins,
  Gauge,
  Timer,
  XCircle
} from "lucide-react";
import type { IngestionRunRecord } from "@market-pulse/shared";

import type { FreshnessRow } from "@/components/observability-client";

type OpsKpiStripProps = {
  runs: IngestionRunRecord[];
  latestRun: IngestionRunRecord | null;
  stalestRow: FreshnessRow | null;
  stalestAgeMs: number;
  clockMs: number;
};

const SUCCESS_WINDOW = 20;
const CREDITS_WINDOW_MS = 24 * 60 * 60 * 1000;

export function OpsKpiStrip({
  runs,
  latestRun,
  stalestRow,
  stalestAgeMs,
  clockMs
}: OpsKpiStripProps) {
  const latestDurationMs = getRunDurationMs(latestRun);
  const latestStatus = latestRun?.status ?? "idle";

  const window = runs.slice(0, SUCCESS_WINDOW);
  const successCount = window.filter((r) => r.status === "success").length;
  const successRate = window.length > 0 ? successCount / window.length : null;

  const creditsWindowCutoff = clockMs - CREDITS_WINDOW_MS;
  const creditsUsed = runs.reduce((sum, r) => {
    const startedMs = new Date(r.started_at).getTime();
    if (startedMs < creditsWindowCutoff) return sum;
    return sum + (r.api_credits_used ?? 0);
  }, 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        icon={<StatusIcon status={latestStatus} />}
        label="Latest run"
        value={titleCase(latestStatus)}
        valueClassName={statusTextClass(latestStatus)}
        hint={
          latestRun ? (
            <span className="flex items-center gap-1.5">
              <Timer className="h-3 w-3" />
              {latestDurationMs != null
                ? formatDuration(latestDurationMs)
                : "Running…"}
              <span className="text-ink/40">·</span>
              <span>{formatRelativeMs(clockMs - new Date(latestRun.started_at).getTime())}</span>
            </span>
          ) : (
            "Worker has not reported a run"
          )
        }
      />

      <Tile
        icon={<Gauge className={clsx("h-4 w-4", successRateIconClass(successRate))} />}
        label={`Success rate · last ${window.length}`}
        value={successRate == null ? "—" : `${(successRate * 100).toFixed(0)}%`}
        valueClassName={successRateTextClass(successRate)}
        hint={
          successRate == null
            ? "Awaiting runs"
            : `${successCount} success · ${window.length - successCount} non-success`
        }
      />

      <Tile
        icon={<Coins className="h-4 w-4 text-tide" />}
        label="API credits · 24h"
        value={creditsUsed.toLocaleString("en-US")}
        hint={
          runs.length === 0
            ? "Awaiting runs"
            : `${runs.filter((r) => new Date(r.started_at).getTime() >= creditsWindowCutoff).length} runs in window`
        }
      />

      <Tile
        icon={<Clock className={clsx("h-4 w-4", stalestColor(stalestAgeMs))} />}
        label="Stalest symbol"
        value={stalestRow?.symbol ?? "—"}
        valueClassName={clsx("font-display", stalestColor(stalestAgeMs))}
        hint={
          stalestRow && stalestAgeMs >= 0
            ? `Last ingested ${formatRelativeMs(stalestAgeMs)}`
            : "No freshness data"
        }
      />
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  valueClassName,
  hint
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  hint?: React.ReactNode;
}) {
  return (
    <article className="panel flex flex-col gap-2 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-tide/70">
        {icon}
        <span>{label}</span>
      </div>
      <p className={clsx("font-display text-3xl text-ink", valueClassName)}>{value}</p>
      {hint ? <div className="text-sm text-ink/60">{hint}</div> : null}
    </article>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "partial") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-rose-600" />;
  if (status === "running") return <CircleDashed className="h-4 w-4 animate-spin text-tide" />;
  return <CircleDashed className="h-4 w-4 text-ink/40" />;
}

function statusTextClass(status: string): string {
  if (status === "success") return "text-emerald-700";
  if (status === "partial") return "text-amber-600";
  if (status === "error") return "text-rose-600";
  if (status === "running") return "text-tide";
  return "text-ink/60";
}

function successRateTextClass(rate: number | null): string {
  if (rate == null) return "text-ink/60";
  if (rate >= 0.95) return "text-emerald-700";
  if (rate >= 0.8) return "text-amber-600";
  return "text-rose-600";
}

function successRateIconClass(rate: number | null): string {
  if (rate == null) return "text-ink/40";
  if (rate >= 0.95) return "text-emerald-600";
  if (rate >= 0.8) return "text-amber-500";
  return "text-rose-600";
}

function stalestColor(ageMs: number): string {
  if (ageMs < 0) return "text-ink/60";
  const minutes = ageMs / 60000;
  if (minutes < 30) return "text-emerald-700";
  if (minutes < 90) return "text-amber-600";
  return "text-rose-600";
}

function getRunDurationMs(run: IngestionRunRecord | null): number | null {
  if (!run?.completed_at) return null;
  return new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatRelativeMs(ms: number): string {
  if (ms < 0) return "just now";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function titleCase(value: string): string {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
