import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none h-9 px-3",
  {
    variants: {
      variant: {
        primary: "bg-brand text-navy hover:bg-brand-dark",
        dark: "bg-navy text-white hover:bg-navy-soft",
        outline: "border border-line bg-white hover:bg-brand-pale",
        ghost: "hover:bg-brand-pale",
      },
      size: { default: "", sm: "h-8 px-2 text-xs", icon: "h-9 w-9 px-0" },
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
  return <div className={cn("rounded-lg border border-line bg-white", className)} {...p} />;
}
export function CardHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const badgeVariants = cva("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-slate-100 text-slate-700",
      good: "bg-brand-pale text-[#3d7a1c]",
      warn: "bg-amber-50 text-amber-700",
      critical: "bg-red-50 text-red-700",
      navy: "bg-navy text-white",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("h-9 w-full rounded-md border border-line bg-white px-3 text-sm placeholder:text-slate-400", className)} {...p} />
));
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn("h-9 rounded-md border border-line bg-white px-2 text-sm", className)} {...p} />
));
Select.displayName = "Select";

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="max-w-md text-xs text-slate-500">{children}</p>}
    </div>
  );
}

/** Shown when an integration returns `unavailable`. Never substitutes mock data. */
export function SourceUnavailable({ reason }: { reason: string }) {
  return (
    <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="font-semibold">Source data unavailable</p>
      <p className="mt-0.5 text-xs">{reason}</p>
    </div>
  );
}
