import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePagePermission, requirePermission } from "@/server/auth/guard";
import { parseRole, ROLE_LABEL, STAFF_DOMAIN } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { clearCache } from "@/server/cache";
import { getEnv } from "@/server/env";
import { siteUrl } from "@/server/site-url";
import { supabaseConfigured } from "@/lib/supabase/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase/admin";
import { emailProblem, normalizeEmail } from "@/lib/account-input";
import { Badge, Button, CALLOUT_CRITICAL, Card, CardHeader, Input, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const MESSAGES: Record<string, string> = {
  email: "Enter a valid email address.",
  role: "Choose a role.",
  client: "Choose the client this person belongs to.",
  staff: `Admin and Member accounts need a ${STAFF_DOMAIN} email address.`,
  exists: "Someone with that email already has an account. Change their role in the list below.",
  config: "Sending invitations needs SUPABASE_SERVICE_ROLE_KEY on the server. Add it to the environment and restart.",
  failed: "The invitation could not be sent. Try again in a minute, or check the Supabase email settings.",
  unknown: "That user could not be found.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ invited?: string; resent?: string; error?: string }> }) {
  const me = await requirePagePermission("settings:manage");
  const raw = await searchParams;
  // Only an email address may be echoed back from the address bar, so a crafted link cannot put its own words on the page.
  const sp = { ...raw, invited: raw.invited && !emailProblem(raw.invited) ? raw.invited : undefined, resent: raw.resent && !emailProblem(raw.resent) ? raw.resent : undefined };
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
    clearCache("user:");
    revalidatePath("/settings");
  }

  /** Creates the login in Supabase, which emails the person a link to choose their password, and stores the role chosen here. */
  async function addUser(form: FormData) {
    "use server";
    await requirePermission("settings:manage");
    const email = normalizeEmail(form.get("email"));
    const role = parseRole(form.get("role"));
    const clientId = String(form.get("clientId") ?? "") || null;
    const bad = emailProblem(email) ? "email" : !role ? "role" : role !== "CLIENT" && !email.endsWith(STAFF_DOMAIN) ? "staff" : role === "CLIENT" && !clientId ? "client" : null;
    if (bad || !role) redirect(`/settings?error=${bad}`);
    if (await db.appUser.findUnique({ where: { email } })) redirect("/settings?error=exists");
    if (!supabaseAdminConfigured()) redirect("/settings?error=config");

    const { data, error } = await supabaseAdmin().auth.admin.inviteUserByEmail(email, { redirectTo: `${await siteUrl()}/auth/confirm?next=/set-password` });
    if (error || !data.user) {
      // Already registered in Supabase (for example through the sign-up page) but with no profile yet: nothing to invite.
      redirect(`/settings?error=${error?.status === 422 ? "exists" : "failed"}`);
    }
    await db.appUser.create({ data: { id: data.user.id, email, role, clientId: role === "CLIENT" ? clientId : null, lastLogin: null } });
    clearCache("user:");
    revalidatePath("/settings");
    redirect(`/settings?invited=${encodeURIComponent(email)}`);
  }

  /** A fresh link for someone who has not signed in yet (the first one expired or went missing). */
  async function resend(form: FormData) {
    "use server";
    await requirePermission("settings:manage");
    const user = await db.appUser.findUnique({ where: { id: String(form.get("id")) } });
    if (!user || user.lastLogin) redirect("/settings?error=unknown");
    if (!supabaseAdminConfigured()) redirect("/settings?error=config");
    const { error } = await supabaseAdmin().auth.resetPasswordForEmail(user.email, { redirectTo: `${await siteUrl()}/auth/confirm?next=/set-password` });
    redirect(error ? "/settings?error=failed" : `/settings?resent=${encodeURIComponent(user.email)}`);
  }

  const status = [
    { name: "Data Adapter", value: env.DATA_ADAPTER === "mock" ? "Mock (development only)" : "Synced summaries (Postgres)", ok: env.DATA_ADAPTER !== "mock" },
    { name: "Supabase Auth", value: supabaseConfigured() ? "Configured" : "Not configured", ok: supabaseConfigured() },
    { name: "User Invitations", value: supabaseAdminConfigured() ? "Configured" : "Needs SUPABASE_SERVICE_ROLE_KEY", ok: supabaseAdminConfigured() },
    { name: "BigQuery Project", value: process.env.BQ_PROJECT_ID || "Not configured", ok: !!process.env.BQ_PROJECT_ID },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Card>
        <CardHeader title="Configuration Status" subtitle="Status only; secrets are never shown or sent to the browser" />
        <ul className="divide-y divide-line text-sm">
          {status.map((i) => <li key={i.name} className="flex items-center justify-between px-4 py-2"><span>{i.name}</span><span className="flex items-center gap-2 text-slate-600">{i.value}<Badge tone={i.ok ? "good" : "warn"}>{i.ok ? "OK" : "Needs Attention"}</Badge></span></li>)}
        </ul>
      </Card>
      <Card>
        <CardHeader title="User Management" subtitle="Add a person and they receive an email with a link to choose their password" />
        {sp.error && <p role="alert" className={cn("glass mx-4 mt-3 !rounded-xl px-3 py-2 text-xs", CALLOUT_CRITICAL)}>{MESSAGES[sp.error] ?? MESSAGES.failed}</p>}
        {sp.invited && <p role="status" className="glass mx-4 mt-3 !rounded-xl border-emerald-300/60 !bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-300/20 dark:!bg-emerald-400/10 dark:text-emerald-100">Invitation sent to {sp.invited}.</p>}
        {sp.resent && <p role="status" className="glass mx-4 mt-3 !rounded-xl border-emerald-300/60 !bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-300/20 dark:!bg-emerald-400/10 dark:text-emerald-100">A new link was sent to {sp.resent}.</p>}
        <form action={addUser} className="flex flex-wrap items-end gap-3 border-b hairline px-4 py-3">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-medium">Email
            <Input name="email" type="email" placeholder="name@company.com" autoComplete="off" required />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">Role
            <Select name="role" defaultValue="MEMBER">{(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">Client (Client role only)
            <Select name="clientId" defaultValue="" className="max-w-[12rem]">
              <option value="">No client</option>
              {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </Select>
          </label>
          <Button variant="primary">Add User</Button>
        </form>
        <ul className="divide-y divide-line text-sm">
          {users.length === 0 && <li className="p-4 text-xs text-slate-500">No users yet.</li>}
          {users.map((u) => (
            <li key={u.id}>
              <form action={setRole} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <input type="hidden" name="id" value={u.id} />
                <span className="min-w-0 flex-1 truncate">{u.name ?? u.email}<span className="ml-2 text-xs text-slate-500">{u.email}{u.id === me.id ? " (you)" : ""}</span>{!u.lastLogin && <Badge tone="warn" className="ml-2">Invited</Badge>}</span>
                <Select name="role" defaultValue={u.role} aria-label={`Role for ${u.email}`}>{(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
                <Select name="clientId" defaultValue={u.clientId ?? ""} aria-label={`Client for ${u.email} (Client role only)`} className="max-w-[12rem]">
                  <option value="">No client</option>
                  {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                </Select>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={u.active} /> Active</label>
                <Button size="sm">Save</Button>
                {!u.lastLogin && <Button size="sm" formAction={resend}>Resend Link</Button>}
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
