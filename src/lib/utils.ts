import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtNumber(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
}

export function fmtCompact(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  // A share that is not zero must never read as zero: 2 people in 7,000 is "<0.1%", not "0.0%".
  const smallest = 0.5 * 10 ** -(digits + 2);
  if (n > 0 && n < smallest) return `<${(2 * smallest * 100).toFixed(digits)}%`;
  return `${(n * 100).toFixed(digits)}%`;
}

/** Health as a whole number that never crosses a band: 44.7 reads 44 (Critical), not 45 (At Risk), because the bands are whole numbers. */
export function fmtHealth(score: number | null | undefined): string {
  return score == null || Number.isNaN(score) ? "—" : String(Math.floor(score));
}
