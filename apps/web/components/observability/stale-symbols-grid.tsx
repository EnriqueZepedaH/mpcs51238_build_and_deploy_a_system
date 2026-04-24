"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { getFreshnessStatus, type FreshnessStatus } from "@market-pulse/shared";

import type { FreshnessRow } from "@/components/observability-client";

type StaleSymbolsGridProps = {
  rows: FreshnessRow[];
  freshnessTargetSeconds: number;
  clockMs: number;
};

const DEFAULT_LIMIT = 10;

export function StaleSymbolsGrid({
  rows,
  freshnessTargetSeconds,
  clockMs
}: StaleSymbolsGridProps) {
  const [expanded, setExpanded] = useState(false);

  const enriched = useMemo(() => {
    return rows
      .map((row) => {
        const ageMs = row.last_ingested_at
          ? clockMs - new Date(row.last_ingested_at).getTime()
          : Number.POSITIVE_INFINITY;
        const status = getFreshnessStatus(
          row.last_ingested_at,
          freshnessTargetSeconds,
          clockMs
        );
        return { ...row, ageMs, status };
      })
      .sort((a, b) => b.ageMs - a.ageMs);
  }, [rows, freshnessTargetSeconds, clockMs]);

  const overCount = enriched.filter((r) => r.status !== "fresh").length;
  const visible = expanded ? enriched : enriched.slice(0, DEFAULT_LIMIT);
  const hiddenCount = enriched.length - visible.length;

  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.24em] text-tide/70">
            Freshness
          </p>
          <h2 className="mt-1 font-display text-xl text-ink">Stalest symbols</h2>
          <p className="mt-1 text-sm text-ink/60">
            {enriched.length === 0
              ? "No symbols in quotes_current yet."
              : `${overCount} of ${enriched.length} symbols are past the fresh threshold.`}
          </p>
        </div>
        {enriched.length > DEFAULT_LIMIT ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-ink/10 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-ink/25 hover:text-ink sm:self-end"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show top {DEFAULT_LIMIT}
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show all {enriched.length}
              </>
            )}
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? null : (
        <>
          <div className="mt-5 hidden overflow-hidden rounded-2xl border border-ink/10 md:block">
            <table className="min-w-full divide-y divide-ink/10 text-left">
              <thead className="bg-white/70 text-[11px] uppercase tracking-[0.2em] text-tide/70">
                <tr>
                  <th className="px-5 py-3">Symbol</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Age</th>
                  <th className="px-5 py-3">Last ingested</th>
                  <th className="px-5 py-3 text-right">Watchers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10 bg-white/60">
                {visible.map((row) => (
                  <tr key={row.symbol} className="text-sm">
                    <td className="px-5 py-3">
                      <p className="font-display text-base text-ink">{row.symbol}</p>
                      {row.name ? (
                        <p className="text-xs text-ink/50">{row.name}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-5 py-3 font-display tabular-nums text-ink">
                      {formatAgeMs(row.ageMs)}
                    </td>
                    <td className="px-5 py-3 text-ink/65">
                      {row.last_ingested_at
                        ? new Date(row.last_ingested_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5 text-ink/70">
                        <Users className="h-3.5 w-3.5 text-ink/40" />
                        {row.watcher_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:hidden">
            {visible.map((row) => (
              <div
                key={row.symbol}
                className="rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base text-ink">{row.symbol}</p>
                    {row.name ? (
                      <p className="text-xs text-ink/50">{row.name}</p>
                    ) : null}
                  </div>
                  <StatusPill status={row.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-tide/70">Age</p>
                    <p className="font-display tabular-nums text-ink">
                      {formatAgeMs(row.ageMs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-tide/70">
                      Watchers
                    </p>
                    <p className="text-ink">{row.watcher_count}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hiddenCount > 0 ? (
            <p className="mt-4 text-center text-xs text-ink/45">
              +{hiddenCount} more hidden
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: FreshnessStatus }) {
  const styles =
    status === "fresh"
      ? "bg-emerald-500/10 text-emerald-700"
      : status === "degraded"
        ? "bg-amber-400/15 text-amber-700"
        : "bg-rose-500/10 text-rose-700";
  const dot =
    status === "fresh"
      ? "bg-emerald-500"
      : status === "degraded"
        ? "bg-amber-400"
        : "bg-rose-500";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        styles
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} />
      {status}
    </span>
  );
}

function formatAgeMs(ms: number): string {
  if (!Number.isFinite(ms)) return "never";
  if (ms < 0) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}
