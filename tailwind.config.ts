import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#82C657", dark: "#6AAE41", pale: "#EEF6E8" },
        navy: { DEFAULT: "#1D2B43", soft: "#2B3C5A" },
        warn: "#F59E0B",
        critical: "#DC2626",
        line: "#E5E9EF",
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
