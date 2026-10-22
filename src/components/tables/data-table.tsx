"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from "lucide-react";
import { Button, EmptyState, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface Column { key: string; header: string; align?: "left" | "right"; hint?: string }
export interface Cell { v: string | number | null; node?: ReactNode }
export interface TableRow { id: string; href?: string; cells: Record<string, Cell> }

export function DataTable({
  columns, rows, searchable = true, canExport = false, exportName = "export", pageSize = 25, emptyTitle = "No matching records", emptyHint,
}: {
  columns: Column[]; rows: TableRow[]; searchable?: boolean; canExport?: boolean; exportName?: string; pageSize?: number; emptyTitle?: string; emptyHint?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = needle ? rows.filter((row) => Object.values(row.cells).some((c) => String(c.v ?? "").toLowerCase().includes(needle))) : rows;
    if (sort) {
      r = [...r].sort((a, b) => {
        const x = a.cells[sort.key]?.v, y = b.cells[sort.key]?.v;
        if (x == null && y == null) return 0;
        if (x == null) return 1; // nulls always last
        if (y == null) return -1;
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return r;
  }, [rows, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const visible = filtered.slice(cur * pageSize, (cur + 1) * pageSize);

  function exportCsv() {
    const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const csv = [columns.map((c) => esc(c.header)).join(","), ...filtered.map((r) => columns.map((c) => esc(r.cells[c.key]?.v)).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {(searchable || canExport) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          {searchable ? (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <Input aria-label="Filter table" className="pl-8" placeholder="Filter rows…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
            </div>
          ) : <span />}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{filtered.length} row{filtered.length === 1 ? "" : "s"}</span>
            {canExport && <Button size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden /> CSV</Button>}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-slate-50 text-xs text-slate-500">
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const Icon = !active ? ArrowUpDown : sort!.dir === 1 ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} scope="col" title={c.hint} aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"} className={cn("px-4 py-2 font-medium", c.align === "right" ? "text-right" : "text-left")}>
                    <button className="inline-flex items-center gap-1 hover:text-navy" onClick={() => setSort(active && sort!.dir === -1 ? null : { key: c.key, dir: active ? -1 : 1 })}>
                      {c.header}<Icon className="h-3 w-3" aria-hidden />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-brand-pale/40">
                {columns.map((c, i) => {
                  const cell = r.cells[c.key];
                  const content = cell?.node ?? (cell?.v == null ? <span className="text-slate-400">—</span> : cell.v);
                  return (
                    <td key={c.key} className={cn("px-4 py-2", c.align === "right" && "text-right tabular-nums")}>
                      {i === 0 && r.href ? <Link href={r.href} className="font-medium text-navy hover:underline">{content}</Link> : content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <EmptyState title={emptyTitle}>{emptyHint ?? (q ? "Try a different search term." : undefined)}</EmptyState>}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-slate-500">
          <span>Page {cur + 1} of {pages}</span>
          <div className="flex gap-2">
            <Button size="sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</Button>
            <Button size="sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
