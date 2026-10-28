"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { Badge, Select } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { monthLabel } from "@/server/dashboard/calc";
import { cn } from "@/lib/utils";
import { QBR_PAGES } from "./pages";

export interface QbrShellProps {
  internal: boolean;
  userName: string;
  roleLabel: string;
  clients: { id: string; name: string }[];
  clientId: string | null;
  clientName: string | null;
  months: string[];
  range: { from: string; to: string } | null;
  mock: boolean;
  asOf: string | null;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}

const KEEP = ["client", "from", "to"];

export function QbrShell(p: QbrShellProps) {
  const path = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);

  const keep = new URLSearchParams();
  KEEP.forEach((k) => { const v = sp.get(k); if (v) keep.set(k, v); });
  const href = (h: string) => (keep.toString() ? `${h}?${keep.toString()}` : h);

  function setParam(k: string, v: string) {
    const next = new URLSearchParams(sp.toString());
    next.set(k, v);
    start(() => router.replace(`${path}?${next.toString()}`));
  }

  // The layout cannot see the URL, so the selectors resolve the same params the pages do.
  const urlClient = sp.get("client");
  const clientId = p.internal && p.clients.some((c) => c.id === urlClient) ? urlClient! : p.clientId;
  const clientName = p.clients.find((c) => c.id === clientId)?.name ?? p.clientName;
  const pickMonth = (k: string, dflt: string) => (p.months.includes(sp.get(k) ?? "") ? sp.get(k)! : dflt);
  const from = p.range ? pickMonth("from", p.range.from) : "";
  const to = p.range ? pickMonth("to", p.range.to) : "";

  const initials = p.userName.split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  const asOf = p.asOf ? new Date(p.asOf).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : null;

  return (
    <div className="flex h-screen gap-3 overflow-hidden p-3">
      <aside className="glass-nav hidden w-64 shrink-0 flex-col lg:flex" aria-label="Dashboard pages">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-brand/30 blur-3xl dark:bg-brand/15" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-brand-accent/20 blur-3xl dark:bg-brand-accent/10" />
        <div className="relative flex h-16 items-center gap-3 px-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-accent text-sm font-extrabold text-navy shadow-[0_8px_24px_-8px_rgb(var(--brand)/0.9)] ring-1 ring-white/60 dark:ring-white/10">Ax</span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight">Axonify Data Connect</span>
            <span className="block text-xs font-medium text-brand-ink">{p.internal ? "Internal view" : "Quarterly business review"}</span>
          </span>
        </div>
        <div className="relative mx-4 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" aria-hidden />
        <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {QBR_PAGES.map((n) => {
            const active = n.href === "/qbr" ? path === "/qbr" : path === n.href || path.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={href(n.href)} aria-current={active ? "page" : undefined}
                className={cn("group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all",
                  active ? "bg-gradient-to-r from-brand to-brand-accent font-semibold text-navy shadow-[0_10px_26px_-12px_rgb(var(--brand-accent)/0.9)]" : "text-slate-600 hover:bg-white/60 hover:text-ink dark:hover:bg-white/10")}>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", active ? "bg-white/35" : "bg-brand/10 text-brand-ink group-hover:bg-brand/20")}>
                  <n.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        {p.internal && (
          <Link href="/portfolio" className="relative m-3 rounded-xl border border-line/60 bg-white/40 px-3 py-2 text-center text-xs font-medium text-slate-600 transition-colors hover:bg-white/70 hover:text-ink dark:bg-white/5 dark:hover:bg-white/10">
            ← Back to team workspace
          </Link>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="glass relative z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5" aria-busy={pending}>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Client
            {p.clients.length > 1 && p.internal ? (
              <Select aria-label="Client" value={clientId ?? ""} onChange={(e) => setParam("client", e.target.value)} className="max-w-[14rem]">
                {p.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            ) : <span className="rounded-xl border border-line bg-slate-50/60 px-3 py-1.5 text-sm font-semibold text-ink">{clientName ?? "—"}</span>}
          </label>
          {p.range && p.months.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-500">From
                <Select aria-label="From month" value={from} onChange={(e) => setParam("from", e.target.value)}>
                  {p.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </Select>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-500">To
                <Select aria-label="To month" value={to} onChange={(e) => setParam("to", e.target.value)}>
                  {p.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </Select>
              </label>
            </>
          )}
          {pending && <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden />Updating…</span>}
          <div className="ml-auto flex items-center gap-3">
            {p.internal && clientId && <Link href={`/clients/${clientId}`} className="text-xs font-medium text-brand-ink underline">Open Client 360</Link>}
            {p.mock && <Badge tone="warn" title="All figures are synthetic development data">MOCK DATA</Badge>}
            <ThemeToggle />
            <div className="relative">
              <button onClick={() => setMenu((o) => !o)} aria-label="User menu" aria-expanded={menu}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-accent text-xs font-bold text-navy shadow-[0_6px_18px_-8px_rgb(var(--brand)/0.9)] ring-2 ring-white/60 dark:ring-white/10">{initials || "U"}</button>
              {menu && (
                <div className="glass-strong absolute right-0 z-30 mt-2 w-64 p-4">
                  <p className="text-sm font-semibold">{p.userName}</p>
                  <Badge tone="good" className="mt-2">{p.roleLabel}</Badge>
                  <form action={p.signOutAction} className="mt-3 border-t hairline pt-3">
                    <button className="flex items-center gap-2 text-sm text-slate-600 hover:text-ink"><LogOut className="h-4 w-4" aria-hidden /> Sign out</button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

        <nav aria-label="Dashboard pages" className="glass flex shrink-0 gap-1 overflow-x-auto !rounded-full p-1 [scrollbar-width:none] lg:hidden">
          {QBR_PAGES.map((n) => {
            const active = n.href === "/qbr" ? path === "/qbr" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={href(n.href)} aria-current={active ? "page" : undefined}
                className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-all", active ? "bg-brand font-semibold text-navy" : "text-slate-600 hover:bg-slate-100 hover:text-ink")}>{n.short}</Link>
            );
          })}
        </nav>

        <main className="-mx-1 flex-1 overflow-y-auto px-1 pb-4">{p.children}</main>
        {asOf && <p className="shrink-0 text-center text-xs text-slate-500">Data updated {asOf} · Source: Axonify DataConnect (BigQuery)</p>}
      </div>
    </div>
  );
}
