export interface Staleness { level: "fresh" | "stale" | "very_stale"; hours: number }

/** How old the data is. Over a day means a nightly refresh was missed; over three days means several were. */
export function staleness(asOfIso: string, nowMs: number): Staleness {
  const hours = Math.max(0, (nowMs - Date.parse(asOfIso)) / 3_600_000);
  return { hours, level: hours > 72 ? "very_stale" : hours > 24 ? "stale" : "fresh" };
}

export function ageLabel(hours: number): string {
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 24)} days`;
}
