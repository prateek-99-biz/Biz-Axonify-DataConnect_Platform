"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/primitives";
import type { ImportResult } from "@/server/services/salesforce-accounts";

/** File picker for the Salesforce CSV, with the outcome shown underneath so nothing is saved without the admin seeing what was skipped. */
export function SalesforceImport({ action }: { action: (prev: ImportResult | null, form: FormData) => Promise<ImportResult> }) {
  const [result, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="space-y-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <input name="file" type="file" accept=".csv,text/csv" required aria-label="Salesforce accounts CSV" className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
        <Button variant="primary" disabled={pending}>{pending ? "Importing…" : "Import CSV"}</Button>
      </div>
      {result && (
        <div role="status" className="text-xs">
          <p className={result.imported ? "font-medium text-emerald-700 dark:text-emerald-300" : "font-medium"}>
            {result.imported} account{result.imported === 1 ? "" : "s"} saved{result.blank ? `, ${result.blank} blank row${result.blank === 1 ? "" : "s"} skipped` : ""}.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-700 dark:text-amber-300">
              {result.errors.slice(0, 12).map((e) => <li key={e}>{e}</li>)}
              {result.errors.length > 12 && <li>and {result.errors.length - 12} more.</li>}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
