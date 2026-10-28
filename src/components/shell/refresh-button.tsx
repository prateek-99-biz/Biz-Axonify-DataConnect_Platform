"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/** Admin-only. Triggers the same sync as the daily job; the server enforces permission and a 60s cooldown. */
export function RefreshButton({ asOf }: { asOf: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        setMsg({ ok: true, text: `Updated ${j.clients} clients` });
        router.refresh();
      } else {
        setMsg({ ok: false, text: j.reason ?? j.error ?? "Refresh failed" });
      }
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span role="status" className={`hidden max-w-[16rem] truncate text-xs lg:inline ${msg.ok ? "text-brand-ink" : "text-critical"}`} title={msg.text}>{msg.text}</span>}
      <Button size="sm" onClick={run} disabled={busy} title={asOf ? `Last synced ${asOf.slice(0, 16).replace("T", " ")} UTC` : "Not synced yet"}>
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden /> {busy ? "Refreshing…" : "Refresh data"}
      </Button>
    </div>
  );
}
