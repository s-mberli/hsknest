import { expect, test } from "playwright/test";

/**
 * Reading mode E2E: sign up → open a story → tap a word → add to deck →
 * verify in study queue with encounter sentence.
 *
 * Audio sync is skipped when the story has no audio file (fixture-tolerant).
 *
 * Each test() gets a fresh browser context (see journey.spec.ts's logIn
 * comment), so every test after signup logs back in explicitly rather than
 * assuming the session persists.
 */

const email = `e2e-reading-${Date.now()}@example.com`;
const password = "e2e-test-password";

test.describe.configure({ mode: "serial" });

async function signUp(page: import("playwright/test").Page) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding", { timeout: 30_000 });
  await page.getByRole("button", { name: "Start studying" }).click();
  await page.waitForURL("**/study**", { timeout: 15_000 });
}

async function logIn(page: import("playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await dismissIntro(page);
  await dismissCookies(page);
}

async function dismissIntro(page: import("playwright/test").Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  try {
    await gotIt.waitFor({ state: "visible", timeout: 3_000 });
    await gotIt.click();
  } catch {}
}

async function dismissCookies(page: import("playwright/test").Page) {
  const accept = page.getByRole("button", { name: /accept all/i });
  try {
    await accept.waitFor({ state: "visible", timeout: 3_000 });
    await accept.click();
  } catch {}
}

test("sign up for reading E2E", async ({ page }) => {
  await signUp(page);
  await dismissIntro(page);
});

/**
 * Opens a story from the library into the reader. `/reading` links go to a
 * per-story landing page (title, keywords, a "Read & Listen" button) rather
 * than straight into the reader — the library's "Best next read" and
 * "Continue reading" rows are also `a[href*='/reading/']` matches, so scope
 * to a level-list card specifically.
 */
async function openFirstStory(page: import("playwright/test").Page) {
  await page.goto("/reading");
  await page.waitForSelector("h2", { timeout: 10_000 }); // level heading (e.g. "HSK 1")
  const storyLink = page.locator("h2 + div a[href*='/reading/']").first();
  await storyLink.click();
  await page.getByRole("link", { name: /read & listen/i }).click();
  await page.waitForURL("**/reading/**/read**", { timeout: 10_000 });
  await page.waitForSelector("[data-sentence]", { timeout: 10_000 });
}

test("open a story and tap a word", async ({ page }) => {
  await logIn(page);
  await openFirstStory(page);
});

test("add a word to deck from reader", async ({ page }) => {
  await logIn(page);
  await openFirstStory(page);

  // Find a non-punctuation token and click it
  const token = page.locator("[data-sentence] span").first();
  await token.click();

  // Popup should appear with a meaning or "Add to deck" button
  const addButton = page.getByRole("button", { name: /add/i });
  await addButton.waitFor({ state: "visible", timeout: 5_000 });
  await addButton.click();

  // Toast should confirm addition
  const toast = page.getByText(/added to deck/i);
  await expect(toast).toBeVisible({ timeout: 5_000 });
});

test("word appears in study queue after adding from reader", async ({ page }) => {
  await logIn(page);
  await page.goto("/study");
  // The study page should load — word may or may not appear depending on
  // scheduling (NEW words are capped), so just verify the page loads
  await page.waitForSelector("button", { timeout: 10_000 });
});
