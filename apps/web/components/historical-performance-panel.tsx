"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { HistoricalPerformancePoint, HistoricalSeriesResponse } from "@market-pulse/shared";

import { formatCurrency, formatDateLabel, formatPercent } from "@/lib/format";

type HistoricalPerformancePanelProps = {
  symbols: string[];
};

type MetricMode = "percent_return" | "price_delta";

type LoadState = {
  pending: boolean;
  error: string | null;
  response: HistoricalSeriesResponse | null;
};

const CHART_HEIGHT = 320;
const CHART_WIDTH = 1000;
const PADDING_X = 16;
const PADDING_Y = 20;

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
    if (referenceDate) params.set("referenceDate", referenceDate);

    setLoadState((current) => ({ pending: true, error: null, response: current.response }));

    void fetch(`/api/history?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as HistoricalSeriesResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Historical request failed");
        }
        setLoadState({ pending: false, error: null, response: payload });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadState({
          pending: false,
          error: error instanceof Error ? error.message : "Historical request failed",
          response: null
        });
      });

    return () => controller.abort();
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

  const stats = useMemo(() => computeStats(points, metricMode), [points, metricMode]);

  return (
    <section className="panel p-6 md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.24em] text-tide/70">
            Historical performance
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {readyResponse ? (
              <>
                {readyResponse.symbol}
                {readyResponse.symbolName ? (
                  <span className="ml-3 font-display text-xl font-normal text-ink/50">
                    {readyResponse.symbolName}
                  </span>
                ) : null}
              </>
            ) : (
              "Long-range performance"
            )}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
            Daily adjusted-close history from a separate storage path — not the realtime quote
            pipeline.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,11rem)]">
          <label className="text-xs">
            <span className="mb-1.5 block font-display uppercase tracking-[0.2em] text-tide/70">
              Symbol
            </span>
            <select
              value={selectedSymbol}
              onChange={(event) => setSelectedSymbol(event.target.value)}
              disabled={symbols.length === 0}
              className="w-full rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm tabular-nums outline-none transition focus:border-ember disabled:cursor-not-allowed disabled:bg-ink/5"
            >
              {symbols.length === 0 ? <option value="">Add a symbol</option> : null}
              {symbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1.5 block font-display uppercase tracking-[0.2em] text-tide/70">
              Reference date
            </span>
            <input
              type="date"
              value={referenceDate}
              onChange={(event) => setReferenceDate(event.target.value)}
              disabled={!selectedSymbol}
              className="w-full rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm tabular-nums outline-none transition focus:border-ember disabled:cursor-not-allowed disabled:bg-ink/5"
            />
          </label>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-ink/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          label="Timeframe"
          options={[
            { value: getRelativeDateInputValue(6), label: "6M" },
            { value: getRelativeDateInputValue(12), label: "1Y" },
            { value: getRelativeDateInputValue(60), label: "5Y" },
            { value: "", label: "Max" }
          ]}
          value={referenceDate}
          onChange={setReferenceDate}
        />
        <SegmentedControl
          label="Metric"
          options={[
            { value: "percent_return", label: "% Return" },
            { value: "price_delta", label: "Price Δ" }
          ]}
          value={metricMode}
          onChange={(next) => setMetricMode(next as MetricMode)}
        />
      </div>

      {loadState.error ? (
        <p className="mt-4 text-sm text-rose-600">{loadState.error}</p>
      ) : null}

      {symbols.length === 0 ? (
        <EmptyState message="Historical charts are watchlist-scoped. Add a symbol first." />
      ) : response == null && !loadState.pending ? (
        <EmptyState message="Choose a symbol to load its stored daily history." />
      ) : response?.status === "unavailable" ? (
        <EmptyState
          message={
            response.message ?? "Historical backfill is not available for this symbol yet."
          }
        />
      ) : response?.status === "empty" ? (
        <EmptyState message={response.message ?? "No historical rows are available."} />
      ) : readyResponse == null ? (
        loadState.pending ? (
          <div className="mt-6 h-[320px] animate-pulse rounded-2xl bg-ink/[0.03]" />
        ) : (
          <EmptyState message="No chartable points are available from the selected reference date onward." />
        )
      ) : (
        <>
          <ExecutiveStrip
            stats={stats}
            metricMode={metricMode}
            latestPoint={latestPoint}
            referencePoint={referencePoint}
          />

          <div className="mt-6">
            <HistoricalChart
              points={chartSeries}
              metricMode={metricMode}
              loading={loadState.pending}
            />
            <div className="mt-2 flex items-center justify-between px-2 text-[11px] uppercase tracking-[0.2em] text-ink/40">
              <span className="tabular-nums">
                {formatDateLabel(readyResponse.effectiveReferenceDate)}
              </span>
              {readyResponse.clampedToAvailableHistory ? (
                <span className="text-amber-600/80">clamped to earliest stored row</span>
              ) : null}
              <span className="tabular-nums">
                {formatDateLabel(readyResponse.lastAvailableDate)}
              </span>
            </div>
          </div>

          {readyResponse.message ? (
            <p className="mt-4 text-xs text-ink/50">{readyResponse.message}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

type Stats = {
  latest: number | null;
  baselineClose: number | null;
  peak: { value: number; point: HistoricalPerformancePoint } | null;
  trough: { value: number; point: HistoricalPerformancePoint } | null;
};

function computeStats(points: HistoricalPerformancePoint[], mode: MetricMode): Stats {
  if (points.length === 0) {
    return { latest: null, baselineClose: null, peak: null, trough: null };
  }
  let peak: Stats["peak"] = null;
  let trough: Stats["trough"] = null;
  for (const p of points) {
    const v = mode === "percent_return" ? p.percent_return : p.price_delta;
    if (!peak || v > peak.value) peak = { value: v, point: p };
    if (!trough || v < trough.value) trough = { value: v, point: p };
  }
  const latest = points.at(-1)!;
  const baseline = points[0]!;
  return {
    latest: mode === "percent_return" ? latest.percent_return : latest.price_delta,
    baselineClose: baseline.adjusted_close,
    peak,
    trough
  };
}

function ExecutiveStrip({
  stats,
  metricMode,
  latestPoint,
  referencePoint
}: {
  stats: Stats;
  metricMode: MetricMode;
  latestPoint: HistoricalPerformancePoint | null;
  referencePoint: HistoricalPerformancePoint | null;
}) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-y-5 border-y border-ink/5 py-5 sm:grid-cols-4 sm:gap-x-4">
      <HeroStat
        label="Latest"
        value={stats.latest}
        metricMode={metricMode}
        hint={formatDateLabel(latestPoint?.trading_date ?? null)}
      />
      <Stat
        label="Baseline close"
        value={
          stats.baselineClose != null ? formatCurrency(stats.baselineClose) : "—"
        }
        hint={formatDateLabel(referencePoint?.trading_date ?? null)}
      />
      <Stat
        label="Peak"
        value={
          stats.peak
            ? formatMetricValue(stats.peak.value, metricMode)
            : "—"
        }
        hint={formatDateLabel(stats.peak?.point.trading_date ?? null)}
        tone="up"
      />
      <Stat
        label="Trough"
        value={
          stats.trough
            ? formatMetricValue(stats.trough.value, metricMode)
            : "—"
        }
        hint={formatDateLabel(stats.trough?.point.trading_date ?? null)}
        tone="down"
      />
    </div>
  );
}

function HeroStat({
  label,
  value,
  metricMode,
  hint
}: {
  label: string;
  value: number | null;
  metricMode: MetricMode;
  hint: string;
}) {
  const flat = value == null || Math.abs(value) < 0.0001;
  const up = (value ?? 0) >= 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const textColor = flat
    ? "text-ink/60"
    : up
      ? "text-emerald-700"
      : "text-rose-700";

  return (
    <div>
      <p className="font-display text-[10px] uppercase tracking-[0.24em] text-tide/70">
        {label}
      </p>
      <p
        className={clsx(
          "mt-1.5 flex items-center gap-2 font-display text-3xl font-semibold tabular-nums tracking-tight md:text-4xl",
          textColor
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>{value == null ? "—" : formatMetricValue(value, metricMode)}</span>
      </p>
      <p className="mt-1 text-xs tabular-nums text-ink/45">{hint}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "up" | "down";
}) {
  const valueClass =
    tone === "up"
      ? "text-emerald-700"
      : tone === "down"
        ? "text-rose-700"
        : "text-ink";
  return (
    <div>
      <p className="font-display text-[10px] uppercase tracking-[0.24em] text-tide/70">
        {label}
      </p>
      <p
        className={clsx(
          "mt-1.5 font-display text-xl font-semibold tabular-nums tracking-tight md:text-2xl",
          valueClass
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs tabular-nums text-ink/45">{hint}</p>
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden font-display text-[10px] uppercase tracking-[0.24em] text-tide/70 sm:inline">
        {label}
      </span>
      <div className="inline-flex rounded-full border border-ink/10 bg-white/80 p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(option.value)}
              className={clsx(
                "rounded-full px-4 py-1.5 font-display text-xs font-medium uppercase tracking-[0.12em] transition",
                active
                  ? "bg-ink text-white shadow-sm"
                  : "text-ink/55 hover:text-ink"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type ChartPoint = HistoricalPerformancePoint & {
  x: number;
  y: number;
  rawValue: number;
};

function HistoricalChart({
  points,
  metricMode,
  loading
}: {
  points: ChartPoint[];
  metricMode: MetricMode;
  loading: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const last = points.at(-1);
  const first = points[0];
  const rising = first != null && last != null ? last.rawValue >= first.rawValue : true;
  const lineColor = rising ? "#10b981" : "#f43f5e";
  const gradientId = rising ? "histo-fill-up" : "histo-fill-down";

  const baselineY = useMemo(() => {
    if (points.length === 0) return CHART_HEIGHT / 2;
    const zeroPoint = points.find((p) => p.rawValue === 0);
    if (zeroPoint) return zeroPoint.y;
    const values = points.map((p) => p.rawValue);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const domain = max - min || 1;
    const clampedZero = Math.max(min, Math.min(max, 0));
    return (
      CHART_HEIGHT -
      PADDING_Y -
      ((clampedZero - min) / domain) * (CHART_HEIGHT - PADDING_Y * 2)
    );
  }, [points]);

  const { gridLines, gridLabels } = useMemo(() => {
    if (points.length === 0) return { gridLines: [], gridLabels: [] };
    const values = points.map((p) => p.rawValue);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const ticks = 4;
    const lines: { y: number; value: number }[] = [];
    for (let i = 0; i <= ticks; i++) {
      const value = min + (i / ticks) * (max - min);
      const domain = max - min || 1;
      const y =
        CHART_HEIGHT -
        PADDING_Y -
        ((value - min) / domain) * (CHART_HEIGHT - PADDING_Y * 2);
      lines.push({ y, value });
    }
    return { gridLines: lines, gridLabels: lines };
  }, [points]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0 || !first || !last) return "";
    return `${linePath} L${last.x.toFixed(1)},${CHART_HEIGHT - PADDING_Y} L${first.x.toFixed(1)},${CHART_HEIGHT - PADDING_Y} Z`;
  }, [linePath, points.length, first, last]);

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const cursorX = ratio * CHART_WIDTH;

    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i]!.x - cursorX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }
    setHoverIndex(nearest);
  };

  const hovered = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className="relative rounded-2xl border border-ink/10 bg-gradient-to-b from-white to-white/60 p-4">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className={clsx("h-72 w-full transition-opacity md:h-80", loading && "opacity-60")}
        role="img"
        aria-label={`${metricMode} history chart`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="histo-fill-up" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="histo-fill-down" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((tick, i) => (
          <line
            key={`grid-${i}`}
            x1={PADDING_X}
            x2={CHART_WIDTH - PADDING_X}
            y1={tick.y}
            y2={tick.y}
            stroke="#101418"
            strokeOpacity={0.06}
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}

        <line
          x1={PADDING_X}
          x2={CHART_WIDTH - PADDING_X}
          y1={baselineY}
          y2={baselineY}
          stroke="#101418"
          strokeOpacity={0.25}
          strokeWidth={1}
          strokeDasharray="6 6"
        />

        {points.length > 0 ? (
          <>
            <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
            <path
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {first ? (
          <circle
            cx={first.x}
            cy={first.y}
            r={4}
            fill="#ffffff"
            stroke="#0d3b66"
            strokeWidth={2}
          />
        ) : null}
        {last ? (
          <circle cx={last.x} cy={last.y} r={5} fill={lineColor} />
        ) : null}

        {hovered ? (
          <>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PADDING_Y}
              y2={CHART_HEIGHT - PADDING_Y}
              stroke="#101418"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r={5}
              fill="#ffffff"
              stroke={lineColor}
              strokeWidth={2.5}
            />
          </>
        ) : null}

        {gridLabels.map((tick, i) => (
          <text
            key={`label-${i}`}
            x={PADDING_X + 4}
            y={tick.y - 4}
            className="fill-ink/40"
            style={{ fontSize: 10, fontFamily: "inherit" }}
          >
            {formatMetricValue(tick.value, metricMode)}
          </text>
        ))}
      </svg>

      {hovered ? (
        <HoverTooltip point={hovered} metricMode={metricMode} />
      ) : null}
    </div>
  );
}

function HoverTooltip({
  point,
  metricMode
}: {
  point: ChartPoint;
  metricMode: MetricMode;
}) {
  const leftPct = Math.max(4, Math.min(96, (point.x / CHART_WIDTH) * 100));
  const up = point.rawValue >= 0;
  return (
    <div
      className="pointer-events-none absolute top-3 min-w-[160px] -translate-x-1/2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-left shadow-[0_12px_32px_rgba(16,20,24,0.18)]"
      style={{ left: `${leftPct}%` }}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink/45">
        {formatDateLabel(point.trading_date)}
      </p>
      <p
        className={clsx(
          "mt-1 font-display text-base font-semibold tabular-nums",
          up ? "text-emerald-700" : "text-rose-700"
        )}
      >
        {formatMetricValue(point.rawValue, metricMode)}
      </p>
      <p className="mt-0.5 text-[11px] tabular-nums text-ink/55">
        Close {formatCurrency(point.adjusted_close)}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-ink/15 bg-white/70 px-6 py-12 text-center">
      <p className="font-display text-xl font-semibold text-ink">No historical series to chart.</p>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink/60">{message}</p>
    </div>
  );
}

function buildChartSeries(
  points: HistoricalPerformancePoint[],
  metricMode: MetricMode
): ChartPoint[] {
  if (points.length === 0) return [];

  const values = points.map((point) =>
    metricMode === "percent_return" ? point.percent_return : point.price_delta
  );
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const domain = maxValue - minValue || 1;

  const innerWidth = CHART_WIDTH - PADDING_X * 2;
  const innerHeight = CHART_HEIGHT - PADDING_Y * 2;

  return points.map((point, index) => {
    const rawValue =
      metricMode === "percent_return" ? point.percent_return : point.price_delta;
    const x =
      points.length === 1
        ? CHART_WIDTH / 2
        : PADDING_X + (index / (points.length - 1)) * innerWidth;
    const y = CHART_HEIGHT - PADDING_Y - ((rawValue - minValue) / domain) * innerHeight;

    return { ...point, rawValue, x, y };
  });
}

function formatMetricValue(value: number, metricMode: MetricMode): string {
  if (metricMode === "percent_return") {
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatPercent(value)}`;
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

function getRelativeDateInputValue(monthsBack: number): string {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - monthsBack);
  return date.toISOString().slice(0, 10);
}

function downsampleChartSeries(points: ChartPoint[], maxPoints = 600): ChartPoint[] {
  if (points.length <= maxPoints) return points;

  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return points;

  const interior = points.slice(1, -1);
  const bucketSize = Math.ceil(interior.length / Math.max(maxPoints - 2, 1));
  const sampled: ChartPoint[] = [first];

  for (let index = 0; index < interior.length; index += bucketSize) {
    const bucket = interior.slice(index, index + bucketSize);
    const firstBucketPoint = bucket[0];
    if (!firstBucketPoint) continue;

    let minPoint = firstBucketPoint;
    let maxPoint = firstBucketPoint;
    for (const point of bucket) {
      if (point.rawValue < minPoint.rawValue) minPoint = point;
      if (point.rawValue > maxPoint.rawValue) maxPoint = point;
    }

    const ordered: ChartPoint[] = [minPoint, maxPoint].sort(
      (left, right) => left.x - right.x
    );
    for (const point of ordered) {
      if (
        sampled.at(-1)?.trading_date !== point.trading_date ||
        sampled.at(-1)?.x !== point.x
      ) {
        sampled.push(point);
      }
    }
  }

  if (
    sampled.at(-1)?.trading_date !== last.trading_date ||
    sampled.at(-1)?.x !== last.x
  ) {
    sampled.push(last);
  }

  return sampled;
}
