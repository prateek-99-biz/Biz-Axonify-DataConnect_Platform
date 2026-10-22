import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/server/auth";
import { can, ROLE_LABEL, type Permission } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { loadContext } from "@/server/services/context";
import { buildPortfolio, deriveAlerts } from "@/server/services/portfolio";
import { Sidebar } from "@/components/shell/sidebar";
import { Breadcrumbs, GlobalSearch, NotificationCentre, ProfileMenu, type NotificationItem } from "@/components/shell/topbar";
import { FilterBar } from "@/components/filters/filter-bar";
import { Badge } from "@/components/ui/primitives";
import { RefreshButton } from "@/components/shell/refresh-button";

const ALL_PERMS: Permission[] = ["portfolio:read", "clients:read", "reliability:read", "settings:manage", "clients:notes:write", "sync:run"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const user = session.user;
  const allowed = ALL_PERMS.filter((p) => can(user.role, p));

  const loaded = await loadContext({});
  let notifications: NotificationItem[] = [];
  if (loaded.ok) {
    const { ctx } = loaded;
    const view = buildPortfolio(ctx.clients, ctx.rows, { ...ctx.filters, client: null, industry: null });
    const acked = new Set((await db.alertAck.findMany({ where: { userId: user.id }, select: { alertKey: true } })).map((a) => a.alertKey));
    notifications = deriveAlerts(view, ctx.filters.period).filter((a) => !acked.has(a.key));
  }

  async function doSignOut() {
    "use server";
    await signOut();
    redirect("/signin");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={<aside className="hidden w-60 bg-navy md:block" />}>
        <Sidebar allowed={allowed} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <div className="hidden min-w-0 flex-1 md:block"><Breadcrumbs /></div>
          <GlobalSearch />
          {loaded.ok && loaded.ctx.source === "mock" && (
            <Badge tone="warn" className="shrink-0" title="All figures are synthetic development data">MOCK DATA</Badge>
          )}
          {can(user.role, "sync:run") && <RefreshButton asOf={loaded.ok ? loaded.ctx.asOf : null} />}
          <NotificationCentre items={notifications} canAck />
          <ProfileMenu name={user.name ?? user.email} email={user.email} role={ROLE_LABEL[user.role]} signOutAction={doSignOut} />
        </header>
        {loaded.ok && (
          <Suspense fallback={<div className="h-12 border-b border-line bg-white" />}>
            <FilterBar
              options={{
                clients: loaded.ctx.clients.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
                industries: [...new Set(loaded.ctx.clients.map((c) => c.industry))].sort(),
                years: [...new Set(loaded.ctx.availablePeriods.map((p) => Number(p.slice(0, 4))))].sort(),
                current: {
                  client: loaded.ctx.filters.client, industry: loaded.ctx.filters.industry,
                  year: loaded.ctx.filters.period.year, quarter: loaded.ctx.filters.period.quarter,
                },
              }}
            />
          </Suspense>
        )}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
