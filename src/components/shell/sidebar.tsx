"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { BRAND_ICON, NAV } from "./nav";
import type { Permission } from "@/server/auth/rbac";

export function Sidebar({ allowed }: { allowed: Permission[] }) {
  const path = usePathname();
  const sp = useSearchParams();
  // Carry the active filters across navigation.
  const qs = ["client", "industry", "period"].filter((k) => sp.get(k)).map((k) => `${k}=${encodeURIComponent(sp.get(k)!)}`).join("&");
  const Brand = BRAND_ICON;

  return (
    // The rail keeps a fixed 4.5rem slot in the layout; the panel grows over the page on hover or keyboard focus.
    <div className="relative z-30 hidden w-[4.5rem] shrink-0 md:block">
    <aside className="glass-nav group/side absolute inset-y-0 left-0 flex w-[4.5rem] flex-col overflow-hidden whitespace-nowrap transition-[width] duration-300 hover:w-64 focus-within:w-64" aria-label="Primary">
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-brand/30 blur-3xl dark:bg-brand/15" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-brand-accent/20 blur-3xl dark:bg-brand-accent/10" />
      <div className="relative flex h-16 items-center gap-3 px-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-accent shadow-[0_8px_24px_-8px_rgb(var(--brand)/0.9)] ring-1 ring-white/60 dark:ring-white/10">
          <Brand className="h-5 w-5 text-navy" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-tight">Biz Customer</span>
          <span className="block text-xs font-medium text-brand-ink">Intelligence · Axonify</span>
        </span>
      </div>
      <div className="relative mx-4 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" aria-hidden />
      <nav className="relative flex-1 space-y-1 px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Workspace</p>
        {NAV.filter((n) => allowed.includes(n.perm)).map((n) => {
          const active = path === n.href || path.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={qs ? `${n.href}?${qs}` : n.href} aria-current={active ? "page" : undefined}
              className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-gradient-to-r from-brand to-brand-accent font-semibold text-navy shadow-[0_10px_26px_-12px_rgb(var(--brand-accent)/0.9)]"
                  : "text-slate-600 hover:bg-white/60 hover:text-ink dark:hover:bg-white/10")}>
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                active ? "bg-white/35" : "bg-brand/10 text-brand-ink group-hover:bg-brand/20")}>
                <n.icon className="h-4 w-4" aria-hidden />
              </span>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </aside>
    </div>
  );
}
