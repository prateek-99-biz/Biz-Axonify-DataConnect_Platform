import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Card, CALLOUT_CRITICAL } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { cn } from "@/lib/utils";

/** Shared frame for the account pages: logo, title, optional message, then the form. */
export function AuthCard({ title, intro, error, notice, children }: { title: string; intro?: string; error?: string | null; notice?: string | null; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <Card className="w-full max-w-sm p-7">
        <BrandLogo size={64} />
        <h1 className="mt-4 text-xl font-bold tracking-tight">{title}</h1>
        {intro && <p className="mt-1 text-sm text-slate-500">{intro}</p>}
        {error && <p role="alert" className={cn("glass mt-3 !rounded-xl px-3 py-2 text-xs", CALLOUT_CRITICAL)}>{error}</p>}
        {notice && <p role="status" className="glass mt-3 !rounded-xl border-emerald-300/60 !bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-300/20 dark:!bg-emerald-400/10 dark:text-emerald-100">{notice}</p>}
        {children}
      </Card>
    </main>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-medium text-brand-ink underline-offset-2 hover:underline">{children}</Link>;
}
