"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface SlicerNode { id: string; name: string; parentId: string | null }

/** Selected set holds leaf ids; an empty selection means "everything" (like a Power BI slicer). */
export function TreeSlicer({
  title, nodes, selected, onChange,
}: { title: string; nodes: SlicerNode[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  const kids = useMemo(() => {
    const m = new Map<string | null, SlicerNode[]>();
    for (const n of nodes) m.set(n.parentId, [...(m.get(n.parentId) ?? []), n]);
    return m;
  }, [nodes]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(nodes.filter((n) => n.parentId === null).map((n) => n.id)));

  const leavesOf = (id: string): string[] => {
    const c = kids.get(id) ?? [];
    return c.length === 0 ? [id] : c.flatMap((x) => leavesOf(x.id));
  };
  const toggle = (id: string) => {
    const leaves = leavesOf(id);
    const next = new Set(selected);
    const all = leaves.every((l) => next.has(l));
    leaves.forEach((l) => (all ? next.delete(l) : next.add(l)));
    onChange(next);
  };
  const state = (id: string) => {
    const leaves = leavesOf(id);
    const n = leaves.filter((l) => selected.has(l)).length;
    return n === 0 ? "none" : n === leaves.length ? "all" : "some";
  };

  const row = (n: SlicerNode, depth: number): React.ReactNode => {
    const c = kids.get(n.id) ?? [];
    const st = state(n.id);
    return (
      <li key={n.id}>
        <div className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-brand/10" style={{ paddingLeft: 6 + depth * 16 }}>
          {c.length > 0 ? (
            <button type="button" aria-label={open.has(n.id) ? `Collapse ${n.name}` : `Expand ${n.name}`} aria-expanded={open.has(n.id)}
              onClick={() => setOpen((o) => { const x = new Set(o); if (x.has(n.id)) x.delete(n.id); else x.add(n.id); return x; })} className="text-slate-500">
              {open.has(n.id) ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
            </button>
          ) : <span className="w-4" />}
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={st === "all"} ref={(el) => { if (el) el.indeterminate = st === "some"; }} onChange={() => toggle(n.id)} className="h-4 w-4 shrink-0 accent-[rgb(var(--brand-accent))]" />
            <span className={cn("truncate", c.length > 0 && "font-semibold")} title={n.name}>{n.name}</span>
          </label>
        </div>
        {c.length > 0 && open.has(n.id) && <ul>{c.map((x) => row(x, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <Card className="flex max-h-72 flex-col xl:max-h-[34rem]">
      <CardHeader title={title} action={selected.size > 0 ? <button type="button" onClick={() => onChange(new Set())} className="text-xs text-brand-ink underline">Clear</button> : undefined} />
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">{(kids.get(null) ?? []).map((n) => row(n, 0))}</ul>
    </Card>
  );
}

export function ChecklistSlicer({
  title, options, selected, onChange, single = false,
}: { title: string; options: string[]; selected: Set<string>; onChange: (next: Set<string>) => void; single?: boolean }) {
  return (
    <Card className="flex max-h-60 flex-col xl:max-h-[26rem]">
      <CardHeader title={title} action={selected.size > 0 ? <button type="button" onClick={() => onChange(new Set())} className="text-xs text-brand-ink underline">Clear</button> : undefined} />
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {options.map((o) => (
          <li key={o}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand/10">
              <input type={single ? "radio" : "checkbox"} name={title} checked={selected.has(o)} className="h-4 w-4 accent-[rgb(var(--brand-accent))]"
                onChange={() => {
                  if (single) return onChange(new Set([o]));
                  const next = new Set(selected);
                  if (next.has(o)) next.delete(o); else next.add(o);
                  onChange(next);
                }} />
              <span className="truncate" title={o}>{o}</span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
