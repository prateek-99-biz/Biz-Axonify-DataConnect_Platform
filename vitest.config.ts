import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // tsconfig keeps JSX for Next.js to compile; tests that render pages need it compiled here.
  oxc: { jsx: { runtime: "automatic" } },
});
