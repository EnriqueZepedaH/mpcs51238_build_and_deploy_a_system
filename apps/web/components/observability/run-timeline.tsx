"use client";

import { useMemo } from "react";
import clsx from "clsx";
import type { IngestionRunRecord } from "@market-pulse/shared";

type RunTimelineProps = {
  runs: IngestionRunRecord[];
  clockMs: number;
};

const MAX_DOTS = 40;
const ROW_HEIGHT = 88;
const DOT_AREA_HEIGHT = 72;

export function RunTimeline({ runs, clockMs }: RunTimelineProps) {
  const displayed = useMemo(() => {
    return runs.slice(0, MAX_DOTS).slice().reverse();
  }, [runs]);

  const { dotData, maxDuration } = useMemo(() => {
    let max = 0;
    const data = displayed.map((run) => {
      const duration = getDurationMs(run, clockMs);
      if (duration > max) max = duration;
      return { run, duration };
    });
    return { dotData: data, maxDuration: max };
  }, [displayed, clockMs]);

  const oldestRun = displayed[0];
  const newestRun = displayed[displayed.length - 1];
  const oldestAgo =
    oldestRun && formatAgo(clockMs - new Date(oldestRun.started_at).getTime());
  const newestAgo =
    newestRun && formatAgo(clockMs - new Date(newestRun.started_at).getTime());

  return (
    <section className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.24em] text-tide/70">
            Run timeline
          </p>
          <h2 className="mt-1 font-display text-xl text-ink">
            Last {displayed.length} ingestion runs
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Dot size scales with run duration. Hover for per-run metrics.
          </p>
        </div>
        <Legend />
      </div>

      {displayed.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-ink/15 p-10 text-center text-sm text-ink/50">
          No ingestion runs yet. Once the worker reports a run, it will appear here.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <div
            className="relative flex items-center gap-3"
            style={{ height: ROW_HEIGHT, minWidth: Math.max(displayed.length * 24, 280) }}
          >
            <div
              aria-hidden
              className="absolute left-0 right-0 border-t border-dashed border-ink/10"
              style={{ top: ROW_HEIGHT / 2 }}
            />
            {dotData.map(({ run, duration }) => (
              <RunDot
                key={run.id}
                run={run}
                duration={duration}
                maxDuration={maxDuration}
                clockMs={clockMs}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] uppercase tracking-[0.18em] text-ink/40">
            <span>{oldestAgo ?? ""}</span>
            <span>{newestAgo ?? "now"}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function RunDot({
  run,
  duration,
  maxDuration,
  clockMs
}: {
  run: IngestionRunRecord;
  duration: number;
  maxDuration: number;
  clockMs: number;
}) {
  const size = dotSize(duration, maxDuration);
  const color = statusDotColor(run.status);
  const ringColor = statusRingColor(run.status);

  return (
    <div
      className="group relative flex flex-col items-center justify-center"
      style={{ height: DOT_AREA_HEIGHT, width: 18 }}
    >
      <div
        className={clsx(
          "relative rounded-full transition-transform duration-200 group-hover:scale-125",
          color
        )}
        style={{ width: size, height: size }}
      >
        {run.status === "running" ? (
          <span
            className={clsx(
              "absolute inset-0 animate-ping rounded-full opacity-60",
              ringColor
            )}
          />
        ) : null}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden -translate-x-1/2 -translate-y-full group-hover:block">
        <div className="w-56 rounded-xl border border-ink/10 bg-white p-3 text-left text-xs text-ink shadow-[0_12px_32px_rgba(16,20,24,0.18)]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-semibold capitalize">
              {run.status}
            </span>
            <span className="text-ink/50">
              {formatAgo(clockMs - new Date(run.started_at).getTime())}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <Metric label="Duration" value={formatDuration(duration)} />
            <Metric
              label="Polled"
              value={`${run.symbols_polled}/${run.symbols_considered}`}
            />
            <Metric label="Rows" value={String(run.rows_written)} />
            <Metric label="Credits" value={String(run.api_credits_used)} />
            <Metric label="Stale" value={String(run.stale_symbols)} />
            <Metric label="Errors" value={String(run.error_count)} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="uppercase tracking-[0.18em] text-ink/45">{label}</dt>
      <dd className="text-right font-display text-ink">{value}</dd>
    </>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-ink/50 md:flex">
      <LegendItem color="bg-emerald-500" label="Success" />
      <LegendItem color="bg-amber-400" label="Partial" />
      <LegendItem color="bg-rose-500" label="Error" />
      <LegendItem color="bg-tide" label="Running" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function dotSize(duration: number, max: number): number {
  const MIN = 6;
  const MAX = 18;
  if (max <= 0) return MIN;
  const ratio = Math.log(1 + duration) / Math.log(1 + max);
  return MIN + (MAX - MIN) * ratio;
}

function statusDotColor(status: IngestionRunRecord["status"]): string {
  switch (status) {
    case "success":
      return "bg-emerald-500";
    case "partial":
      return "bg-amber-400";
    case "error":
      return "bg-rose-500";
    case "running":
      return "bg-tide";
    default:
      return "bg-ink/40";
  }
}

function statusRingColor(status: IngestionRunRecord["status"]): string {
  switch (status) {
    case "running":
      return "bg-tide";
    default:
      return "bg-transparent";
  }
}

function getDurationMs(run: IngestionRunRecord, clockMs: number): number {
  const start = new Date(run.started_at).getTime();
  const end = run.completed_at ? new Date(run.completed_at).getTime() : clockMs;
  return Math.max(0, end - start);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatAgo(ms: number): string {
  if (ms < 0) return "just now";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}
