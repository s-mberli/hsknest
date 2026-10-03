import { defineConfig, devices } from "playwright/test";
import config from "./playwright.config";

export default defineConfig({
  ...config,
  testMatch: ["session-recovery.spec.ts", "reading-correctness.spec.ts"],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
