"use client";

import { useId, type CSSProperties } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIsDark } from "@/components/shell/theme-toggle";

/** Axonify palette; the dark set is lifted so every series keeps >= 3:1 contrast against the dark glass. */
export const PALETTE = {
  light: ["#79C753", "#1D2B43", "#00AA61", "#D97706", "#3B6FD8", "#8A97AB"],
  dark: ["#8BD866", "#8CB8FF", "#2DD48C", "#FBBF24", "#C4B5FD", "#CBD5E1"],
};
const NAVY = "#1D2B43";

export interface SeriesDef { key: string; label: string; color?: string }

const pctFmt = (v: number) => `${(v * 100).toFixed(0)}%`;

export function useChartTheme() {
  const dark = useIsDark();
  const colors = dark ? PALETTE.dark : PALETTE.light;
  return {
    // Navy disappears on dark glass, so explicit navy series are swapped for the dark palette's second colour.
    color: (s: SeriesDef, i: number) => (s.color && !(dark && s.color.toUpperCase() === NAVY) ? s.color : colors[i % colors.length]),
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

export function TrendChart({
  data, series, xKey = "period", format = "pct", height = 260,
}: { data: Record<string, number | string | null>[]; series: SeriesDef[]; xKey?: string; format?: "pct" | "number" | "score"; height?: number }) {
  const t = useChartTheme();
  const uid = "g" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const f = (v: number) => (format === "pct" ? pctFmt(v) : format === "score" ? v.toFixed(0) : new Intl.NumberFormat("en-US").format(v));
  return (
    <div style={{ height }} role="img" aria-label={`Trend of ${series.map((s) => s.label).join(", ")}`}>
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
              dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: t.tooltip.background as string }} connectNulls={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompareBars({
  data, series, xKey, format = "pct", height = 260,
}: { data: Record<string, number | string | null>[]; series: SeriesDef[]; xKey: string; format?: "pct" | "number"; height?: number }) {
  const t = useChartTheme();
  const f = (v: number) => (format === "pct" ? pctFmt(v) : new Intl.NumberFormat("en-US").format(v));
  return (
    <div style={{ height }} role="img" aria-label={`Comparison of ${series.map((s) => s.label).join(", ")} by ${xKey}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={4}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} interval={0} dy={6} />
          <YAxis tick={{ fontSize: 11, fill: t.tick }} tickLine={false} axisLine={false} tickFormatter={f} width={44} />
          <Tooltip formatter={(v) => f(Number(v))} contentStyle={t.tooltip} labelStyle={{ color: t.tooltip.color, fontWeight: 600 }} itemStyle={{ color: t.tooltip.color }} cursor={{ fill: t.cursor }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: t.tick }}>{v}</span>} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={t.color(s, i)} radius={[6, 6, 0, 0]} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
