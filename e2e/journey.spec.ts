import { expect, test } from "playwright/test";

/**
 * Core learner journey: sign up → enroll a starter list → study flashcards
 * with keyboard grading → session complete → practice modes load.
 *
 * Each run creates a throwaway account (unique email) on the dev database.
 * NOTE: signup is rate-limited to 5/hour per source IP, so rapid repeated
 * local runs can hit a 429 — wait or restart the dev server if that happens.
 */

const email = `e2e-${Date.now()}@example.com`;
const password = "e2e-test-password";

test.describe.configure({ mode: "serial" });

test("sign up and land on the dashboard", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page.getByText("Getting started")).toBeVisible();
});

async function logIn(page: import("playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

test("enroll a starter list", async ({ page }) => {
  await logIn(page);
  await page.goto("/lists");
  // Open the first list on the page (excluding the "new list" action link).
  await page
    .locator("a[href^='/lists/']:not([href$='/new'])")
    .first()
    .click();
  await page.waitForURL("**/lists/**");
  const enrolled = page.waitForResponse(
    (res) => res.url().includes("/enroll") && res.request().method() === "POST"
  );
  await page
    .getByRole("button", { name: /add all to my queue/i })
    .click();
  expect((await enrolled).ok()).toBeTruthy();
  // Enrollment reflects on the dashboard ring.
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /start/i })).toBeVisible({
    timeout: 10_000,
  });
});

test("study flashcards with keyboard grading", async ({ page }) => {
  await logIn(page);
  await page.goto("/study?limit=3");
  // Wait for the first card, then grade 3 cards: Space to reveal, → to grade.
  await expect(page.getByText(/tap to reveal/i)).toBeVisible({
    timeout: 15_000,
  });
  for (let i = 0; i < 3; i++) {
    // Advance reveal stages until FULL (term → phonetic → full = 2 presses max).
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700); // exit animation + optimistic advance
  }
  await expect(page.getByText("Session complete")).toBeVisible({
    timeout: 10_000,
  });
});

test("quiz mode loads and grades an answer", async ({ page }) => {
  await logIn(page);
  await page.goto("/study/quiz?limit=2");
  await expect(page.getByText("Pick the meaning")).toBeVisible({
    timeout: 15_000,
  });
  // Answer the first question (any option) and confirm the review request fires.
  const reviewPosted = page.waitForResponse(
    (res) =>
      res.url().includes("/api/study/review") && res.request().method() === "POST"
  );
  await page
    .locator("main button.rounded-xl, main button.w-full")
    .first()
    .click();
  const res = await reviewPosted;
  expect(res.ok()).toBeTruthy();
});

test("pronunciation quiz loads and grades", async ({ page }) => {
  await logIn(page);
  // Enroll a Chinese list so cards carry a reading for the pronunciation quiz.
  await page.goto("/lists");
  await page.getByRole("link", { name: /HSK 1/i }).click();
  await page.waitForURL("**/lists/**");
  const enrolled = page.waitForResponse(
    (res) => res.url().includes("/enroll") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: /add all to my queue/i }).click();
  await enrolled;

  await page.goto("/study/pronounce?limit=2");
  await expect(page.getByText("Pick the pronunciation")).toBeVisible({
    timeout: 15_000,
  });
  const reviewPosted = page.waitForResponse(
    (res) =>
      res.url().includes("/api/study/review") &&
      res.request().method() === "POST"
  );
  await page
    .locator("main button.rounded-xl, main button.w-full")
    .first()
    .click();
  expect((await reviewPosted).ok()).toBeTruthy();
});

test("hide-reading toggle persists", async ({ page }) => {
  await logIn(page);
  await page.goto("/settings");
  const saved = page.waitForResponse(
    (res) =>
      res.url().includes("/api/settings") &&
      res.request().method() === "PATCH"
  );
  // Flip "Show reading on cards" off.
  await page
    .getByRole("switch", { name: /show reading on cards/i })
    .click();
  const res = await saved;
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.showReading).toBe(false);
});

test("guest mode: one click to studying", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: /try it as a guest/i })
    .click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  // A starter list is auto-enrolled, so the Start button is available.
  await expect(page.getByRole("link", { name: /start/i })).toBeVisible({
    timeout: 10_000,
  });
});

test("guest upgrade keeps progress under a real login", async ({ page }) => {
  // Fresh guest session.
  await page.goto("/login");
  await page.getByRole("button", { name: /try it as a guest/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  // The dashboard nudges guests to save their progress.
  await page.getByRole("button", { name: /save my progress/i }).click();
  const upgradeEmail = `e2e-upgrade-${Date.now()}@example.com`;
  await page.locator("#upgrade-email").fill(upgradeEmail);
  await page.locator("#upgrade-password").fill(password);
  const upgraded = page.waitForResponse(
    (res) =>
      res.url().includes("/api/account/upgrade") &&
      res.request().method() === "POST"
  );
  await page.getByRole("button", { name: /create my account/i }).click();
  expect((await upgraded).ok()).toBeTruthy();

  // Banner disappears after re-sign-in; the enrolled queue is still there.
  await expect(
    page.getByRole("button", { name: /save my progress/i })
  ).toBeHidden({ timeout: 10_000 });

  // Log out and back in with the new credentials.
  await page.goto("/settings");
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/login", { timeout: 15_000 });
  await page.getByLabel("Email").fill(upgradeEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page.getByRole("link", { name: /start/i })).toBeVisible({
    timeout: 10_000,
  });
});

test("per-list progress chips show after enrolling", async ({ page }) => {
  await logIn(page);
  await page.goto("/lists");
  // The list enrolled earlier shows a "learning" rollup chip.
  await expect(page.getByText(/\d+ learning/).first()).toBeVisible({
    timeout: 10_000,
  });
});

test("match mode loads a round", async ({ page }) => {
  await logIn(page);
  await page.goto("/study/match?limit=5");
  await expect(page.getByText(/tap a word, then its meaning/i)).toBeVisible({
    timeout: 15_000,
  });
});

test("account deletion signs out and frees the email", async ({ page }) => {
  // Throwaway guest account so the main journey account survives.
  await page.goto("/login");
  await page.getByRole("button", { name: /try it as a guest/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.goto("/settings");
  await page.getByRole("button", { name: /^delete account$/i }).click();
  const deleted = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/account") &&
      res.request().method() === "DELETE"
  );
  await page
    .getByRole("button", { name: /yes, delete everything/i })
    .click();
  expect((await deleted).ok()).toBeTruthy();
  await page.waitForURL("**/signup", { timeout: 15_000 });
});
