import type { ClientPeriodRow, ClientSummary } from "@/server/data/ports";
import { aggregate, lowActivity, type RiskLevel } from "@/server/metrics/calculations";
import { periodKey, type Period } from "@/server/metrics/period";
import { buildPortfolio, DECLINE_THRESHOLD, type ClientRowView } from "./portfolio";
import { daysUntil } from "./attention";

/** How a CSM is identified: by email, or by name when only a name is on record. Matches the grouping on the Portfolio page. */
export const csmKey = (c: ClientSummary) => c.csmEmail || c.csmName;

/** The book that belongs to a signed-in person, matched on the CSM email in the Salesforce file. Null when they are nobody's CSM. */
export function csmKeyForEmail(email: string, clients: ClientSummary[]): string | null {
  const e = email.trim().toLowerCase();
  const hit = clients.find((c) => c.csmEmail && c.csmEmail.toLowerCase() === e);
  return hit ? csmKey(hit) : null;
}

/** Where someone lands after signing in: their own accounts if they are a CSM, otherwise the portfolio. */
export const homePathFor = (email: string, clients: ClientSummary[]) => (csmKeyForEmail(email, clients) ? "/csm" : "/portfolio");

/** What the notes and tasks tables say about one account. */
export interface AccountSignal { openTasks: number; overdueTasks: number; nextDue: string | null; lastNoteAt: string | null }
export const NO_SIGNAL: AccountSignal = { openTasks: 0, overdueTasks: 0, nextDue: null, lastNoteAt: null };

export interface AccountCard {
  clientId: string;
  name: string;
  risk: RiskLevel;
  health: number | null;
  healthDeltaPts: number | null;
  participation: number | null;
  participationDeltaPts: number | null;
  declining: boolean;
  knowledge: number | null;
  users: number | null;
  /** Participation by quarter, oldest first, up to eight quarters ending at the chosen period. */
  spark: (number | null)[];
  renewalDate: string | null;
  renewalDays: number | null;
  openTasks: number;
  overdueTasks: number;
  nextTaskDue: string | null;
  daysSinceNote: number | null;
  noData: boolean;
  /** Active users are so few against registered that the source should be checked before acting. */
  dataCheck: boolean;
}

const rank = (c: AccountCard) => (c.noData ? 4 : c.risk === "critical" ? 0 : c.risk === "at_risk" ? 1 : c.declining ? 2 : 3);

export function daysSince(iso: string | null, today: string): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(iso)) / 86_400_000));
}

const endQuarter = (p: Period) => (p.quarter ? periodKey(p) : `${p.year}-Q4`);

/** One card per account, most urgent first: Critical, At Risk, losing participation, then the rest by health; accounts without data last. */
export function buildAccountCards(clients: ClientSummary[], rows: ClientPeriodRow[], period: Period, signals: ReadonlyMap<string, AccountSignal>, today: string, inProgress = false): AccountCard[] {
  const view = buildPortfolio(clients, rows, { client: null, industry: null, period, inProgress });
  const end = endQuarter(period);
  const sparkFor = (id: string) =>
    rows.filter((r) => r.clientId === id && r.period <= end).sort((a, b) => a.period.localeCompare(b.period)).slice(-8).map((r) => aggregate([r], [r.period]).participationRate);

  const base = (c: ClientSummary) => {
    const s = signals.get(c.id) ?? NO_SIGNAL;
    const renewalDate = c.commercial?.renewalDate ?? null;
    const days = renewalDate ? daysUntil(renewalDate, today) : null;
    return {
      clientId: c.id, name: c.name, renewalDate, renewalDays: days != null && days >= 0 ? days : null,
      openTasks: s.openTasks, overdueTasks: s.overdueTasks, nextTaskDue: s.nextDue, daysSinceNote: daysSince(s.lastNoteAt, today), spark: sparkFor(c.id),
    };
  };
  const withData: AccountCard[] = view.clients.map((v: ClientRowView) => ({
    ...base(v.client), risk: v.risk, health: v.current.healthScore, healthDeltaPts: v.healthDelta.abs,
    participation: v.current.participationRate, participationDeltaPts: v.participationDelta.abs == null ? null : v.participationDelta.abs * 100,
    declining: v.declining, knowledge: v.current.avgKnowledge, users: v.current.registeredUsers, noData: false, dataCheck: lowActivity(v.current),
  }));
  const without: AccountCard[] = view.noDataClients.map((c) => ({
    ...base(c), risk: "unknown", health: null, healthDeltaPts: null, participation: null, participationDeltaPts: null, declining: false, knowledge: null, users: null, noData: true, dataCheck: false,
  }));
  return [...withData, ...without].sort((a, b) => rank(a) - rank(b) || (a.health ?? Infinity) - (b.health ?? Infinity) || a.name.localeCompare(b.name));
}

export interface BookSummary { accounts: number; needAttention: number; renewing90: number; openTasks: number; overdueTasks: number }

export function bookSummary(cards: AccountCard[]): BookSummary {
  return {
    accounts: cards.length,
    needAttention: cards.filter((c) => c.risk === "critical" || c.risk === "at_risk").length,
    renewing90: cards.filter((c) => c.renewalDays != null && c.renewalDays <= 90).length,
    openTasks: cards.reduce((n, c) => n + c.openTasks, 0),
    overdueTasks: cards.reduce((n, c) => n + c.overdueTasks, 0),
  };
}

export interface AgendaItem { key: string; clientId: string; name: string; text: string; urgent: boolean; order: number }

export const NOTE_STALE_DAYS = 30;

/** A short list of what to do this week: overdue and due tasks, renewals within 30 days, accounts that have gone quiet. Urgent items first. */
export function weekAgenda(cards: AccountCard[], today: string): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const c of cards) {
    const struggling = c.risk === "critical" || c.risk === "at_risk";
    if (c.overdueTasks > 0) out.push({ key: `${c.clientId}:overdue`, clientId: c.clientId, name: c.name, text: `${c.overdueTasks} overdue task${c.overdueTasks === 1 ? "" : "s"}`, urgent: true, order: 0 });
    if (c.nextTaskDue && c.overdueTasks === 0) {
      const d = daysUntil(c.nextTaskDue, today);
      if (d >= 0 && d <= 7) out.push({ key: `${c.clientId}:due`, clientId: c.clientId, name: c.name, text: d === 0 ? "A task is due today" : `A task is due in ${d} day${d === 1 ? "" : "s"}`, urgent: false, order: 2 + d / 100 });
    }
    if (c.renewalDays != null && c.renewalDays <= 30) out.push({ key: `${c.clientId}:renewal`, clientId: c.clientId, name: c.name, text: `Renews in ${c.renewalDays} day${c.renewalDays === 1 ? "" : "s"}`, urgent: struggling, order: struggling ? 1 : 3 });
    // An account nobody has ever written a note about is only worth a line when it is struggling; the card already carries a "No notes yet" tag.
    if (!c.noData && ((c.daysSinceNote != null && c.daysSinceNote >= NOTE_STALE_DAYS) || (c.daysSinceNote == null && struggling))) {
      out.push({ key: `${c.clientId}:note`, clientId: c.clientId, name: c.name, text: c.daysSinceNote == null ? "No note recorded yet" : `No note for ${c.daysSinceNote} days`, urgent: false, order: struggling ? 2.5 : 4 });
    }
  }
  return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** How many quarters in a row, ending at the chosen one, participation has fallen against the quarter before. */
export function declineStreak(clientRows: ClientPeriodRow[], period: Period): number {
  const end = endQuarter(period);
  const series = clientRows.filter((r) => r.period <= end).sort((a, b) => a.period.localeCompare(b.period)).map((r) => aggregate([r], [r.period]).participationRate);
  let streak = 0;
  for (let i = series.length - 1; i > 0; i--) {
    const now = series[i], before = series[i - 1];
    if (now == null || before == null || now >= before) break;
    streak++;
  }
  return streak;
}

export type WatchAction = "Escalate" | "Review" | "Monitor";

/** The suggested next step for an account on the watchlist. */
export function watchAction(risk: RiskLevel, streak: number): WatchAction {
  return risk === "critical" ? "Escalate" : risk === "at_risk" || streak >= 2 ? "Review" : "Monitor";
}

export interface WatchRow { clientId: string; name: string; csm: string; participation: number | null; changePts: number | null; knowledge: number | null; streak: number; risk: RiskLevel; action: WatchAction }

/** Accounts whose participation fell by the decline threshold or more, worst first. */
export function buildWatchlist(views: ClientRowView[], rows: ClientPeriodRow[], period: Period, inProgress = false): WatchRow[] {
  if (inProgress) return [];
  return views
    .filter((v) => v.participationDelta.abs != null && v.participationDelta.abs <= DECLINE_THRESHOLD)
    .map((v) => {
      const streak = declineStreak(rows.filter((r) => r.clientId === v.client.id), period);
      return {
        clientId: v.client.id, name: v.client.name, csm: v.client.csmName || "Unassigned", participation: v.current.participationRate,
        changePts: (v.participationDelta.abs ?? 0) * 100, knowledge: v.current.avgKnowledge, streak, risk: v.risk, action: watchAction(v.risk, streak),
      };
    })
    .sort((a, b) => (a.changePts ?? 0) - (b.changePts ?? 0));
}

export interface RenewalRow { clientId: string; name: string; csm: string; date: string; days: number; value: number | null; currency: string; licenses: number | null; risk: RiskLevel; health: number | null }

/** Renewals from today on, soonest first, optionally only those within `windowDays`. */
export function buildRenewals(clients: ClientSummary[], views: ClientRowView[], today: string, windowDays: number | null): RenewalRow[] {
  const byId = new Map(views.map((v) => [v.client.id, v]));
  return clients
    .filter((c) => c.commercial?.renewalDate)
    .map((c) => {
      const date = c.commercial!.renewalDate!;
      const v = byId.get(c.id);
      return {
        clientId: c.id, name: c.name, csm: c.csmName || "Unassigned", date, days: daysUntil(date, today), value: c.commercial!.licenseValue, currency: c.commercial!.currency,
        licenses: c.commercial!.licenses, risk: (v?.risk ?? "unknown") as RiskLevel, health: v?.current.healthScore ?? null,
      };
    })
    .filter((r) => r.days >= 0 && (windowDays == null || r.days <= windowDays))
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
}

/** Total renewing value, kept separate per currency because the Salesforce file can hold more than one. */
export function renewalValueByCurrency(rows: RenewalRow[]): { currency: string; total: number }[] {
  const t = new Map<string, number>();
  for (const r of rows) if (r.value != null) t.set(r.currency, (t.get(r.currency) ?? 0) + r.value);
  return [...t.entries()].map(([currency, total]) => ({ currency, total })).sort((a, b) => a.currency.localeCompare(b.currency));
}
