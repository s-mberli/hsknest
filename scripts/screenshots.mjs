// Capture README screenshots against a running dev/preview server.
//
// Usage (server must already be running and seeded):
//   EMAIL=you@example.com PASSWORD=secret node scripts/screenshots.mjs
//
// Env:
//   BASE_URL  — app base URL (default http://localhost:3000)
//   EMAIL     — login email for the credentials form (required)
//   PASSWORD  — login password (required)
//
// The script enrolls the user in "HSK 1 — Foundation", simulates a few
// reviews to populate the dashboard and study pages, then captures all
// screenshots. Idempotent: re-running overwrites the same PNGs.
//
// Requires: `npm i -D playwright` and `npx playwright install chromium`.

import { mkdir, cp } from "node:fs/promises";
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
const DOCS_DIR = join(__dirname, "..", "docs", "screenshots");
const PUBLIC_DIR = join(__dirname, "..", "public", "screenshots");

// ── Helpers ──────────────────────────────────────────────────────────────

async function api(page, path, opts = {}) {
  const res = await page.request.fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${opts.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Seed content ─────────────────────────────────────────────────────────

async function seedContent(page) {
  // 1. Find the HSK 1 list ID.
  const { lists } = await api(page, "/api/lists");
  const hsk1 = lists.find((l) => l.name === "HSK 1 — Foundation");
  if (!hsk1) throw new Error("HSK 1 — Foundation list not found. Run prisma db seed first.");

  // 2. Enroll in the list (idempotent — skips already-tracked words).
  const enroll = await api(page, `/api/lists/${hsk1.id}/enroll`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  console.log(`  Enrolled: ${enroll.enrolled} words (${enroll.alreadyTracked} already tracked)`);

  // 3. Fetch study queue to get word IDs for simulated reviews.
  const { cards: queueCards } = await api(page, "/api/study/queue");

  // 4. Simulate reviews on a handful of words to create progress history.
  const toReview = queueCards.filter((c) => c.kind === "new").slice(0, 5);
  let reviewed = 0;
  for (const item of toReview) {
    try {
      await api(page, "/api/study/review", {
        method: "POST",
        body: JSON.stringify({
          wordId: item.wordId,
          quality: 4, // swipe right — "good"
        }),
      });
      reviewed++;
    } catch {
      // Word may already be enrolled; skip.
    }
  }
  console.log(`  Reviewed: ${reviewed} words (quality 4)`);

  // 5. Review a few more with mixed quality to diversify strength bands.
  const more = queueCards.filter((c) => c.kind === "new").slice(5, 10);
  for (const item of more) {
    try {
      await api(page, "/api/study/review", {
        method: "POST",
        body: JSON.stringify({
          wordId: item.wordId,
          quality: 2, // swipe left — "again"
        }),
      });
    } catch {
      // skip
    }
  }
}

// ── Screenshot capture ───────────────────────────────────────────────────

const PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "study", path: "/study" },
  { name: "words", path: "/words" },
  { name: "lists", path: "/lists" },
];

async function main() {
  await mkdir(DOCS_DIR, { recursive: true });
  await mkdir(PUBLIC_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Log in through the credentials form. A click that fires before React
  // hydration falls back to a native form submit and silently fails, so
  // verify we actually left /login and retry once.
  console.log("Logging in…");
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000); // let hydration attach the submit handler
    await page.fill('input[name="email"], input[type="email"]', EMAIL);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    if (page.url().includes("/dashboard")) break;
    if (attempt === 2) throw new Error(`Login failed — still on ${page.url()}`);
    console.log("  Login did not land on /dashboard, retrying…");
  }

  // Dismiss the "How HSK Nest works" intro modal (animates in shortly after
  // the first dashboard load), then the cookie banner — both would otherwise
  // overlay every capture.
  const gotIt = page.getByRole("button", { name: "Got it" });
  try {
    await gotIt.waitFor({ state: "visible", timeout: 5000 });
    await gotIt.click();
  } catch {
    // Not shown (already dismissed for this account) — nothing to do.
  }
  const decline = page.getByRole("button", { name: /decline non-essential/i });
  if (await decline.isVisible().catch(() => false)) {
    await decline.click();
  }

  // Seed study content so pages aren't empty.
  console.log("Seeding study content…");
  await seedContent(page);

  // Capture screenshots.
  for (const { name, path } of PAGES) {
    console.log(`Capturing ${name}…`);
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
    // Let animations + data settle.
    await page.waitForTimeout(800);

    const docsFile = join(DOCS_DIR, `${name}.png`);
    const publicFile = join(PUBLIC_DIR, `${name}.png`);
    await page.screenshot({ path: docsFile });
    await cp(docsFile, publicFile);
    console.log(`✓ ${name} → ${docsFile} + ${publicFile}`);
  }

  await browser.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
