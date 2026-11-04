"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/primitives";

/** Clears an alert from the list. It stays cleared for this person and returns only if a new alert is raised. */
export function AckButton({ alertKey }: { alertKey: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  async function ack() {
    setFailed(false);
    const res = await fetch("/api/alerts/ack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alertKey }) });
    if (!res.ok) { setFailed(true); return; }
    start(() => router.refresh());
  }

  return (
    <span className="flex items-center gap-2">
      <Button size="sm" onClick={ack} disabled={pending}>{pending ? "Clearing…" : "Acknowledge"}</Button>
      {failed && <span role="alert" className="text-[11px] text-critical">Could not clear it. Try again.</span>}
    </span>
  );
}
