import "server-only";
import { db } from "@/server/db";
import type { AccountSignal } from "./accounts";

/**
 * Notes and tasks written in this platform for each account since a date: the effort signal that needs nobody to log
 * hours. Meetings and emails would need the live Salesforce connection.
 */
export async function touchpoints(clientIds: string[], sinceIso: string): Promise<Map<string, { notes: number; tasks: number }>> {
  const out = new Map<string, { notes: number; tasks: number }>();
  if (clientIds.length === 0) return out;
  const since = new Date(sinceIso);
  const [notes, tasks] = await Promise.all([
    db.note.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds }, createdAt: { gte: since } }, _count: { _all: true } }),
    db.task.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds }, createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  for (const n of notes) out.set(n.clientId, { notes: n._count._all, tasks: 0 });
  for (const t of tasks) out.set(t.clientId, { notes: out.get(t.clientId)?.notes ?? 0, tasks: t._count._all });
  return out;
}

/** Open tasks (and how many are overdue) and the date of the latest note, for each of the given accounts. */
export async function accountSignals(clientIds: string[], today: string): Promise<Map<string, AccountSignal>> {
  const out = new Map<string, AccountSignal>();
  if (clientIds.length === 0) return out;
  const [tasks, notes] = await Promise.all([
    db.task.findMany({ where: { clientId: { in: clientIds }, status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { clientId: true, dueDate: true } }),
    db.note.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds } }, _max: { createdAt: true } }),
  ]);
  const get = (id: string): AccountSignal => out.get(id) ?? { openTasks: 0, overdueTasks: 0, nextDue: null, lastNoteAt: null };
  for (const t of tasks) {
    const s = get(t.clientId);
    s.openTasks++;
    const due = t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null;
    if (due && due < today) s.overdueTasks++;
    else if (due && (!s.nextDue || due < s.nextDue)) s.nextDue = due;
    out.set(t.clientId, s);
  }
  for (const n of notes) {
    const s = get(n.clientId);
    s.lastNoteAt = n._max.createdAt ? n._max.createdAt.toISOString() : null;
    out.set(n.clientId, s);
  }
  return out;
}
