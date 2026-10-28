"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_KEY } from "@/lib/theme";

/** Subscribes to the `dark` class on <html> so client components (charts) can pick theme-specific colours. */
export function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useIsDark();
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch { /* storage unavailable */ }
  };
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Dark mode" onClick={toggle} title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn("relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-line bg-slate-100 p-0.5 transition-colors", className)}>
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full bg-surface text-ink shadow-glass transition-transform duration-300", dark && "translate-x-6")}>
        {dark ? <Moon className="h-3.5 w-3.5" aria-hidden /> : <Sun className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
      </span>
    </button>
  );
}
