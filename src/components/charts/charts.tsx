"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const CHART_COLORS = ["#82C657", "#1D2B43", "#F59E0B", "#5B8DEF", "#9CA3AF"];

export interface SeriesDef { key: string; label: string; color?: string }

const pctFmt = (v: number) => `${(v * 100).toFixed(0)}%`;

export function TrendChart({
  data, series, xKey = "period", format = "pct", height = 260,
}: { data: Record<string, number | string | null>[]; series: SeriesDef[]; xKey?: string; format?: "pct" | "number" | "score"; height?: number }) {
  const f = (v: number) => (format === "pct" ? pctFmt(v) : format === "score" ? v.toFixed(0) : new Intl.NumberFormat("en-US").format(v));
  return (
    <div style={{ height }} role="img" aria-label={`Trend of ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#E5E9EF" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#E5E9EF" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={f} width={44} />
          <Tooltip formatter={(v) => f(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E9EF" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompareBars({
  data, series, xKey, format = "pct", height = 260,
}: { data: Record<string, number | string | null>[]; series: SeriesDef[]; xKey: string; format?: "pct" | "number"; height?: number }) {
  const f = (v: number) => (format === "pct" ? pctFmt(v) : new Intl.NumberFormat("en-US").format(v));
  return (
    <div style={{ height }} role="img" aria-label={`Comparison of ${series.map((s) => s.label).join(", ")} by ${xKey}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#E5E9EF" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#E5E9EF" }} interval={0} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={f} width={44} />
          <Tooltip formatter={(v) => f(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E9EF" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
