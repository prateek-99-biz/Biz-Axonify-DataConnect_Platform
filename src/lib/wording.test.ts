import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { titleCase } from "./labels";

/** Every source file that can put a heading, KPI label or table header on screen. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

// Headings and labels only: page and card titles, KPI labels, table column headers. Sentences (empty-state messages,
// tooltips, hints) are written as normal sentences and are not checked.
const HEADING = /<(?:CardHeader|PageHeader)\b[^>]*?\btitle="([^"{}]+)"|<(?:KpiTile|KpiCard)\b[^>]*?\blabel="([^"{}]+)"|\bheader: "([^"]+)"/g;

// Written as the unit or brand people expect, not by the Title Case rule.
const ALLOWED = new Set(["Main Driver (pts)", "Axonify Data Connect", "Biz Customer Intelligence"]);

describe("headings, KPI labels and table headers are in Title Case", () => {
  const found: { file: string; text: string }[] = [];
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(HEADING)) found.push({ file: file.split("\\").join("/"), text: m[1] ?? m[2] ?? m[3] });
  }

  it("finds the headings it is meant to check", () => {
    expect(found.length).toBeGreaterThan(100);
  });

  it("has none written another way", () => {
    const wrong = found.filter((h) => !ALLOWED.has(h.text) && titleCase(h.text) !== h.text).map((h) => `${h.file}: "${h.text}" should be "${titleCase(h.text)}"`);
    expect(wrong).toEqual([]);
  });
});
