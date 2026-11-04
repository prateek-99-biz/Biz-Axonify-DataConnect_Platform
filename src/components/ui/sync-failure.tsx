import { explainSyncFailure } from "@/lib/sync-errors";

/** Why a refresh failed. Admins get a plain explanation with the raw text behind a toggle; everyone else a short generic line. */
export function SyncFailure({ message }: { message: string | null }) {
  if (message == null) return <>The sync did not finish. An administrator can see the details.</>;
  const help = explainSyncFailure(message);
  if (!help) return <>{message}</>;
  return (
    <details>
      <summary className="cursor-pointer"><span className="font-medium text-ink">{help.summary}</span> {help.fix}</summary>
      <p className="mt-1 text-[11px] text-slate-400">{message}</p>
    </details>
  );
}
