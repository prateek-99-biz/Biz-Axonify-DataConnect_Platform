import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import { logAuthError } from "@/server/auth/log";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { SubmitButton } from "@/components/ui/submit-button";

const TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "email", "magiclink", "email_change"];

const COPY: Partial<Record<EmailOtpType, { title: string; intro: string; button: string }>> = {
  invite: { title: "Accept Your Invitation", intro: "Continue to choose a password and finish setting up your account.", button: "Continue" },
  recovery: { title: "Reset Your Password", intro: "Continue to choose a new password.", button: "Continue" },
};
const DEFAULT_COPY = { title: "Confirm Your Email", intro: "Continue to confirm your email address and sign in.", button: "Continue" };

/**
 * Where one-time email links stop before they are used. A link only works once, and link previews and mail scanners
 * (Outlook and Teams Safe Links, for example) open every link before the person does. Opening this page uses nothing up:
 * the link is spent only when a person presses the button, which a scanner does not do.
 */
export default async function Continue({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const sp = await searchParams;
  const type = TYPES.find((t) => t === sp.type);
  const tokenHash = sp.token_hash && /^[A-Za-z0-9_-]{16,200}$/.test(sp.token_hash) ? sp.token_hash : null;
  const next = safeCallbackUrl(sp.next, "/");

  async function verify(form: FormData) {
    "use server";
    const formType = TYPES.find((t) => t === form.get("type"));
    const hash = String(form.get("token_hash") ?? "");
    if (!formType || !hash || !supabaseConfigured()) redirect("/signin?error=link");
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ type: formType, token_hash: hash });
    if (error) {
      logAuthError(`email link (${formType})`, error);
      redirect("/signin?error=link");
    }
    redirect(safeCallbackUrl(String(form.get("next") ?? ""), "/"));
  }

  if (!type || !tokenHash) {
    return (
      <AuthCard title="This Link Is Not Valid" error="The link is incomplete. Open it again from the message it came in, or request a new one.">
        <p className="mt-4 text-xs text-slate-500"><AuthLink href="/forgot-password">Request a new link</AuthLink> · <AuthLink href="/signin">Sign in</AuthLink></p>
      </AuthCard>
    );
  }

  const copy = COPY[type] ?? DEFAULT_COPY;
  return (
    <AuthCard title={copy.title} intro={copy.intro}>
      <form action={verify} className="mt-5 space-y-2">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <SubmitButton variant="primary" className="w-full" pendingText="One moment…">{copy.button}</SubmitButton>
      </form>
      <p className="mt-4 text-xs text-slate-500">The link works once. If it has already been used, <AuthLink href="/forgot-password">request a new one</AuthLink>.</p>
    </AuthCard>
  );
}
