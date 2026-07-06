// Capture README screenshots against a running dev/preview server.
//
// Usage (server must already be running and seeded, with a test account):
//   EMAIL=you@example.com PASSWORD=secret node scripts/screenshots.mjs
//
// Env:
//   BASE_URL  — app base URL (default http://localhost:3000)
//   EMAIL     — login email for the credentials form (required)
//   PASSWORD  — login password (required)
//
// Requires: `npm i -D playwright` and `npx playwright install chromium`.
// This script is a devDependency helper — it is never run inside the Docker image.

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Set EMAIL and PASSWORD env vars (the test account to log in as).");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "screenshots");

const PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "study", path: "/study" },
  { name: "words", path: "/words" },
  { name: "lists", path: "/lists" },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Log in through the credentials form.
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"], input[type="email"]', EMAIL);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  for (const { name, path } of PAGES) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
    // Let animations settle.
    await page.waitForTimeout(600);
    const file = join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(`✓ ${name} → ${file}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
