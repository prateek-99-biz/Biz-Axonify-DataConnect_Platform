"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_ICON, NAV } from "./nav";
import type { Permission } from "@/server/auth/rbac";

export function Sidebar({ allowed }: { allowed: Permission[] }) {
  const path = usePathname();
  const sp = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("ci_sidebar") === "1"); } catch { /* storage unavailable */ }
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("ci_sidebar", c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };
  // Carry the active filters across navigation.
  const qs = ["client", "industry", "period"].filter((k) => sp.get(k)).map((k) => `${k}=${encodeURIComponent(sp.get(k)!)}`).join("&");
  const Brand = BRAND_ICON;

  return (
    <aside className={cn("hidden shrink-0 flex-col bg-navy text-white transition-[width] md:flex", collapsed ? "w-16" : "w-60")} aria-label="Primary">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <Brand className="h-6 w-6 shrink-0 text-brand" aria-hidden />
        {!collapsed && <span className="text-sm font-semibold leading-tight">Biz Customer<br />Intelligence</span>}
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV.filter((n) => allowed.includes(n.perm)).map((n) => {
          const active = path === n.href || path.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={qs ? `${n.href}?${qs}` : n.href} title={collapsed ? n.label : undefined} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", active ? "bg-brand text-navy font-medium" : "text-white/80 hover:bg-white/10")}>
              <n.icon className="h-4 w-4 shrink-0" aria-hidden />
              {!collapsed && n.label}
            </Link>
          );
        })}
      </nav>
      <button onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="m-2 flex items-center gap-2 rounded-md px-3 py-2 text-xs text-white/70 hover:bg-white/10">
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
      </button>
    </aside>
  );
}
