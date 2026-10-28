"use client";

import { Button, CALLOUT_CRITICAL } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function QbrError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className={cn("glass mx-auto mt-10 max-w-lg p-8 text-center", CALLOUT_CRITICAL)}>
      <p className="font-semibold">Something went wrong loading this page</p>
      <p className="mt-1 text-xs">{error.digest ? `Reference: ${error.digest}` : "An unexpected error occurred."}</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
