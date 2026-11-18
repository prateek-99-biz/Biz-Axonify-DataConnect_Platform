import { Bot, Coins, HeartPulse, Medal, Trophy, Contact, BookOpen, Building2, GitCompareArrows, LayoutDashboard, LifeBuoy, Presentation, Settings, ShieldCheck, UsersRound, Compass, BellRing, CalendarClock, type LucideIcon } from "lucide-react";
import type { Permission } from "@/server/auth/rbac";

export type NavGroup = "Analyse" | "Insights" | "Internal" | "Admin" | "Help";

export interface NavItem { href: string; label: string; icon: LucideIcon; perm: Permission; group: NavGroup; hint: string }

/** Headings in the order they appear. Only routes that exist and work are listed; unbuilt phases are in docs/ROADMAP.md. */
export const NAV_GROUPS: NavGroup[] = ["Analyse", "Insights", "Internal", "Admin", "Help"];

export const NAV: NavItem[] = [
  { href: "/portfolio", label: "Portfolio", icon: LayoutDashboard, perm: "portfolio:read", group: "Analyse", hint: "All clients at a glance" },
  { href: "/clients", label: "Clients", icon: Building2, perm: "clients:read", group: "Analyse", hint: "Directory and client profiles" },
  { href: "/clients/compare", label: "Compare Clients", icon: GitCompareArrows, perm: "clients:read", group: "Analyse", hint: "Side by side, by quarter" },
  { href: "/qbr", label: "Client Dashboards", icon: Presentation, perm: "dashboard:read", group: "Analyse", hint: "Quarterly review pages" },
  { href: "/insights/leaderboard", label: "Client Leaderboard", icon: Medal, perm: "dashboard:internal", group: "Insights", hint: "Who leads on AI, engagement and growth" },
  { href: "/insights/health", label: "Account Health", icon: HeartPulse, perm: "dashboard:internal", group: "Insights", hint: "Every account's health and what drives it" },
  { href: "/insights/benchmarks", label: "Benchmarks and Features", icon: Trophy, perm: "dashboard:internal", group: "Insights", hint: "A client against its peers, feature by feature" },
  { href: "/insights/ai", label: "Max AI Usage", icon: Bot, perm: "dashboard:internal", group: "Insights", hint: "Who asks Max, how often, and how it answers" },
  { href: "/insights/csm", label: "CSM Portfolio", icon: Contact, perm: "dashboard:internal", group: "Insights", hint: "Every CSM's book side by side" },
  { href: "/insights/cost", label: "Cost to Serve", icon: Coins, perm: "commercial:read", group: "Insights", hint: "Contract value against usage and effort" },
  { href: "/internal", label: "Internal Home", icon: Compass, perm: "dashboard:internal", group: "Internal", hint: "Every internal page at a glance" },
  { href: "/csm", label: "My Accounts", icon: UsersRound, perm: "dashboard:internal", group: "Internal", hint: "A CSM's accounts and week" },
  { href: "/alerts", label: "Alerts and Watchlist", icon: BellRing, perm: "dashboard:internal", group: "Internal", hint: "Who needs a conversation" },
  { href: "/renewals", label: "Renewals", icon: CalendarClock, perm: "dashboard:internal", group: "Internal", hint: "Upcoming contracts and value" },
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


/**
 * Permissions the app shell checks to decide what the menu shows. Every menu item's permission is included, so a new page
 * (Cost to Serve needs commercial:read) can never be left out of the menu by a list nobody updated.
 */
export const SHELL_PERMISSIONS: Permission[] = [...new Set<Permission>([
  "dashboard:read", "dashboard:internal", "portfolio:read", "clients:read", "reliability:read", "settings:manage", "clients:notes:write", "sync:run",
  ...NAV.map((n) => n.perm),
])];

const CRUMB_LABELS: Record<string, string> = {
  portfolio: "Portfolio", clients: "Clients", csm: "My Accounts", internal: "Internal Home", alerts: "Alerts and Watchlist", renewals: "Renewals",
  metrics: "What the Metrics Mean", "how-it-works": "How It Works", "data-reliability": "Data Reliability", settings: "Settings", compare: "Compare Clients", insights: "Insights",
};

/** Breadcrumb trail for a path. The menu label for the full path wins, so /insights/csm reads "CSM Portfolio", not the label for /csm. */
export function breadcrumbs(path: string): { href: string; label: string }[] {
  const parts = path.split("/").filter(Boolean);
  return parts.map((p, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    const label = NAV.find((n) => n.href === href)?.label ?? CRUMB_LABELS[p] ?? (i === 1 && parts[0] === "clients" ? "Client 360" : p);
    return { href, label };
  });
}
