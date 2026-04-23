"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { HistoricalPerformancePoint, HistoricalSeriesResponse } from "@market-pulse/shared";

import {
  formatCompactNumber,
  formatCurrency,
  formatDateLabel,
  formatPercent
} from "@/lib/format";

type HistoricalPerformancePanelProps = {
  symbols: string[];
};

type MetricMode = "percent_return" | "price_delta";

type LoadState = {
  pending: boolean;
  error: string | null;
  response: HistoricalSeriesResponse | null;
};

const chartHeight = 240;
const chartWidth = 920;

export function HistoricalPerformancePanel({ symbols }: HistoricalPerformancePanelProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0] ?? "");
  const [referenceDate, setReferenceDate] = useState("");
  const [metricMode, setMetricMode] = useState<MetricMode>("percent_return");
  const [loadState, setLoadState] = useState<LoadState>({
    pending: false,
    error: null,
    response: null
  });

  useEffect(() => {
    if (!symbols.includes(selectedSymbol)) {
      setSelectedSymbol(symbols[0] ?? "");
    }
  }, [selectedSymbol, symbols]);

  useEffect(() => {
    if (!selectedSymbol) {
      setLoadState({ pending: false, error: null, response: null });
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ symbol: selectedSymbol });

    if (referenceDate) {
      params.set("referenceDate", referenceDate);
    }

    setLoadState((current) => ({
      pending: true,
      error: null,
      response: current.response
    }));

    void fetch(`/api/history?${params.toString()}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json()) as HistoricalSeriesResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Historical request failed");
        }

        setLoadState({
          pending: false,
          error: null,
          response: payload
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setLoadState({
          pending: false,
          error: error instanceof Error ? error.message : "Historical request failed",
          response: null
        });
      });

    return () => {
      controller.abort();
    };
  }, [referenceDate, selectedSymbol]);

  const response = loadState.response;
  const points = response?.points ?? [];
  const readyResponse = response?.status === "ready" && points.length > 0 ? response : null;
  const chartSeries = useMemo(() => {
    const fullSeries = buildChartSeries(points, metricMode);
    return downsampleChartSeries(fullSeries);
  }, [metricMode, points]);
  const latestPoint = points.at(-1) ?? null;
  const referencePoint = points[0] ?? null;

  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.24em] text-tide/70">
            Historical performance
          </p>
          <h3 className="mt-2 font-display text-3xl text-ink">
            Long-range charting belongs in a separate storage path.
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/75">
            The live quote worker is optimized for recent state. This chart reads from the lean
            daily history store so you can measure performance from a reference date without
            forcing the realtime pipeline to carry decades of data.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)]">
          <label className="text-sm text-ink/70">
            <span className="mb-2 block font-medium text-ink">Watchlist symbol</span>
            <select
              value={selectedSymbol}
              onChange={(event) => setSelectedSymbol(event.target.value)}
              disabled={symbols.length === 0}
              className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-ember disabled:cursor-not-allowed disabled:bg-ink/5"
            >
              {symbols.length === 0 ? <option value="">Add a symbol first</option> : null}
              {symbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-ink/70">
            <span className="mb-2 block font-medium text-ink">Reference date</span>
            <input
              type="date"
              value={referenceDate}
              onChange={(event) => setReferenceDate(event.target.value)}
              disabled={!selectedSymbol}
              className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-ember disabled:cursor-not-allowed disabled:bg-ink/5"
            />
          </label>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PresetButton
          label="6M"
          active={referenceDate === getRelativeDateInputValue(6)}
          onClick={() => setReferenceDate(getRelativeDateInputValue(6))}
        />
        <PresetButton
          label="1Y"
          active={referenceDate === getRelativeDateInputValue(12)}
          onClick={() => setReferenceDate(getRelativeDateInputValue(12))}
        />
        <PresetButton
          label="5Y"
          active={referenceDate === getRelativeDateInputValue(60)}
          onClick={() => setReferenceDate(getRelativeDateInputValue(60))}
        />
        <PresetButton
          label="Max"
          active={referenceDate === ""}
          onClick={() => setReferenceDate("")}
        />
        <MetricToggle
          active={metricMode === "percent_return"}
          label="% return"
          onClick={() => setMetricMode("percent_return")}
        />
        <MetricToggle
          active={metricMode === "price_delta"}
          label="Price delta"
          onClick={() => setMetricMode("price_delta")}
        />
        {loadState.pending ? <span className="text-sm text-ink/60">Loading history…</span> : null}
        {loadState.error ? <span className="text-sm text-ember">{loadState.error}</span> : null}
      </div>
      <p className="mt-3 text-sm text-ink/60">
        Blank reference date means “start from the first stored trading day.”
      </p>

      {symbols.length === 0 ? (
        <EmptyState message="Historical charts are watchlist-scoped. Add a symbol first." />
      ) : response == null && !loadState.pending ? (
        <EmptyState message="Choose a symbol to load its stored daily history." />
      ) : response?.status === "unavailable" ? (
        <EmptyState
          message={response.message ?? "Historical backfill is not available for this symbol yet."}
        />
      ) : response?.status === "empty" ? (
        <EmptyState message={response.message ?? "No historical rows are available."} />
      ) : readyResponse == null ? (
        <EmptyState message="No chartable points are available from the selected reference date onward." />
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
            <div className="rounded-[2rem] border border-ink/10 bg-white px-4 py-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-display text-2xl text-ink">
                    {readyResponse.symbol}
                    {readyResponse.symbolName ? (
                      <span className="ml-3 text-lg text-ink/55">{readyResponse.symbolName}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-ink/65">
                    {metricMode === "percent_return"
                      ? "Performance since the selected reference date"
                      : "Absolute price change since the selected reference date"}
                  </p>
                </div>

                <div
                  className={clsx(
                    "rounded-2xl px-4 py-3 text-right",
                    getLatestMetricValue(latestPoint, metricMode) >= 0
                      ? "bg-mint/20 text-tide"
                      : "bg-ember/15 text-ember"
                  )}
                >
                  <p className="text-xs uppercase tracking-[0.22em]">Latest</p>
                  <p className="mt-2 font-display text-2xl">
                    {formatMetricValue(getLatestMetricValue(latestPoint, metricMode), metricMode)}
                  </p>
                  <p className="mt-1 text-xs">
                    as of {formatDateLabel(latestPoint?.trading_date ?? null)}
                  </p>
                </div>
              </div>

              <HistoricalChart metricMode={metricMode} points={chartSeries} />

              <div className="mt-4 flex flex-wrap justify-between gap-3 text-xs uppercase tracking-[0.18em] text-ink/50">
                <span>{formatDateLabel(readyResponse.effectiveReferenceDate)}</span>
                <span>{formatDateLabel(readyResponse.lastAvailableDate)}</span>
              </div>
            </div>

            <aside className="space-y-4">
              <InfoCard
                label="Reference date"
                value={formatDateLabel(readyResponse.effectiveReferenceDate)}
                note={
                  readyResponse.clampedToAvailableHistory
                    ? "Requested date was earlier than stored history, so the chart starts from the first available row."
                    : "Used as the baseline for price delta and percentage return."
                }
              />
              <InfoCard
                label="History coverage"
                value={`${formatDateLabel(readyResponse.firstAvailableDate)} - ${formatDateLabel(readyResponse.lastAvailableDate)}`}
                note="The chart is calculated from stored daily adjusted-close history, not from realtime quote snapshots."
              />
              <InfoCard
                label="Reference close"
                value={formatCurrency(referencePoint?.adjusted_close)}
                note="This is the baseline closing price used to compute both price delta and percentage return."
              />
              <InfoCard
                label="Latest close"
                value={formatCurrency(latestPoint?.adjusted_close)}
                note={
                  latestPoint?.volume != null
                    ? `Volume: ${formatCompactNumber(latestPoint.volume)}`
                    : "Volume is not available for the latest row."
                }
              />
            </aside>
          </div>

          {readyResponse.message ? (
            <p className="mt-4 text-sm text-ink/65">{readyResponse.message}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function HistoricalChart({
  points,
  metricMode
}: {
  points: ChartPoint[];
  metricMode: MetricMode;
}) {
  const baselineY = points.find((point) => point.rawValue === 0)?.y ?? chartHeight / 2;

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-sand/55 p-4">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="h-64 w-full"
        role="img"
        aria-label={`${metricMode} history chart`}
      >
        <line
          x1={0}
          x2={chartWidth}
          y1={baselineY}
          y2={baselineY}
          className="stroke-ink/10"
          strokeDasharray="8 10"
          strokeWidth={2}
        />
        <polyline
          fill="none"
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          stroke="currentColor"
          strokeWidth={4}
          className="text-tide"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points[0] ? (
          <circle cx={points[0].x} cy={points[0].y} r={4} className="fill-tide" />
        ) : null}
        {points.at(-1) ? (
          <circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r={5} className="fill-ember" />
        ) : null}
      </svg>
    </div>
  );
}

function PresetButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-full border px-4 py-2 text-sm transition",
        active
          ? "border-ember bg-ember text-white"
          : "border-ink/10 bg-white text-ink/75 hover:border-ember hover:text-ember"
      )}
    >
      {label}
    </button>
  );
}

function MetricToggle({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-full border px-4 py-2 text-sm transition",
        active
          ? "border-tide bg-tide text-white"
          : "border-ink/10 bg-white text-ink/75 hover:border-tide hover:text-tide"
      )}
    >
      {label}
    </button>
  );
}

function InfoCard({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-ink/10 bg-white px-5 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">{label}</p>
      <p className="mt-3 font-display text-2xl text-ink">{value}</p>
      <p className="mt-3 text-sm leading-6 text-ink/65">{note}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-[2rem] border border-dashed border-ink/15 bg-white/70 px-6 py-12 text-center">
      <p className="font-display text-2xl text-ink">Historical performance is a separate data product.</p>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-ink/70">{message}</p>
    </div>
  );
}

type ChartPoint = HistoricalPerformancePoint & {
  x: number;
  y: number;
  rawValue: number;
};

function buildChartSeries(
  points: HistoricalPerformancePoint[],
  metricMode: MetricMode
): ChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  const values = points.map((point) =>
    metricMode === "percent_return" ? point.percent_return : point.price_delta
  );
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const domain = maxValue - minValue || 1;

  return points.map((point, index) => {
    const rawValue = metricMode === "percent_return" ? point.percent_return : point.price_delta;
    const x = points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth;
    const y = chartHeight - ((rawValue - minValue) / domain) * chartHeight;

    return {
      ...point,
      rawValue,
      x,
      y
    };
  });
}

function getLatestMetricValue(
  point: HistoricalPerformancePoint | null,
  metricMode: MetricMode
): number {
  if (!point) {
    return 0;
  }

  return metricMode === "percent_return" ? point.percent_return : point.price_delta;
}

function formatMetricValue(value: number, metricMode: MetricMode): string {
  return metricMode === "percent_return" ? formatPercent(value) : formatCurrency(value);
}

function getRelativeDateInputValue(monthsBack: number): string {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - monthsBack);

  return date.toISOString().slice(0, 10);
}

function downsampleChartSeries(points: ChartPoint[], maxPoints = 600): ChartPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }

  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) {
    return points;
  }

  const interior = points.slice(1, -1);
  const bucketSize = Math.ceil(interior.length / Math.max(maxPoints - 2, 1));
  const sampled: ChartPoint[] = [first];

  for (let index = 0; index < interior.length; index += bucketSize) {
    const bucket = interior.slice(index, index + bucketSize);
    const firstBucketPoint = bucket[0];
    if (!firstBucketPoint) {
      continue;
    }

    let minPoint = firstBucketPoint;
    let maxPoint = firstBucketPoint;

    for (const point of bucket) {
      if (point.rawValue < minPoint.rawValue) {
        minPoint = point;
      }

      if (point.rawValue > maxPoint.rawValue) {
        maxPoint = point;
      }
    }

    const ordered: ChartPoint[] = [minPoint, maxPoint].sort((left, right) => left.x - right.x);
    for (const point of ordered) {
      if (sampled.at(-1)?.trading_date !== point.trading_date || sampled.at(-1)?.x !== point.x) {
        sampled.push(point);
      }
    }
  }

  if (sampled.at(-1)?.trading_date !== last.trading_date || sampled.at(-1)?.x !== last.x) {
    sampled.push(last);
  }

  return sampled;
}
