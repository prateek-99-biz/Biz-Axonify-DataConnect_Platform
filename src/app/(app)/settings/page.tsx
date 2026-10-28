import { revalidatePath } from "next/cache";
import { requirePagePermission, requirePermission } from "@/server/auth/guard";
import { parseRole, ROLE_LABEL } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { supabaseConfigured } from "@/lib/supabase/server";
import { Badge, Button, Card, CardHeader, Select } from "@/components/ui/primitives";

export default async function SettingsPage() {
  const me = await requirePagePermission("settings:manage");
  const users = await db.appUser.findMany({ orderBy: { email: "asc" } });
  const clientOptions = await db.clientMapping.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } });
  const env = getEnv();

  async function setRole(form: FormData) {
    "use server";
    const actor = await requirePermission("settings:manage");
    const id = String(form.get("id"));
    const role = parseRole(form.get("role"));
    const active = form.get("active") === "on";
    const clientId = role === "CLIENT" ? String(form.get("clientId") ?? "") || null : null;
    if (!role) return;
    // A client user without a client would see nothing, so require the link.
    if (role === "CLIENT" && !clientId) return;
    // Prevent an admin from locking themselves out.
    if (id === actor.id && (role !== "ADMIN" || !active)) return;
    await db.appUser.update({ where: { id }, data: { role, active, clientId } });
    revalidatePath("/settings");
  }

  const status = [
    { name: "Data adapter", value: env.DATA_ADAPTER === "mock" ? "Mock (development only)" : "Synced summaries (Postgres)", ok: env.DATA_ADAPTER !== "mock" },
    { name: "Supabase Auth", value: supabaseConfigured() ? "Configured" : "Not configured", ok: supabaseConfigured() },
    { name: "BigQuery project", value: process.env.BQ_PROJECT_ID || "Not configured", ok: !!process.env.BQ_PROJECT_ID },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Card>
        <CardHeader title="Configuration status" subtitle="Status only; secrets are never shown or sent to the browser" />
        <ul className="divide-y divide-line text-sm">
          {status.map((i) => <li key={i.name} className="flex items-center justify-between px-4 py-2"><span>{i.name}</span><span className="flex items-center gap-2 text-slate-600">{i.value}<Badge tone={i.ok ? "good" : "warn"}>{i.ok ? "ok" : "attention"}</Badge></span></li>)}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Users and roles" subtitle="Create or remove login accounts in the Supabase dashboard (Authentication → Users). People appear here after their first sign-in." />
        <ul className="divide-y divide-line text-sm">
          {users.length === 0 && <li className="p-4 text-xs text-slate-500">No users have signed in yet.</li>}
          {users.map((u) => (
            <li key={u.id}>
              <form action={setRole} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <input type="hidden" name="id" value={u.id} />
                <span className="min-w-0 flex-1 truncate">{u.name ?? u.email}<span className="ml-2 text-xs text-slate-500">{u.email}{u.id === me.id ? " (you)" : ""}</span></span>
                <Select name="role" defaultValue={u.role} aria-label={`Role for ${u.email}`}>{(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
                <Select name="clientId" defaultValue={u.clientId ?? ""} aria-label={`Client for ${u.email} (Client role only)`} className="max-w-[12rem]">
                  <option value="">No client</option>
                  {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                </Select>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={u.active} /> Active</label>
                <Button size="sm">Save</Button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
