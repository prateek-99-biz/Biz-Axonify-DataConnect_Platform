import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, type SessionUser } from "@/server/auth";
import { can } from "@/server/auth/rbac";
import { getAdapters } from "@/server/data";
import type { SourceKind } from "@/server/data/ports";
import { getEnv } from "@/server/env";
import { db } from "@/server/db";
import { cached, SNAPSHOT_TTL_MS } from "@/server/cache";
import type { SearchParams } from "@/server/services/context";
import { resolveRange, type Range } from "./calc";
import { mockDashboard } from "./mock";
import type { DashboardData } from "./types";
import { joinDashboard, SECTION_NAMES, type DashboardCore, type Section } from "./sections";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Query string that carries the shared client and date-range choice across dashboard links. */
export function carryQuery(sp: SearchParams) {
  const q = new URLSearchParams();
  for (const k of ["client", "from", "to"]) { const v = one(sp[k]); if (v) q.set(k, v); }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** The layout and the page each resolve the same session, client list and snapshot in one request; do each once. */
const getSession = cache(() => auth());
const getClients = cache(() => getAdapters().analytics.listClients());
const getCore = cache((clientId: string) => cached(`snap:core:${clientId}`, SNAPSHOT_TTL_MS, () => db.syncDashboard.findUnique({ where: { clientId } })));
const getParts = cache(async (clientId: string, sections: string) => {
  const wanted = sections ? sections.split(",") : [];
  // One cache entry per section, so a page that needs topics does not wait on, or evict, the team rows.
  const rows = await Promise.all(wanted.map((section) => cached(`snap:part:${clientId}:${section}`, SNAPSHOT_TTL_MS, () => db.syncDashboardPart.findUnique({ where: { clientId_section: { clientId, section } } }))));
  return Object.fromEntries(rows.flatMap((r) => (r ? [[r.section, r.payload as Record<string, unknown>]] : []))) as Partial<Record<Section, Record<string, unknown>>>;
});

/** The layout and the page both resolve the dashboard in one request; build it once. */
const buildMock = cache((id: string, name: string) => mockDashboard(id, name));

export interface QbrContext {
  user: SessionUser;
  /** Internal staff see granular extras; external client users never do. */
  internal: boolean;
  canExport: boolean;
  clients: { id: string; name: string }[];
  data: DashboardData;
  range: Range;
  months: string[];
  source: SourceKind;
}

export type QbrResult = { ok: true; ctx: QbrContext } | { ok: false; reason: string; user: SessionUser };

/**
 * Resolves who is looking at which client's dashboard. A CLIENT user is pinned to their own client on the
 * server regardless of URL params; staff may switch clients. Pass the large sections a page shows; the rest come back empty.
 */
export async function loadQbr(sp: SearchParams, sections: readonly Section[] = []): Promise<QbrResult> {
  // Each lookup is a database round trip, so start both before waiting on either.
  const [session, list] = await Promise.all([getSession(), getClients()]);
  if (!session?.user) redirect("/signin");
  const user = session.user;
  if (!can(user.role, "dashboard:read")) redirect("/forbidden");

  const internal = can(user.role, "dashboard:internal");
  if (list.status !== "ok") return { ok: false, reason: list.reason, user };

  let clients = list.data.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
  if (user.role === "CLIENT") {
    clients = clients.filter((c) => c.id === user.clientId);
    if (clients.length === 0) return { ok: false, reason: "Your account is not linked to a client yet. Please contact your Biz Group account manager.", user };
  }
  if (clients.length === 0) return { ok: false, reason: "No clients are available yet.", user };

  const requested = one(sp.client);
  const client = user.role === "CLIENT" ? clients[0] : clients.find((c) => c.id === requested) ?? clients[0];

  if (getEnv().DATA_ADAPTER !== "mock") {
    const wanted = SECTION_NAMES.filter((s) => sections.includes(s));
    const [snap, parts] = await Promise.all([getCore(client.id), getParts(client.id, wanted.join(","))]);
    if (!snap) return { ok: false, reason: "No dashboard data has been synced for this client yet. An admin can press “Refresh data” once BigQuery is connected.", user };
    const data = { ...joinDashboard(snap.payload as unknown as DashboardCore, parts, wanted), asOf: snap.syncedAt.toISOString() };
    const months = data.months.map((m) => m.month);
    const range = resolveRange(months, one(sp.from), one(sp.to));
    return { ok: true, ctx: { user, internal, canExport: can(user.role, "export:csv"), clients, data, range, months, source: "synced" } };
  }
  const data = buildMock(client.id, client.name);
  const months = data.months.map((m) => m.month);
  const range = resolveRange(months, one(sp.from), one(sp.to));

  return { ok: true, ctx: { user, internal, canExport: can(user.role, "export:csv"), clients, data, range, months, source: "mock" } };
}
