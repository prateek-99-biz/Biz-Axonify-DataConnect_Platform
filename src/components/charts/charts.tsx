"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIsDark } from "@/components/shell/theme-toggle";

/** Axonify green leads, then Biz Group purple and orange from the logo. The dark set is lifted so every series keeps >= 3:1 contrast against the dark glass. */
export const PALETTE = {
  light: ["#79C753", "#682685", "#EF7922", "#00AA61", "#3B6FD8", "#8A97AB"],
  dark: ["#8BD866", "#B67CD6", "#F79646", "#2DD48C", "#8CB8FF", "#CBD5E1"],
};
/**
 * For charts whose series are clients, CSMs, periods or peer groups rather than measures. It leaves out green, purple and orange,
 * which on this platform always mean participation, knowledge and engagement.
 */
export const ENTITY_PALETTE = {
  light: ["#3B6FD8", "#0E9AA7", "#64748B", "#0EA5E9", "#D6457A", "#8A97AB"],
  dark: ["#8CB8FF", "#2DD4BF", "#CBD5E1", "#7DD3FC", "#FDA4AF", "#94A3B8"],
};
const NAVY = "#1D2B43";

export interface SeriesDef { key: string; label: string; color?: string }

const pctFmt = (v: number) => `${(v * 100).toFixed(0)}%`;

export function useChartTheme(entities = false) {
  const dark = useIsDark();
  const colors = entities ? (dark ? ENTITY_PALETTE.dark : ENTITY_PALETTE.light) : dark ? PALETTE.dark : PALETTE.light;
  return {
    // Pages that ask for navy get the palette's second colour (Biz purple), which also stays visible on dark glass.
    color: (s: SeriesDef, i: number) => (entities ? colors[i % colors.length] : s.color && s.color.toUpperCase() !== NAVY ? s.color : s.color ? colors[1] : colors[i % colors.length]),
    grid: dark ? "rgba(255,255,255,0.08)" : "rgba(29,43,67,0.08)",
    tick: dark ? "#ACB9CB" : "#4B586C",
    tooltip: {
      fontSize: 12,
      borderRadius: 14,
      padding: "8px 12px",
      color: dark ? "#ECF1F7" : "#1D2B43",
      background: dark ? "rgba(20,31,50,0.9)" : "rgba(255,255,255,0.9)",
      border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.8)",
      boxShadow: "0 12px 40px -16px rgba(0,0,0,0.35)",
      backdropFilter: "blur(16px) saturate(180%)",
      WebkitBackdropFilter: "blur(16px) saturate(180%)",
    } as CSSProperties,
    cursor: dark ? "rgba(255,255,255,0.06)" : "rgba(29,43,67,0.05)",
  };
}

/** Holds the chart's space with a pulsing placeholder until the browser has drawn it, so cards are never blank. */
function ChartFrame({ height, label, children }: { height: number; label: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div style={{ height }} role="img" aria-label={label} aria-busy={!ready}>
      {ready ? children : <div aria-hidden className="h-full w-full animate-pulse rounded-xl bg-slate-300/40 dark:bg-white/10" />}
    </div>
  );
}

export function TrendChart({
  data, series, xKey = "period", format = "pct", height = 260, entities,
}: { data: Record<string, number | string | null>[]; series: SeriesDef[]; xKey?: string; format?: "pct" | "number" | "score"; height?: number; entities?: boolean }) {
  const t = useChartTheme(entities);
  const uid = "g" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const f = (v: number) => (format === "pct" ? pctFmt(v) : format === "score" ? v.toFixed(0) : new Intl.NumberFormat("en-US").format(v));
  // A line needs two points. A measure with only one or two values (knowledge exists for the latest quarter only) would draw nothing, so it gets dots and a note.
  const sparse = series.map((s) => ({ s, at: data.filter((d) => d[s.key] != null).map((d) => String(d[xKey])) })).filter((x) => x.at.length > 0 && x.at.length <= 2);
  const sparseKeys = new Set(sparse.map((x) => x.s.key));
  return (
    <>
    <ChartFrame height={height} label={`Trend of ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.color(s, i)} stopOpacity={i === 0 ? 0.22 : 0.07} />
                <stop offset="85%" stopColor={t.color(s, i)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} dy={6} />
          <YAxis tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} tickFormatter={f} width={44} />
          <Tooltip formatter={(v) => f(Number(v))} contentStyle={t.tooltip} labelStyle={{ color: t.tooltip.color, fontWeight: 600 }} itemStyle={{ color: t.tooltip.color }} cursor={{ stroke: t.grid, strokeWidth: 1 }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: t.tick }}>{v}</span>} />}
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={t.color(s, i)} strokeWidth={2.25} fill={`url(#${uid}-${i})`}
              dot={sparseKeys.has(s.key) ? { r: 5, strokeWidth: 2, stroke: t.color(s, i), fill: t.color(s, i) } : false} activeDot={{ r: 4, strokeWidth: 2, stroke: t.tooltip.background as string }} connectNulls={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
    {sparse.map((x) => (
      <p key={x.s.key} className="mt-1 text-[11px] text-slate-500">{x.s.label} has a value for {x.at.join(" and ")} only, so it shows as a dot.</p>
    ))}
    </>
  );
}

/** Dashed guide lines at fixed values, such as the Health band thresholds, so a bar's meaning shows without a legend lookup. */
export interface RefLine { y: number; label: string }

export function CompareBars({
  data, series, xKey, format = "pct", height = 260, refLines, entities,
}: { data: Record<string, number | string | null>[]; series: SeriesDef[]; xKey: string; format?: "pct" | "number"; height?: number; refLines?: RefLine[]; entities?: boolean }) {
  const t = useChartTheme(entities);
  const f = (v: number) => (format === "pct" ? pctFmt(v) : new Intl.NumberFormat("en-US").format(v));
  return (
    <ChartFrame height={height} label={`Comparison of ${series.map((s) => s.label).join(", ")} by ${xKey}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: refLines ? 76 : 12, bottom: 0, left: 0 }} barGap={4}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} interval={0} dy={6} />
          <YAxis tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} tickFormatter={f} width={44} domain={refLines ? [0, 100] : undefined} />
          <Tooltip formatter={(v) => f(Number(v))} contentStyle={t.tooltip} labelStyle={{ color: t.tooltip.color, fontWeight: 600 }} itemStyle={{ color: t.tooltip.color }} cursor={{ fill: t.cursor }} />
          {refLines?.map((r) => (
            <ReferenceLine key={r.y} y={r.y} stroke={t.tick} strokeDasharray="4 4" strokeOpacity={0.55} ifOverflow="extendDomain"
              label={{ value: `${r.label} ${r.y}`, position: "right", fontSize: 10, fill: t.tick }} />
          ))}
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: t.tick }}>{v}</span>} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={t.color(s, i)} radius={[6, 6, 0, 0]} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
