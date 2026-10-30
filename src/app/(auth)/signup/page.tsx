import { redirect } from "next/navigation";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { siteUrl } from "@/server/site-url";
import { emailProblem, knownProblem, normalizeEmail, passwordProblem } from "@/lib/account-input";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { Button, Input } from "@/components/ui/primitives";

const MESSAGES: Record<string, string> = {
  config: "Sign-up is not available: Supabase is not configured on the server.",
  failed: "We could not create the account. Try again, or ask an administrator for an invitation.",
};

export default async function SignUp({ searchParams }: { searchParams: Promise<{ error?: string; problem?: string; sent?: string }> }) {
  const sp = await searchParams;

  async function signUp(form: FormData) {
    "use server";
    const email = normalizeEmail(form.get("email"));
    const password = String(form.get("password") ?? "");
    const problem = emailProblem(email) ?? passwordProblem(password, String(form.get("confirm") ?? ""));
    if (problem) redirect(`/signup?problem=${encodeURIComponent(problem)}`);
    if (!supabaseConfigured()) redirect("/signup?error=config");
    const sb = await supabaseServer();
    const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/portfolio` } });
    if (error) redirect("/signup?error=failed");
    // The same message whether or not the address already has an account, so this page cannot be used to find out who does.
    redirect("/signup?sent=1");
  }

  return (
    <AuthCard
      title="Create an Account"
      intro="Sign up with your work email. Staff accounts use a @bizgroup.ae address. Anyone else needs an invitation from an administrator."
      error={knownProblem(sp.problem) ?? (sp.error ? MESSAGES[sp.error] ?? MESSAGES.failed : null)}
      notice={sp.sent ? "Check your inbox. We sent a link to confirm your email address." : null}
    >
      {!sp.sent && (
        <form action={signUp} className="mt-5 space-y-2">
          <Input name="email" type="email" aria-label="Email" placeholder="Email" autoComplete="email" required />
          <Input name="password" type="password" aria-label="Password" placeholder="Password (10+ characters, letters and numbers)" autoComplete="new-password" minLength={10} required />
          <Input name="confirm" type="password" aria-label="Confirm password" placeholder="Confirm password" autoComplete="new-password" minLength={10} required />
          <Button variant="primary" className="w-full">Create Account</Button>
        </form>
      )}
      <p className="mt-4 text-xs text-slate-500">Already have an account? <AuthLink href="/signin">Sign in</AuthLink></p>
    </AuthCard>
  );
}
