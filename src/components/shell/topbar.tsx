"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, LogOut, Search } from "lucide-react";
import { Badge, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface NotificationItem { key: string; clientId: string; clientName: string; severity: "warning" | "critical"; title: string; detail: string }

const LABELS: Record<string, string> = { portfolio: "Portfolio", clients: "Clients", "data-reliability": "Data reliability", settings: "Settings" };

export function Breadcrumbs() {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-slate-500">
      <Link href="/portfolio" className="hover:text-navy">Home</Link>
      {parts.map((p, i) => {
        const href = "/" + parts.slice(0, i + 1).join("/");
        const label = LABELS[p] ?? (i === 1 && parts[0] === "clients" ? "Client 360" : p);
        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" aria-hidden />
            {i === parts.length - 1 ? <span className="font-medium text-navy" aria-current="page">{label}</span> : <Link href={href} className="hover:text-navy">{label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open, close]);
  return ref;
}

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; industry: string }[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        if (res.ok) { setHits((await res.json()).clients); setOpen(true); }
      } catch { /* aborted */ }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
      <Input aria-label="Search clients" placeholder="Search clients…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)} />
      {open && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-line bg-white shadow-lg" role="listbox">
          {hits.length === 0 && <li className="px-3 py-2 text-xs text-slate-500">No clients match “{q}”.</li>}
          {hits.map((h) => (
            <li key={h.id}>
              <button role="option" aria-selected={false} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-pale"
                onClick={() => { setOpen(false); setQ(""); router.push(`/clients/${h.id}`); }}>
                {h.name}<span className="text-xs text-slate-500">{h.industry}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NotificationCentre({ items, canAck }: { items: NotificationItem[]; canAck: boolean }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(items);
  const ref = useOutsideClose(open, () => setOpen(false));
  useEffect(() => setList(items), [items]);

  async function ack(key: string) {
    setList((l) => l.filter((x) => x.key !== key));
    await fetch("/api/alerts/ack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alertKey: key }) });
  }

  return (
    <div ref={ref} className="relative">
      <button aria-label={`Notifications (${list.length})`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="relative rounded-md p-2 hover:bg-brand-pale">
        <Bell className="h-5 w-5" aria-hidden />
        {list.length > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">{list.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-96 max-w-[90vw] rounded-lg border border-line bg-white shadow-lg">
          <div className="border-b border-line px-4 py-2 text-sm font-semibold">Alerts <span className="font-normal text-slate-500">(derived from metrics)</span></div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {list.length === 0 && <li className="px-4 py-6 text-center text-xs text-slate-500">No open alerts for the selected period.</li>}
            {list.slice(0, 20).map((n) => (
              <li key={n.key} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge tone={n.severity === "critical" ? "critical" : "warn"}>{n.severity}</Badge>
                  <Link href={`/clients/${n.clientId}`} onClick={() => setOpen(false)} className="text-sm font-medium hover:underline">{n.clientName}</Link>
                </div>
                <p className="mt-1 text-xs"><span className="font-medium">{n.title}.</span> {n.detail}</p>
                {canAck && <button onClick={() => ack(n.key)} className="mt-1 text-xs text-slate-500 underline hover:text-navy">Acknowledge</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ProfileMenu({ name, email, role, signOutAction }: { name: string; email: string; role: string; signOutAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const initials = name.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="User menu" aria-expanded={open} className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white")}>{initials || "U"}</button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-line bg-white p-3 shadow-lg">
          <p className="text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-slate-500">{email}</p>
          <Badge tone="good" className="mt-2">{role}</Badge>
          <form action={signOutAction} className="mt-3 border-t border-line pt-2">
            <button className="flex items-center gap-2 text-sm text-slate-600 hover:text-navy"><LogOut className="h-4 w-4" aria-hidden /> Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
