"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface SlicerNode { id: string; name: string; parentId: string | null }

const ROW_H = 32;
const OVERSCAN = 10;
const DEFAULT_VIEWPORT = 544;

/**
 * Selected set holds leaf ids; an empty selection means "everything" (like a Power BI slicer).
 *
 * Only the rows in view (plus a margin) are in the page. A client with thousands of topics or teams used to put
 * 15,000+ elements on the screen, and every layout the browser had to do (a chart measuring its labels, say) got slow
 * in proportion. Scrolling, expanding, searching by eye and selecting all work as before; only the off-screen rows are absent.
 */
export function TreeSlicer({
  title, nodes, selected, onChange,
}: { title: string; nodes: SlicerNode[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  const kids = useMemo(() => {
    const m = new Map<string | null, SlicerNode[]>();
    for (const n of nodes) { const list = m.get(n.parentId); if (list) list.push(n); else m.set(n.parentId, [n]); }
    return m;
  }, [nodes]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(nodes.filter((n) => n.parentId === null).map((n) => n.id)));
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight || DEFAULT_VIEWPORT);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Every row that is showing, in order (children only under an open parent).
  const flat = useMemo(() => {
    const out: { n: SlicerNode; depth: number; hasKids: boolean }[] = [];
    const walk = (list: SlicerNode[], depth: number) => {
      for (const n of list) {
        const c = kids.get(n.id);
        out.push({ n, depth, hasKids: !!c?.length });
        if (c?.length && open.has(n.id)) walk(c, depth + 1);
      }
    };
    walk(kids.get(null) ?? [], 0);
    return out;
  }, [kids, open]);

  const first = Math.max(0, Math.min(flat.length, Math.floor(scrollTop / ROW_H) - OVERSCAN));
  const last = Math.min(flat.length, Math.ceil((scrollTop + viewport) / ROW_H) + OVERSCAN);

  const row = ({ n, depth, hasKids }: (typeof flat)[number]) => {
    const st = state(n.id);
    return (
      <li key={n.id} style={{ height: ROW_H }}>
        <div className="flex h-full items-center gap-1.5 rounded-lg px-1.5 hover:bg-brand/10" style={{ paddingLeft: 6 + depth * 16 }}>
          {hasKids ? (
            <button type="button" aria-label={open.has(n.id) ? `Collapse ${n.name}` : `Expand ${n.name}`} aria-expanded={open.has(n.id)}
              onClick={() => setOpen((o) => { const x = new Set(o); if (x.has(n.id)) x.delete(n.id); else x.add(n.id); return x; })} className="text-slate-500">
              {open.has(n.id) ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
            </button>
          ) : <span className="w-4" />}
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={st === "all"} ref={(el) => { if (el) el.indeterminate = st === "some"; }} onChange={() => toggle(n.id)} className="h-4 w-4 shrink-0 accent-[rgb(var(--brand-accent))]" />
            <span className={cn("truncate", hasKids && "font-semibold")} title={n.name}>{n.name}</span>
          </label>
        </div>
      </li>
    );
  };

  return (
    <Card className="flex max-h-72 flex-col xl:max-h-[34rem]">
      <CardHeader title={title} action={selected.size > 0 ? <button type="button" onClick={() => onChange(new Set())} className="text-xs text-brand-ink underline">Clear</button> : undefined} />
      <ul ref={listRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="min-h-0 flex-1 overflow-y-auto p-2">
        <li aria-hidden style={{ height: first * ROW_H }} />
        {flat.slice(first, last).map(row)}
        <li aria-hidden style={{ height: (flat.length - last) * ROW_H }} />
      </ul>
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
