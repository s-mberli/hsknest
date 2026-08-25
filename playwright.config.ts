import { defineConfig, devices } from "playwright/test";

/**
 * End-to-end browser tests. Run with `npm run test:e2e`.
 * Reuses a dev server already listening on :3000, otherwise starts one.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  // CI gets 1 retry: the shared logIn() helper races a known NextAuth
  // cookie-visibility issue (see src/lib/authClient.ts's confirmSession()
  // comment) under CI's slower/CPU-constrained runner, so a single spec
  // times out on `waitForURL` roughly once every few runs. A retry turns
  // that into "green on the second try" without masking a real regression
  // (a test that fails twice still fails the job). Local runs stay at 0 —
  // a flake locally should be investigated, not silently retried away.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  // Pre-compile every route once before the suite (dev mode compiles routes on
  // first hit; /dashboard's cold compile is ~25–30s and would otherwise flake
  // whichever test hits it first). See e2e/global-setup.ts.
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // Headroom over a cold route compile, in case warmup is skipped (e.g. a
    // brand-new route added after global-setup's list).
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
    // The journey suite creates many accounts and exercises guest mode —
    // both are gated to a single claim on self-hosted instances (see
    // src/lib/registration.ts). Reopen registration for local e2e runs too.
    env: { ALLOW_REGISTRATION: "true" },
  },
});
