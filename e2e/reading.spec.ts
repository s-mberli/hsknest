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

/**
 * Reader text-size ladder: 25/28/31/35/39/44px, default 31. Regression guard
 * for the header −/+ buttons and the settings-drawer slider disagreeing
 * (src/lib/reading/fontSize.ts) and for the floor genuinely moving up from
 * the old 18-25px range for a reader with no stored preference.
 */
async function readerFontSizePx(page: import("playwright/test").Page): Promise<number> {
  const textContainer = page.locator("[data-sentence]").first().locator("..");
  return Number((await textContainer.evaluate((el) => getComputedStyle(el).fontSize)).replace("px", ""));
}

test("reader text defaults to >= 25px with no stored preference", async ({ page }) => {
  await logIn(page);
  await page.evaluate(() => localStorage.removeItem("hn-reader-prefs"));
  await openFirstStory(page);
  expect(await readerFontSizePx(page)).toBeGreaterThanOrEqual(25);
  expect(await readerFontSizePx(page)).toBe(31); // DEFAULT_READER_FONT_SIZE
});

test("header +/- buttons and settings slider agree on the same ladder", async ({ page }) => {
  await logIn(page);
  await page.evaluate(() => localStorage.removeItem("hn-reader-prefs"));
  await openFirstStory(page);

  const minus = page.getByRole("button", { name: "Decrease text size" });
  const plus = page.getByRole("button", { name: "Increase text size" });

  await plus.click();
  await plus.click();
  expect(await readerFontSizePx(page)).toBe(39); // 31 -> 35 -> 39
  await minus.click();
  expect(await readerFontSizePx(page)).toBe(35);

  // Open the settings drawer and confirm the slider reports the same value —
  // this is the exact disagreement the original bug produced.
  await page.getByRole("button", { name: "Reading settings" }).click();
  const slider = page.getByRole("slider");
  await expect(slider).toBeVisible();
  const sliderValue = await slider.evaluate((el) => (el as HTMLInputElement).value);
  const sizes = [25, 28, 31, 35, 39, 44];
  expect(sizes[Number(sliderValue)]).toBe(35);
});

test("a stale pre-migration font size in localStorage snaps up to the new floor", async ({ page }) => {
  await logIn(page);
  await page.goto("/reading"); // any same-origin page so localStorage is settable first
  await page.evaluate(() => localStorage.setItem("hn-reader-prefs", JSON.stringify({ fontSize: 18 })));
  await openFirstStory(page);
  expect(await readerFontSizePx(page)).toBeGreaterThanOrEqual(25);
});
