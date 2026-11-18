import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { auth, signOut } from "@/server/auth";
import { can, ROLE_LABEL } from "@/server/auth/rbac";
import { ackedAlertKeys } from "@/server/services/alert-acks";
import { loadContext } from "@/server/services/context";
import { buildPortfolio, deriveAlerts } from "@/server/services/portfolio";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Breadcrumbs, GlobalSearch, NotificationCentre, ProfileMenu, type NotificationItem } from "@/components/shell/topbar";
import { FilterBar } from "@/components/filters/filter-bar";
import { Badge } from "@/components/ui/primitives";
import { RefreshButton } from "@/components/shell/refresh-button";
import { StaleDataBanner } from "@/components/shell/stale-banner";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SHELL_PERMISSIONS } from "@/components/shell/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const user = session.user;
  if (user.role === "CLIENT") redirect("/qbr");
  const allowed = SHELL_PERMISSIONS.filter((p) => can(user.role, p));

  // Independent queries: start both so the layout waits for one round trip, not two.
  const [loaded, ackRows] = await Promise.all([
    loadContext({}),
    ackedAlertKeys(user.id),
  ]);
  let notifications: NotificationItem[] = [];
  if (loaded.ok) {
    const { ctx } = loaded;
    const view = buildPortfolio(ctx.clients, ctx.rows, { ...ctx.filters, client: null, industry: null });
    const acked = new Set(ackRows);
    notifications = deriveAlerts(view, ctx.filters.period).filter((a) => !acked.has(a.key));
  }

  async function doSignOut() {
    "use server";
    await signOut();
    redirect("/signin");
  }

  return (
    // From md up the frame fills the screen and only the page body scrolls. On a phone that left a third of the screen
    // to the header, menu and filters, so there the whole page scrolls and only the slim header stays in view.
    // Past 1920 pixels the frame stops growing and sits in the middle, so rows and cards do not stretch across an
    // ultrawide screen with their labels and numbers far apart.
    <div className="mx-auto flex min-h-screen w-full max-w-[1920px] gap-3 p-3 md:h-screen md:overflow-hidden">
      <Suspense fallback={<aside className="glass-nav hidden w-64 md:block" />}>
        <Sidebar allowed={allowed} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="glass relative z-20 flex h-14 shrink-0 items-center gap-2 px-3 max-md:sticky max-md:top-3 sm:gap-3 sm:px-4">
          {/* The breadcrumb shows from xl up: between 1024 and 1280 pixels there is no room for it beside the search,
              so the slot stays empty and only keeps the buttons at the right-hand end. */}
          <div className="hidden min-w-0 flex-1 overflow-hidden whitespace-nowrap lg:block"><div className="hidden xl:block"><Breadcrumbs /></div></div>
          <GlobalSearch />
          {loaded.ok && loaded.ctx.source === "mock" && (
            <Badge tone="warn" className="shrink-0" title="All figures are synthetic development data">MOCK DATA</Badge>
          )}
          {can(user.role, "sync:run") && <RefreshButton asOf={loaded.ok ? loaded.ctx.asOf : null} />}
          <Link href="/how-it-works" title="How this dashboard works" className="hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-line transition-colors hover:bg-brand/15 sm:flex">
            <LifeBuoy className="h-4 w-4" aria-hidden /><span className="hidden lg:inline">Help</span><span className="sr-only lg:hidden">Help</span>
          </Link>
          <ThemeToggle />
          <NotificationCentre items={notifications} canAck />
          <ProfileMenu name={user.name ?? user.email} email={user.email} role={ROLE_LABEL[user.role]} signOutAction={doSignOut} />
        </header>
        <Suspense fallback={null}>
          <MobileNav allowed={allowed} />
        </Suspense>
        {loaded.ok && (
          <Suspense fallback={<div className="glass h-[52px] shrink-0" />}>
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
        {loaded.ok && <StaleDataBanner asOf={loaded.ctx.asOf} isAdmin={can(user.role, "sync:run")} />}
        <main className="-mx-1 flex-1 px-1 pb-6 md:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
