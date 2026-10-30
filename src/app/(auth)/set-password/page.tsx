import { redirect } from "next/navigation";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { knownProblem, passwordProblem } from "@/lib/account-input";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { HashSession } from "@/components/auth/hash-session";
import { Button, Input } from "@/components/ui/primitives";

/** Where invited people choose their password, and where password-reset links end. Needs the session the email link creates. */
export default async function SetPassword({ searchParams }: { searchParams: Promise<{ problem?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = supabaseConfigured() ? (await (await supabaseServer()).auth.getUser()).data.user : null;

  async function save(form: FormData) {
    "use server";
    const password = String(form.get("password") ?? "");
    const problem = passwordProblem(password, String(form.get("confirm") ?? ""));
    if (problem) redirect(`/set-password?problem=${encodeURIComponent(problem)}`);
    const sb = await supabaseServer();
    if (!(await sb.auth.getUser()).data.user) redirect("/set-password");
    const { error } = await sb.auth.updateUser({ password });
    if (error) redirect("/set-password?error=failed");
    redirect("/portfolio");
  }

  if (!user) {
    return (
      <AuthCard title="Set Your Password">
        <HashSession />
        <p className="mt-4 text-xs text-slate-500"><AuthLink href="/forgot-password">Request a new link</AuthLink> · <AuthLink href="/signin">Sign in</AuthLink></p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set Your Password"
      intro={`Choose a password for ${user.email}.`}
      error={knownProblem(sp.problem) ?? (sp.error ? "We could not save the password. Try again, or request a new link." : null)}
    >
      <form action={save} className="mt-5 space-y-2">
        <Input name="password" type="password" aria-label="New password" placeholder="New password (10+ characters, letters and numbers)" autoComplete="new-password" minLength={10} required />
        <Input name="confirm" type="password" aria-label="Confirm new password" placeholder="Confirm new password" autoComplete="new-password" minLength={10} required />
        <Button variant="primary" className="w-full">Save Password and Continue</Button>
      </form>
    </AuthCard>
  );
}
