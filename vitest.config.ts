import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // React 19 automatic JSX runtime for the jsdom component tests (.tsx).
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    fileParallelism: false, // DB tests share one local Postgres
  },
});
