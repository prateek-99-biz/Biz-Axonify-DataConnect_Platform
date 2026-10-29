import { Building2, Gauge, LayoutDashboard, Presentation, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Permission } from "@/server/auth/rbac";

export interface NavItem { href: string; label: string; icon: LucideIcon; perm: Permission }

/** Only routes that exist and work. Unbuilt phases are listed in docs/ROADMAP.md, not in the nav. */
export const NAV: NavItem[] = [
  { href: "/portfolio", label: "Portfolio", icon: LayoutDashboard, perm: "portfolio:read" },
  { href: "/clients", label: "Clients", icon: Building2, perm: "clients:read" },
  { href: "/qbr", label: "Client Dashboards", icon: Presentation, perm: "dashboard:read" },
  { href: "/data-reliability", label: "Data Reliability", icon: ShieldCheck, perm: "reliability:read" },
  { href: "/settings", label: "Settings", icon: Settings, perm: "settings:manage" },
];

export const BRAND_ICON = Gauge;
