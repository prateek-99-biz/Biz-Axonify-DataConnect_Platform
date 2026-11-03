import Image from "next/image";
import { cn } from "@/lib/utils";

/** Three overlapping circles in the Biz Group logo colours: a small, quiet signature for places where the full logo would be too much. */
export function BizMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center", className)}>
      <span className="h-2.5 w-2.5 rounded-full bg-biz-purple" />
      <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-brand ring-1 ring-white/70 dark:ring-black/30" />
      <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-biz-orange ring-1 ring-white/70 dark:ring-black/30" />
    </span>
  );
}

/** The Biz Group logo on a white tile, so its grey lettering stays readable on both the light and dark themes. */
export function BrandLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_-10px_rgb(0_0_0/0.45)] ring-1 ring-black/5 dark:ring-white/20", className)}
      style={{ width: size, height: size }}>
      <Image src="/biz-group-logo.png" alt="Biz Group" width={size} height={size} priority className="h-full w-full object-contain p-[7%]" />
    </span>
  );
}
