/** Calendar quarters (fiscal calendar is an open assumption — see docs/ASSUMPTIONS.md). */
export type Quarter = 1 | 2 | 3 | 4;

export interface Period {
  year: number;
  /** null = full calendar year */
  quarter: Quarter | null;
}

export function quarterOf(date: Date): Period {
  return { year: date.getUTCFullYear(), quarter: (Math.floor(date.getUTCMonth() / 3) + 1) as Quarter };
}

export function periodKey(p: Period): string {
  return p.quarter ? `${p.year}-Q${p.quarter}` : `${p.year}`;
}

export function parsePeriodKey(key: string): Period | null {
  const m = /^(\d{4})(?:-Q([1-4]))?$/.exec(key);
  if (!m) return null;
  return { year: Number(m[1]), quarter: m[2] ? (Number(m[2]) as Quarter) : null };
}

export function periodLabel(p: Period): string {
  return p.quarter ? `Q${p.quarter} ${p.year}` : `FY ${p.year}`;
}

/** Previous period of the same granularity (QoQ for quarters, YoY for years). */
export function previousPeriod(p: Period): Period {
  if (!p.quarter) return { year: p.year - 1, quarter: null };
  return p.quarter === 1 ? { year: p.year - 1, quarter: 4 } : { year: p.year, quarter: (p.quarter - 1) as Quarter };
}

/** Same period one year earlier (YoY comparator). */
export function yearAgo(p: Period): Period {
  return { year: p.year - 1, quarter: p.quarter };
}

/** Quarter keys covered by a period, in order. */
export function quartersIn(p: Period): string[] {
  return p.quarter ? [periodKey(p)] : [1, 2, 3, 4].map((q) => `${p.year}-Q${q}`);
}

export function compareQuarterKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Inclusive range of quarter keys between two quarter periods. */
export function quarterRange(from: Period, to: Period): string[] {
  const out: string[] = [];
  let y = from.year;
  let q = from.quarter ?? 1;
  const endY = to.year;
  const endQ = to.quarter ?? 4;
  while (y < endY || (y === endY && q <= endQ)) {
    out.push(`${y}-Q${q}`);
    q++;
    if (q > 4) {
      q = 1;
      y++;
    }
  }
  return out;
}
