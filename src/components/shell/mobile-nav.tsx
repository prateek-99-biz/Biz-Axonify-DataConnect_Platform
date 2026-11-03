"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeHref, NAV, NAV_GROUPS } from "./nav";
import type { Permission } from "@/server/auth/rbac";

/** The sidebar is hidden below the md breakpoint. This bar names the current page and opens the whole list, so no page hides off the edge of a scrolling strip. */
export function MobileNav({ allowed }: { allowed: Permission[] }) {
  const path = usePathname();
  const sp = useSearchParams();
  const qs = ["client", "industry", "period"].filter((k) => sp.get(k)).map((k) => `${k}=${encodeURIComponent(sp.get(k)!)}`).join("&");
  const current = activeHref(path);
  const visible = NAV.filter((n) => allowed.includes(n.perm));
  const here = visible.find((n) => n.href === current);
  const [open, setOpen] = useState(false);

  // Choosing a page closes the list.
  useEffect(() => setOpen(false), [path]);

  return (
    <nav aria-label="Primary" className="glass shrink-0 !rounded-2xl p-1 md:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold">
        <Menu className="h-5 w-5 text-brand-ink" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{here ? here.label : "Menu"}</span>
        <span className="text-xs font-normal text-slate-500">{open ? "Close" : "All Pages"}</span>
        <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id="mobile-menu" className="max-h-[60vh] overflow-y-auto px-1 pb-2">
          {NAV_GROUPS.map((group) => {
            const items = visible.filter((n) => n.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mt-2">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group}</p>
                <ul>
                  {items.map((n) => {
                    const active = n.href === current;
                    return (
                      <li key={n.href}>
                        <Link href={qs ? `${n.href}?${qs}` : n.href} aria-current={active ? "page" : undefined}
                          className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", active ? "bg-brand font-semibold text-navy" : "text-slate-700 hover:bg-brand/15")}>
                          <n.icon className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="min-w-0">
                            <span className="block">{n.label}</span>
                            <span className={cn("block text-[11px] font-normal", active ? "text-navy/70" : "text-slate-500")}>{n.hint}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}
