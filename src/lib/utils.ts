import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtNumber(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
}

export function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}
