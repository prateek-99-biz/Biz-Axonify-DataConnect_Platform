import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { DEV_COOKIE } from "@/server/auth";
import { parseRole } from "@/server/auth/rbac";
import { devLoginEnabled } from "@/server/env";
import { Button, CALLOUT_CRITICAL, Card, Input, Select } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl?.startsWith("/") && !sp.callbackUrl.startsWith("//") ? sp.callbackUrl : "/portfolio";

  async function login(form: FormData) {
    "use server";
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!supabaseConfigured()) redirect("/signin?error=config");
    const sb = await supabaseServer();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) redirect("/signin?error=invalid");
    redirect(callbackUrl);
  }

  async function dev(form: FormData) {
    "use server";
    if (!devLoginEnabled()) return;
    const email = String(form.get("email") ?? "").toLowerCase();
    const role = parseRole(form.get("role"));
    const devClient = String(form.get("clientId") ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "");
    if (!email.endsWith("@bizgroup.ae") || !role) redirect("/signin?error=invalid");
    (await cookies()).set(DEV_COOKIE, encodeURIComponent(`${email}|${role}|${role === "CLIENT" ? devClient : ""}`), { httpOnly: true, sameSite: "lax", path: "/" });
    redirect(role === "CLIENT" ? "/qbr" : callbackUrl);
  }

  const errors: Record<string, string> = {
    invalid: "Sign-in failed. Check your email and password.",
    config: "Supabase is not configured on the server (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <Card className="w-full max-w-sm p-7">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-accent shadow-[0_10px_28px_-10px_rgb(var(--brand)/0.9)]">
          <Gauge className="h-6 w-6 text-navy" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Biz Customer Intelligence</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with your account.</p>
        {sp.error && <p role="alert" className={cn("glass mt-3 !rounded-xl px-3 py-2 text-xs", CALLOUT_CRITICAL)}>{errors[sp.error] ?? errors.invalid}</p>}
        <form action={login} className="mt-5 space-y-2">
          <Input name="email" type="email" aria-label="Email" placeholder="Email" autoComplete="username" required />
          <Input name="password" type="password" aria-label="Password" placeholder="Password" autoComplete="current-password" required />
          <Button variant="primary" className="w-full">Sign in</Button>
        </form>
        {devLoginEnabled() && (
          <form action={dev} className="mt-6 space-y-2 border-t hairline pt-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Development login (disabled in production)</p>
            <Input name="email" type="email" aria-label="Dev email" defaultValue="dev.admin@bizgroup.ae" required />
            <Select name="role" aria-label="Role" defaultValue="ADMIN" className="w-full">
              <option value="ADMIN">Admin</option><option value="MEMBER">Member</option><option value="CLIENT">Client (external QBR)</option>
            </Select>
            <Input name="clientId" aria-label="Client ID for the Client role" placeholder="Client ID (Client role only)" defaultValue="c_001" />
            <Button variant="dark" className="w-full">Sign in (dev)</Button>
          </form>
        )}
      </Card>
    </main>
  );
}
