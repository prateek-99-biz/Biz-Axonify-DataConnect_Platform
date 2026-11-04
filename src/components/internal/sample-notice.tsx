import Link from "next/link";
import { Badge } from "@/components/ui/primitives";

/** Shown on the internal pages while made-up Salesforce data is loaded, so nobody mistakes it for the real thing. */
export function SampleNotice({ count, canRemove }: { count: number; canRemove: boolean }) {
  if (count <= 0) return null;
  return (
    <p role="note" className="glass flex flex-wrap items-center gap-2 !rounded-xl px-4 py-2 text-xs text-slate-600">
      <Badge tone="warn">Sample Data</Badge>
      CSMs, licences, values and renewal dates on this page are made up.
      {canRemove ? <> <Link href="/settings" className="underline">Remove them in Settings</Link>.</> : " An admin can remove them."}
    </p>
  );
}
