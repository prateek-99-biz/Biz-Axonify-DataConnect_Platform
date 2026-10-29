"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { PALETTE, useChartTheme } from "@/components/charts/charts";
import { useIsDark } from "@/components/shell/theme-toggle";
import { PROGRESS_LABEL, PROGRESS_ORDER } from "@/server/dashboard/calc";
import type { ProgressStatus } from "@/server/dashboard/types";

type Row = Record<string, number | string | null>;
type Fmt = "pct" | "pct1" | "number" | "decimal";

const fmt = (kind: Fmt) => (v: number) =>
  kind === "pct" ? `${(v * 100).toFixed(0)}%` : kind === "pct1" ? `${(v * 100).toFixed(1)}%` : kind === "decimal" ? v.toFixed(1) : new Intl.NumberFormat("en-US", { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v);

/** One progress palette everywhere (the source report used two different mappings). Greens = success, slate recedes. */
const PROGRESS_COLORS = {
  light: { notStarted: "#CBD5E1", beginner: "#5B8DEF", intermediate: "#F59E0B", graduate: "#79C753", expert: "#0B7A4B" },
  dark: { notStarted: "#475569", beginner: "#8CB8FF", intermediate: "#FBBF24", graduate: "#8BD866", expert: "#2DD48C" },
} as const;

export function useProgressColors() {
  return PROGRESS_COLORS[useIsDark() ? "dark" : "light"];
}

/** Percentage axes get a 5-point pad (clamped to 0-100%) so tiny month-to-month movement is not blown up. */
const axisDomain = (kind: Fmt): [number | "auto" | ((v: number) => number), number | "auto" | ((v: number) => number)] =>
  kind === "pct" || kind === "pct1" ? [(min: number) => Math.max(0, Math.floor((min - 0.05) * 20) / 20), (max: number) => Math.min(1, Math.ceil((max + 0.05) * 20) / 20)] : ["auto", "auto"];

const Frame = ({ height, label, children }: { height: number; label: string; children: React.ReactElement }) => (
  <div style={{ height }} role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
  </div>
);

export function SingleLine({ data, xKey, yKey, label, format = "pct", height = 240, domain }: {
  data: Row[]; xKey: string; yKey: string; label: string; format?: Fmt; height?: number; domain?: [number | "auto", number | "auto"];
}) {
  const t = useChartTheme();
  const f = fmt(format);
  return (
    <Frame height={height} label={`${label} by month`}>
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} dy={6} minTickGap={18} />
        <YAxis tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} tickFormatter={f} width={44} domain={domain ?? axisDomain(format)} />
        <Tooltip formatter={(v) => f(Number(v))} contentStyle={t.tooltip} labelStyle={{ color: t.tooltip.color, fontWeight: 600 }} itemStyle={{ color: t.tooltip.color }} />
        <Line isAnimationActive={false} type="monotone" dataKey={yKey} name={label} stroke={t.color({ key: yKey, label }, 4)} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
      </LineChart>
    </Frame>
  );
}

export function DualAxisLine({ data, xKey, left, right, height = 300 }: {
  data: Row[]; xKey: string; left: { key: string; label: string; format: Fmt }; right: { key: string; label: string; format: Fmt }; height?: number;
}) {
  const t = useChartTheme();
  const fl = fmt(left.format), fr = fmt(right.format);
  const c1 = t.color({ key: "a", label: "" }, 2), c2 = t.color({ key: "b", label: "" }, 0);
  return (
    <Frame height={height} label={`${left.label} and ${right.label} by month`}>
      <LineChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} dy={6} minTickGap={18} />
        <YAxis yAxisId="l" tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} tickFormatter={fl} width={44} domain={axisDomain(left.format)} />
        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} tickFormatter={fr} width={40} domain={axisDomain(right.format)} />
        <Tooltip formatter={(v, name) => (name === left.label ? fl(Number(v)) : fr(Number(v)))} contentStyle={t.tooltip} labelStyle={{ color: t.tooltip.color, fontWeight: 600 }} itemStyle={{ color: t.tooltip.color }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: t.tick }}>{v}</span>} />
        <Line isAnimationActive={false} yAxisId="l" type="monotone" dataKey={left.key} name={left.label} stroke={c1} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
        <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey={right.key} name={right.label} stroke={c2} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
      </LineChart>
    </Frame>
  );
}

/** Horizontal bars; one or two series per category (e.g. current vs baseline knowledge). */
export function HBars({ data, nameKey, series, format = "pct", rowHeight = 30, maxHeight = 460, nameWidth = 200 }: {
  data: Row[]; nameKey: string; series: { key: string; label: string; color?: number }[]; format?: Fmt; rowHeight?: number; maxHeight?: number; nameWidth?: number;
}) {
  const t = useChartTheme();
  const f = fmt(format);
  const h = Math.max(160, data.length * rowHeight * series.length + 50);
  const trunc = (s: string) => (s.length > 34 ? `${s.slice(0, 33)}…` : s);
  return (
    <div className="overflow-y-auto" style={{ maxHeight }}>
      <Frame height={h} label={`${series.map((s) => s.label).join(" and ")} by ${nameKey}`}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke={t.grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} tickFormatter={f} domain={format === "pct" ? [0, 1] : [0, "auto"]} />
          <YAxis type="category" dataKey={nameKey} width={nameWidth} tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} tickFormatter={trunc} interval={0} />
          <Tooltip formatter={(v) => f(Number(v))} contentStyle={t.tooltip} labelStyle={{ color: t.tooltip.color, fontWeight: 600 }} itemStyle={{ color: t.tooltip.color }} cursor={{ fill: t.cursor }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} verticalAlign="top" formatter={(v) => <span style={{ color: t.tick }}>{v}</span>} />}
          {series.map((s, i) => <Bar isAnimationActive={false} key={s.key} dataKey={s.key} name={s.label} fill={t.color({ key: s.key, label: s.label }, s.color ?? i * 2)} radius={[0, 5, 5, 0]} maxBarSize={14} />)}
        </BarChart>
      </Frame>
    </div>
  );
}

/** Stacked progress bars (counts), horizontal. `percent` normalises each row to 100%. */
export function ProgressStack({ data, labelKey = "label", height, percent = false, showLegend = true }: {
  data: Row[]; labelKey?: string; height?: number; percent?: boolean; showLegend?: boolean;
}) {
  const t = useChartTheme();
  const colors = useProgressColors();
  const f = percent ? fmt("pct") : fmt("number");
  const h = height ?? Math.max(120, data.length * 56 + 60);
  return (
    <Frame height={h} label="Learner progress by status">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} stackOffset={percent ? "expand" : "none"}>
        <CartesianGrid stroke={t.grid} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} tickFormatter={f} />
        <YAxis type="category" dataKey={labelKey} width={96} tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v) => new Intl.NumberFormat("en-US").format(Number(v))} contentStyle={t.tooltip} labelStyle={{ color: t.tooltip.color, fontWeight: 600 }} itemStyle={{ color: t.tooltip.color }} cursor={{ fill: t.cursor }} />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} verticalAlign="top" formatter={(v) => <span style={{ color: t.tick }}>{v}</span>} />}
        {PROGRESS_ORDER.map((k: ProgressStatus) => <Bar isAnimationActive={false} key={k} dataKey={k} name={PROGRESS_LABEL[k]} stackId="p" fill={colors[k]} maxBarSize={30} />)}
      </BarChart>
    </Frame>
  );
}

export function Donut({ data, height = 260 }: { data: { name: string; value: number }[]; height?: number }) {
  const t = useChartTheme();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const palette = [t.color({ key: "a", label: "" }, 0), t.color({ key: "b", label: "" }, 4), t.color({ key: "c", label: "" }, 3)];
  return (
    <Frame height={height} label="Share by platform">
      <PieChart>
        <Tooltip formatter={(v, n) => [`${new Intl.NumberFormat("en-US").format(Number(v))} (${((Number(v) / total) * 100).toFixed(1)}%)`, n]} contentStyle={t.tooltip} itemStyle={{ color: t.tooltip.color }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: t.tick }}>{v}</span>} />
        <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none"
          label={({ percent }) => ((percent ?? 0) >= 0.04 ? `${((percent ?? 0) * 100).toFixed(1)}%` : "")} labelLine={false}>
          {data.map((d, i) => <Cell key={d.name} fill={palette[i % palette.length]} />)}
        </Pie>
      </PieChart>
    </Frame>
  );
}

export function HourColumns({ data, height = 260 }: { data: { hour: number; count: number }[]; height?: number }) {
  const t = useChartTheme();
  return (
    <Frame height={height} label="Training activity by hour of day">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} dy={6} interval={1} />
        <YAxis tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} width={44} tickFormatter={fmt("number")} />
        <Tooltip labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`} formatter={(v) => new Intl.NumberFormat("en-US").format(Number(v))} contentStyle={t.tooltip} labelStyle={{ color: t.tooltip.color, fontWeight: 600 }} itemStyle={{ color: t.tooltip.color }} cursor={{ fill: t.cursor }} />
        <Bar isAnimationActive={false} dataKey="count" name="Training activities" fill={t.color({ key: "a", label: "" }, 0)} radius={[4, 4, 0, 0]} />
      </BarChart>
    </Frame>
  );
}

const SHAPES = ["diamond", "square", "circle", "triangle", "star"] as const;

export function QuadrantBubbles({ points, height = 480 }: {
  points: { segment: string; avgKnowledge: number; avgConfidence: number; learners: number }[]; height?: number;
}) {
  const t = useChartTheme();
  const dark = useIsDark();
  const colors = PALETTE[dark ? "dark" : "light"];
  const mid = dark ? "rgba(255,255,255,0.35)" : "rgba(29,43,67,0.4)";
  return (
    <Frame height={height} label="Learner segments by knowledge and confidence">
      <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid stroke={t.grid} />
        <XAxis type="number" dataKey="avgKnowledge" name="Average Knowledge" domain={[0, 1]} tickFormatter={fmt("pct")} tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false}
          label={{ value: "Average Knowledge Score", position: "bottom", offset: 4, fill: t.tick, fontSize: 12 }} />
        <YAxis type="number" dataKey="avgConfidence" name="Average Confidence" domain={[0, 1]} tickFormatter={fmt("pct")} tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} width={48}
          label={{ value: "Average Confidence Score", angle: -90, position: "insideLeft", fill: t.tick, fontSize: 12 }} />
        <ZAxis type="number" dataKey="learners" range={[220, 1500]} name="Learners" />
        <ReferenceLine x={0.5} stroke={mid} strokeDasharray="6 5" />
        <ReferenceLine y={0.5} stroke={mid} strokeDasharray="6 5" />
        <Tooltip cursor={{ strokeDasharray: "3 3", stroke: t.grid }} contentStyle={t.tooltip} itemStyle={{ color: t.tooltip.color }}
          formatter={(v, n) => (n === "Learners" ? new Intl.NumberFormat("en-US").format(Number(v)) : `${(Number(v) * 100).toFixed(0)}%`)} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} verticalAlign="top" formatter={(v) => <span style={{ color: t.tick }}>{v}</span>} />
        {points.map((p, i) => (
          <Scatter isAnimationActive={false} key={p.segment} name={p.segment} data={[p]} fill={colors[i % colors.length]} shape={SHAPES[i % SHAPES.length]} fillOpacity={0.85} />
        ))}
      </ScatterChart>
    </Frame>
  );
}
