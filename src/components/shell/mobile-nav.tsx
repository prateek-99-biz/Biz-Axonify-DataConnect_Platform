"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import type { Permission } from "@/server/auth/rbac";

/** The sidebar is hidden below the md breakpoint; this strip keeps the same pages reachable on a phone. */
export function MobileNav({ allowed }: { allowed: Permission[] }) {
  const path = usePathname();
  const sp = useSearchParams();
  const qs = ["client", "industry", "period"].filter((k) => sp.get(k)).map((k) => `${k}=${encodeURIComponent(sp.get(k)!)}`).join("&");

  return (
    <nav aria-label="Primary" className="glass flex shrink-0 gap-1 overflow-x-auto !rounded-full p-1 [scrollbar-width:none] md:hidden">
      {NAV.filter((n) => allowed.includes(n.perm)).map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={qs ? `${n.href}?${qs}` : n.href} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-all", active ? "bg-brand font-semibold text-navy" : "text-slate-600 hover:bg-slate-100 hover:text-ink")}>
            <n.icon className="h-4 w-4" aria-hidden />{n.label}
          </Link>
        );
      })}
    </nav>
  );
}
