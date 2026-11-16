"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Some Supabase email links bring the session in the address after the "#", which the server cannot see. This reads it
 * and signs the person in.
 *
 * On the set-password page it then reloads the page, and with no usable link it says the link has expired.
 * With `passive` (the sign-in page, where such links end up when the server could not read them) it stays invisible
 * unless the address carries a link, and then sends invited and password-reset people on to choose their password.
 */
export function HashSession({ passive = false }: { passive?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "expired" | "none">(passive ? "none" : "checking");

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access = p.get("access_token");
    const refresh = p.get("refresh_token");
    if (!access || !refresh) {
      // Supabase reports a used or expired link as "#error=...".
      setState(p.get("error") || !passive ? "expired" : "none");
      return;
    }
    setState("checking");
    const type = p.get("type");
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    sb.auth.setSession({ access_token: access, refresh_token: refresh }).then(({ error }) => {
      if (error) { setState("expired"); return; }
      if (passive) { window.location.replace(type === "invite" || type === "recovery" ? "/set-password" : "/"); return; }
      history.replaceState(null, "", window.location.pathname);
      router.refresh();
    });
  }, [router, passive]);

  if (state === "none") return null;
  return state === "expired"
    ? <p role="alert" className="mt-4 text-sm text-slate-600">This link has expired or was already used. Request a new one to continue.</p>
    : <p role="status" className="mt-4 text-sm text-slate-500">Checking your link…</p>;
}
