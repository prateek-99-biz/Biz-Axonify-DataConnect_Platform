import Image from "next/image";
import { cn } from "@/lib/utils";

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
