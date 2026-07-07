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

test("match mode loads a round", async ({ page }) => {
  await logIn(page);
  await page.goto("/study/match?limit=5");
  await expect(page.getByText(/tap a word, then its meaning/i)).toBeVisible({
    timeout: 15_000,
  });
});
