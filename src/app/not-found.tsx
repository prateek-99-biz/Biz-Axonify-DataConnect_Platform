import Link from "next/link";
import { BizMark, BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Card, buttonVariants } from "@/components/ui/primitives";

/** Shown for any address that does not exist, in place of the plain default page. */
export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <Card className="w-full max-w-sm p-7">
        <BrandLogo size={64} />
        <h1 className="mt-4 text-xl font-bold tracking-tight">Page Not Found</h1>
        <p className="mt-1 text-sm text-slate-500">That address does not exist, or the page has moved. Check the link, or go back to the start.</p>
        <Link href="/" className={`${buttonVariants({ variant: "primary" })} mt-5 w-full`}>Back to the Dashboard</Link>
        <p className="mt-6 flex items-center gap-2 border-t hairline pt-4 text-[11px] text-slate-500"><BizMark />A Biz Group dashboard for Axonify</p>
      </Card>
    </main>
  );
}
