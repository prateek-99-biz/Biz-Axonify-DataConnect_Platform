/**
 * How names and keywords are written on screen. Headings, table headers and labels use Title Case; descriptions and hints
 * stay as normal sentences. Keys this app stores itself, such as `at_risk` or `ok`, are never shown as saved.
 *
 * Anything that comes from Axonify or BigQuery is shown exactly as received and never reformatted here: client names (the
 * Axonify site each client sits in), team, topic and subject names, and the learner segments the query returns.
 */

// Small words stay lower case inside a heading (but not at the start or end).
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "per", "the", "to", "vs", "via"]);

// Written in capitals wherever they appear.
const ACRONYMS = new Set(["csm", "crm", "qbr", "kpi", "csv", "yoy", "uae", "ksa", "cx", "hr", "it", "gm", "km", "dx", "utc", "id", "ui", "l1", "l2", "l3"]);

function capitalise(word: string): string {
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** "knowledge growth by topic" becomes "Knowledge Growth by Topic". Hyphenated words are capitalised part by part. */
export function titleCase(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => {
      const bare = w.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (i > 0 && i < words.length - 1 && SMALL_WORDS.has(bare)) return w.toLowerCase();
      return w.split("-").map((part) => (/^[a-z0-9]+$/i.test(part) ? capitalise(part) : part.replace(/[a-z0-9]+/gi, capitalise))).join("-");
    })
    .join(" ");
}

/** "at_risk" and "atRisk" become "At Risk". For stored keys that have no hand-written label. */
export function humanize(key: string): string {
  return titleCase(key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_]+/g, " "));
}

/** Status of a sync run or a data-source check. */
export const STATUS_LABEL: Record<string, string> = {
  ok: "Succeeded", failed: "Failed", running: "Running", stale: "Stale", incomplete: "Incomplete", missing: "Missing",
  approved: "Approved", provisional: "Provisional",
};
export const statusLabel = (status: string): string => STATUS_LABEL[status] ?? humanize(status);

/** Account lifecycle and task states, written in words. */
export const lifecycleLabel = (value: string): string => humanize(value);

/** Account health bands, as written on screen and in exports. */
export const RISK_LABEL: Record<string, string> = {
  healthy: "Healthy", moderate: "Moderate", at_risk: "At Risk", critical: "Critical", unknown: "No Data",
};
export const riskLabel = (risk: string): string => RISK_LABEL[risk] ?? humanize(risk);
