import { BookOpen, Building2, GitCompareArrows, LayoutDashboard, LifeBuoy, Presentation, Settings, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import type { Permission } from "@/server/auth/rbac";

export type NavGroup = "Analyse" | "Internal" | "Admin" | "Help";

export interface NavItem { href: string; label: string; icon: LucideIcon; perm: Permission; group: NavGroup; hint: string }

/** Headings in the order they appear. Only routes that exist and work are listed; unbuilt phases are in docs/ROADMAP.md. */
export const NAV_GROUPS: NavGroup[] = ["Analyse", "Internal", "Admin", "Help"];

export const NAV: NavItem[] = [
  { href: "/portfolio", label: "Portfolio", icon: LayoutDashboard, perm: "portfolio:read", group: "Analyse", hint: "All clients at a glance" },
  { href: "/clients", label: "Clients", icon: Building2, perm: "clients:read", group: "Analyse", hint: "Directory and client profiles" },
  { href: "/clients/compare", label: "Compare Clients", icon: GitCompareArrows, perm: "clients:read", group: "Analyse", hint: "Side by side, by quarter" },
  { href: "/qbr", label: "Client Dashboards", icon: Presentation, perm: "dashboard:read", group: "Analyse", hint: "Quarterly review pages" },
  { href: "/csm", label: "CSM Portfolio", icon: UsersRound, perm: "dashboard:internal", group: "Internal", hint: "Books of business, renewals" },
  { href: "/data-reliability", label: "Data Reliability", icon: ShieldCheck, perm: "reliability:read", group: "Admin", hint: "Sync history and data checks" },
  { href: "/settings", label: "Settings", icon: Settings, perm: "settings:manage", group: "Admin", hint: "Users and Salesforce data" },
  { href: "/how-it-works", label: "How It Works", icon: LifeBuoy, perm: "dashboard:read", group: "Help", hint: "Sources, pages and FAQs" },
  { href: "/metrics", label: "What the Metrics Mean", icon: BookOpen, perm: "dashboard:read", group: "Help", hint: "Plain-language definitions" },
];

/** The one item that matches the current page: the longest href that is the path or a parent of it, so /clients/compare is not also "Clients". */
export function activeHref(path: string): string | null {
  const hits = NAV.filter((n) => path === n.href || path.startsWith(n.href + "/"));
  return hits.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

