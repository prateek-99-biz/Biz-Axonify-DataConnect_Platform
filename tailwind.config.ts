import type { Config } from "tailwindcss";

// Colours are CSS variables (RGB channels) so one class works in light and dark mode; values live in globals.css.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const slate = Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, v(`slate-${n}`)]));

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: v("brand"), dark: v("brand-dark"), pale: v("brand-pale"), accent: v("brand-accent"), ink: v("brand-ink") },
        navy: { DEFAULT: "#1D2B43", soft: "#2B3C5A" },
        ink: v("ink"),
        surface: v("surface"),
        line: v("line"),
        slate,
        warn: v("warn"),
        critical: v("critical"),
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Inter", "Segoe UI", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { "2xl": "1.25rem", "3xl": "1.75rem" },
      boxShadow: {
        glass: "inset 0 1px 0 0 rgb(var(--glass-highlight) / var(--glass-highlight-alpha)), 0 10px 40px -18px rgb(var(--shadow) / 0.35)",
        lift: "inset 0 1px 0 0 rgb(var(--glass-highlight) / var(--glass-highlight-alpha)), 0 18px 50px -20px rgb(var(--shadow) / 0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
