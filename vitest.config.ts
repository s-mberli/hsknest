import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/",
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "**/*.config.ts",
        "**/prisma/**",
      ],
      // Measured baseline: committed with postReview tests and coverage setup
      // (Statement 83.03%, Branch 73.26%, Function 83.63%, Line 84.37%).
      // Thresholds set to measured values (rounded down to avoid false failures)
      // so coverage can only improve, never regress, without blocking unrelated PRs.
      thresholds: {
        statements: 83,
        branches: 73,
        functions: 83,
        lines: 84,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
