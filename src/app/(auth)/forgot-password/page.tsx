import { redirect } from "next/navigation";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { siteUrl } from "@/server/site-url";
import { emailProblem, normalizeEmail } from "@/lib/account-input";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { Button, Input } from "@/components/ui/primitives";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const sp = await searchParams;

  async function request(form: FormData) {
    "use server";
    const email = normalizeEmail(form.get("email"));
    if (emailProblem(email)) redirect("/forgot-password?error=email");
    if (!supabaseConfigured()) redirect("/forgot-password?error=config");
    const sb = await supabaseServer();
    // Any failure (unknown address, rate limit) gets the same answer, so this page cannot be used to find out who has an account.
    await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await siteUrl()}/auth/confirm?next=/set-password` });
    redirect("/forgot-password?sent=1");
  }

  const errors: Record<string, string> = { email: "Enter a valid email address.", config: "Password reset is not available: Supabase is not configured on the server." };

  return (
    <AuthCard
      title="Reset Your Password"
      intro="Enter your email and we will send you a link to choose a new password."
      error={sp.error ? errors[sp.error] ?? errors.email : null}
      notice={sp.sent ? "If an account exists for that email, a reset link is on its way. It can take a few minutes." : null}
    >
      {!sp.sent && (
        <form action={request} className="mt-5 space-y-2">
          <Input name="email" type="email" aria-label="Email" placeholder="Email" autoComplete="email" required />
          <Button variant="primary" className="w-full">Send Reset Link</Button>
        </form>
      )}
      <p className="mt-4 text-xs text-slate-500"><AuthLink href="/signin">Back to sign in</AuthLink></p>
    </AuthCard>
  );
}
