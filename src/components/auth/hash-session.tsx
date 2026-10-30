"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Some Supabase email links bring the session in the address after the "#", which the server cannot see. This reads it,
 * signs the person in and reloads the page. With no usable link it says the link has expired.
 */
export function HashSession() {
  const router = useRouter();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access = p.get("access_token");
    const refresh = p.get("refresh_token");
    if (!access || !refresh) { setExpired(true); return; }
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    sb.auth.setSession({ access_token: access, refresh_token: refresh }).then(({ error }) => {
      if (error) { setExpired(true); return; }
      history.replaceState(null, "", window.location.pathname);
      router.refresh();
    });
  }, [router]);

  return expired
    ? <p role="alert" className="mt-4 text-sm text-slate-600">This link has expired or was already used. Request a new one to continue.</p>
    : <p role="status" className="mt-4 text-sm text-slate-500">Checking your link…</p>;
}
