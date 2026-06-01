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
    // Load .env.local/.env before any test module imports the validated @/env
    // accessor (live Redis/engine integration tests need the real vars).
    setupFiles: ["tests/setup-env.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    fileParallelism: false, // DB tests share one local Postgres
  },
});
