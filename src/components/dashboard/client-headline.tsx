import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import type { ClientHeadline } from "@/server/services/attention";

const BAR: Record<ClientHeadline["tone"], string> = {
  good: "border-l-brand",
  neutral: "border-l-slate-300",
  warn: "border-l-warn",
  critical: "border-l-critical",
};

/** A client page opens with one plain sentence about how the client is doing, before any chart. */
export function ClientHeadlineCard({ headline }: { headline: ClientHeadline }) {
  return (
    <Card className={cn("border-l-4 px-5 py-4", BAR[headline.tone])}>
      <p className="text-lg font-semibold tracking-tight">{headline.headline}</p>
      {headline.points.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-sm text-slate-600">
          {headline.points.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </Card>
  );
}
