"use client";

import { Button } from "@/components/ui/primitives";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-semibold text-red-800">Something went wrong loading this view</p>
      <p className="mt-1 text-xs text-red-700">{error.digest ? `Reference: ${error.digest}` : "An unexpected error occurred."}</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
