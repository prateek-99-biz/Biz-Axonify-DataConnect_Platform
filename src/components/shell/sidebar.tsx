"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { BizMark, BrandLogo } from "@/components/brand/brand-logo";
import { activeHref, NAV, NAV_GROUPS } from "./nav";
import type { Permission } from "@/server/auth/rbac";

const STORAGE_KEY = "ci_nav_collapsed";

/** Open by default with every page named and described, so nothing depends on knowing where to hover. It can be folded to an icon rail, and the choice is remembered. */
export function Sidebar({ allowed }: { allowed: Permission[] }) {
  const path = usePathname();
  const sp = useSearchParams();
  // Carry the active filters across navigation.
  const qs = ["client", "industry", "period"].filter((k) => sp.get(k)).map((k) => `${k}=${encodeURIComponent(sp.get(k)!)}`).join("&");
  const current = activeHref(path);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === "1"); } catch { /* storage unavailable: stay open */ }
  }, []);
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem(STORAGE_KEY, c ? "0" : "1"); } catch { /* not remembered */ }
    return !c;
  });

  // In the folded rail the text appears while the pointer or keyboard focus is on the sidebar.
  const reveal = collapsed ? "opacity-0 transition-opacity duration-200 group-hover/side:opacity-100 group-has-[:focus-visible]/side:opacity-100" : "";
  const visible = NAV.filter((n) => allowed.includes(n.perm));

  return (
    // The wrapper holds the sidebar's slot in the layout; when folded, the panel grows over the page on hover or focus.
    <div className={cn("relative z-30 hidden shrink-0 transition-[width] duration-300 md:block", collapsed ? "w-[4.5rem]" : "w-64")}>
      <aside
        className={cn("glass-nav group/side absolute inset-y-0 left-0 flex flex-col overflow-hidden whitespace-nowrap transition-[width] duration-300",
          collapsed ? "w-[4.5rem] hover:w-64 has-[:focus-visible]:w-64" : "w-full")}
        aria-label="Primary">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-brand/30 blur-3xl dark:bg-brand/15" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-biz-purple/15 blur-3xl dark:bg-biz-purple/20" />
        <div className="relative flex h-16 shrink-0 items-center gap-3 px-4">
          <BrandLogo size={40} />
          <span className={cn("leading-tight", reveal)}>
            <span className="block text-sm font-bold tracking-tight">Biz Customer</span>
            <span className="block text-xs font-medium text-brand-ink">Intelligence · Axonify</span>
          </span>
        </div>
        <div className="relative mx-4 h-px shrink-0 bg-gradient-to-r from-biz-purple/40 via-brand/60 to-biz-orange/40" aria-hidden />
        <nav className="relative flex-1 overflow-y-auto px-3 py-3">
          {NAV_GROUPS.map((group) => {
            const items = visible.filter((n) => n.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-3">
                <p className={cn("px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider", group === "Internal" ? "text-biz-purple" : "text-slate-500", reveal)}>{group}</p>
                <ul className="space-y-0.5">
                  {items.map((n) => {
                    const active = n.href === current;
                    return (
                      <li key={n.href}>
                        <Link href={qs ? `${n.href}?${qs}` : n.href} aria-current={active ? "page" : undefined} title={`${n.label}: ${n.hint}`}
                          className={cn("group relative flex items-center gap-3 rounded-xl px-[10px] py-2 text-sm transition-all",
                            active
                              ? "bg-gradient-to-r from-brand to-brand-accent font-semibold text-navy shadow-[0_10px_26px_-12px_rgb(var(--brand-accent)/0.9)]"
                              : "text-slate-600 hover:bg-white/60 hover:text-ink dark:hover:bg-white/10")}>
                          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                            active ? "bg-white/35" : n.group === "Internal" ? "bg-biz-purple/15 text-biz-purple group-hover:bg-biz-purple/25" : "bg-brand/10 text-brand-ink group-hover:bg-brand/20")}>
                            <n.icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span className={cn("min-w-0 leading-tight", reveal)}>
                            <span className="block truncate">{n.label}</span>
                            <span className={cn("block truncate text-[11px] font-normal", active ? "text-navy/70" : "text-slate-500")}>{n.hint}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="relative shrink-0 border-t hairline px-3 py-2">
          <p className={cn("flex items-center gap-2 px-[10px] pb-2 pt-1 text-[11px] text-slate-500", reveal)}><BizMark />A Biz Group dashboard for Axonify</p>
          <button type="button" onClick={toggle} aria-pressed={collapsed} aria-label={collapsed ? "Keep the menu open" : "Fold the menu to icons"}
            className="group flex w-full items-center gap-3 rounded-xl px-[10px] py-2 text-sm text-slate-600 transition-colors hover:bg-white/60 hover:text-ink dark:hover:bg-white/10">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-ink group-hover:bg-brand/20">
              {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <PanelLeftClose className="h-4 w-4" aria-hidden />}
            </span>
            <span className={reveal}>{collapsed ? "Keep Menu Open" : "Fold Menu"}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
