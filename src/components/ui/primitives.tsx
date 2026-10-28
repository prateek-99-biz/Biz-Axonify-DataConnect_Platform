import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none h-9 px-3.5",
  {
    variants: {
      variant: {
        primary: "bg-brand text-navy shadow-[0_6px_20px_-8px_rgb(var(--brand)/0.8)] hover:brightness-105",
        dark: "bg-navy text-white hover:bg-navy-soft dark:bg-white/10 dark:hover:bg-white/15",
        outline: "field text-ink hover:bg-brand-pale",
        ghost: "text-ink hover:bg-slate-100",
      },
      size: { default: "", sm: "h-8 px-2.5 text-xs", icon: "h-9 w-9 px-0" },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...p }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...p} />
));
Button.displayName = "Button";
export { buttonVariants };

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass overflow-hidden", className)} {...p} />;
}
export function CardHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b hairline px-5 py-4">
      <div>
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", {
  variants: {
    tone: {
      neutral: "bg-slate-100 text-slate-700 ring-slate-200",
      good: "bg-brand/15 text-brand-ink ring-brand/30",
      warn: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/25",
      critical: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-300/25",
      navy: "bg-navy text-white ring-navy dark:bg-white/10 dark:ring-white/15",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("field h-9 w-full px-3 text-sm", className)} {...p} />
));
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn("field h-9 cursor-pointer px-2.5 text-sm", className)} {...p} />
));
Select.displayName = "Select";

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {children && <p className="max-w-md text-xs text-slate-500">{children}</p>}
    </div>
  );
}

/** Shown when an integration returns `unavailable`. Never substitutes mock data. */
export function SourceUnavailable({ reason }: { reason: string }) {
  return (
    <div role="alert" className={cn("glass px-5 py-4 text-sm", CALLOUT_WARN)}>
      <p className="font-semibold">Source data unavailable</p>
      <p className="mt-0.5 text-xs">{reason}</p>
    </div>
  );
}

/** Tinted callout colours that stay legible in both themes. */
export const CALLOUT_WARN = "border-amber-300/60 !bg-amber-50/80 text-amber-900 dark:border-amber-300/20 dark:!bg-amber-400/10 dark:text-amber-100";
export const CALLOUT_CRITICAL = "border-red-300/60 !bg-red-50/80 text-red-800 dark:border-red-300/20 dark:!bg-red-500/10 dark:text-red-100";
