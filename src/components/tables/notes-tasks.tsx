"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Input, Select } from "@/components/ui/primitives";
import { humanize } from "@/lib/labels";

export interface TaskView { id: string; title: string; detail: string | null; priority: string; status: string; dueDate: string | null; owner: string | null }
export interface NoteView { id: string; body: string; author: string; createdAt: string }

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
}

export function NotesTasks({ clientId, notes, tasks, canWrite }: { clientId: string; notes: NoteView[]; tasks: TaskView[]; canWrite: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); router.refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-label="Follow-Up Tasks">
        <h3 className="mb-2 text-sm font-semibold">Follow-Up Tasks</h3>
        {canWrite && (
          <form className="glass mb-3 grid grid-cols-2 gap-2 !rounded-xl p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const form = e.currentTarget;
              run(async () => {
                await send(`/api/clients/${clientId}/tasks`, "POST", {
                  title: f.get("title"), priority: f.get("priority"), dueDate: f.get("dueDate") || undefined, detail: f.get("detail") || undefined,
                });
                form.reset();
              });
            }}>
            <Input name="title" placeholder="Task title" aria-label="Task Title" required maxLength={200} className="col-span-2" />
            <Input name="detail" placeholder="Details (optional)" aria-label="Details" className="col-span-2" />
            <Select name="priority" aria-label="Priority" defaultValue="MEDIUM"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></Select>
            <Input name="dueDate" type="date" aria-label="Due Date" />
            <Button variant="primary" className="col-span-2" disabled={busy}>Add Task</Button>
          </form>
        )}
        {err && <p role="alert" className="mb-2 text-xs font-medium text-critical">{err}</p>}
        <ul className="space-y-2">
          {tasks.length === 0 && <li className="text-xs text-slate-500">No tasks yet for this client.</li>}
          {tasks.map((t) => (
            <li key={t.id} className="glass !rounded-xl p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className={t.status === "DONE" || t.status === "CANCELLED" ? "text-slate-400 line-through" : "font-medium"}>{t.title}</p>
                <Badge tone={t.priority === "URGENT" ? "critical" : t.priority === "HIGH" ? "warn" : "neutral"}>{t.priority.toLowerCase()}</Badge>
              </div>
              {t.detail && <p className="mt-1 text-xs text-slate-500">{t.detail}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>Owner: {t.owner ?? "—"}</span>
                <span>Due: {t.dueDate ? t.dueDate.slice(0, 10) : "—"}</span>
                {canWrite ? (
                  <Select aria-label="Status" value={t.status} disabled={busy} className="h-7 text-xs" onChange={(e) => run(() => send(`/api/tasks/${t.id}`, "PATCH", { status: e.target.value }))}>
                    <option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option><option value="DONE">Done</option><option value="CANCELLED">Cancelled</option>
                  </Select>
                ) : <Badge>{humanize(t.status.toLowerCase())}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Account Notes">
        <h3 className="mb-2 text-sm font-semibold">Account Notes</h3>
        {canWrite && (
          <form className="mb-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const body = String(new FormData(form).get("body") ?? "");
              run(async () => { await send(`/api/clients/${clientId}/notes`, "POST", { body }); form.reset(); });
            }}>
            <textarea name="body" required maxLength={4000} rows={3} aria-label="Note" placeholder="Add a note about this account…" className="field w-full p-2.5 text-sm" />
            <Button variant="primary" disabled={busy}>Add Note</Button>
          </form>
        )}
        <ul className="space-y-2">
          {notes.length === 0 && <li className="text-xs text-slate-500">No notes yet for this client.</li>}
          {notes.map((n) => (
            <li key={n.id} className="glass !rounded-xl p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-slate-500">{n.author} · {n.createdAt.slice(0, 16).replace("T", " ")} UTC</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
