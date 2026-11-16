import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { logAuthError } from "@/server/auth/log";
import { safeCallbackUrl } from "@/lib/safe-redirect";

const TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "email", "magiclink", "email_change"];

/**
 * Where the links in Supabase emails (invitation, password reset, sign-up confirmation) land. It turns the link's code
 * into a signed-in session, then sends the person on (the set-password page for invitations and resets).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const next = safeCallbackUrl(q.get("next"), "/");
  const fail = () => NextResponse.redirect(new URL("/signin?error=link", req.url));
  if (!supabaseConfigured()) return fail();

  const sb = await supabaseServer();
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  const type = q.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) logAuthError("email link (code)", error);
    return error ? fail() : NextResponse.redirect(new URL(next, req.url));
  }
  if (tokenHash && type && TYPES.includes(type)) {
    // Not used up here: link previews and mail scanners open every link. The page asks the person to press a button,
    // and only that spends the link.
    const to = new URL("/auth/continue", req.url);
    to.searchParams.set("token_hash", tokenHash);
    to.searchParams.set("type", type);
    to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  }
  return fail();
}
