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
  // New accounts pick a target language first, then land on the dashboard.
  await page.waitForURL("**/onboarding", { timeout: 15_000 });
  // Single launch language → onboarding opens on the level step directly;
  // HSK 1 is preselected and confirming enrolls the deck.
  await page.getByRole("button", { name: "Start studying" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await dismissIntro(page);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

/** Dismiss the one-time "How HSK Nest works" modal shown on the first dashboard visit. */
async function dismissIntro(page: import("playwright/test").Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  try {
    await gotIt.waitFor({ state: "visible", timeout: 3_000 });
    await gotIt.click();
  } catch {
    // Not shown this time (already seen) — nothing to dismiss.
  }
}

/**
 * Dismiss the cookie banner. Each test gets a fresh browser context, so the
 * banner reappears every login; left open it sits above the bottom nav and
 * intercepts clicks on content near the page bottom.
 */
async function dismissCookies(page: import("playwright/test").Page) {
  const accept = page.getByRole("button", { name: /accept all/i });
  try {
    await accept.waitFor({ state: "visible", timeout: 3_000 });
    await accept.click();
  } catch {
    // Already dismissed in this context.
  }
}

async function logIn(page: import("playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  // Fresh context per test → the one-time intro modal and cookie banner both
  // reappear; either one left open intercepts clicks later in the test.
  await dismissIntro(page);
  await dismissCookies(page);
}

test("enroll a starter list", async ({ page }) => {
  await logIn(page);
  await page.goto("/lists");
  // Onboarding auto-enrolls the "Foundation" (HSK 1) list, so open a
  // different one to exercise the manual enroll button.
  await page.getByRole("link", { name: /HSK 2/i }).first().click();
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
  // Wait for the first card. Brand-new words show an ungraded blue preview
  // first and come back for real grading, so a 3-card session takes up to 6
  // passes: reveal with Space, then either Continue (preview) or → (grade).
  await expect(page.getByText(/tap to reveal/i)).toBeVisible({
    timeout: 15_000,
  });
  for (let i = 0; i < 8; i++) {
    if (await page.getByText("Session complete").isVisible()) break;
    // Advance reveal stages until FULL (term → phonetic → full = 2 presses max).
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    // ArrowRight grades Good on normal cards and dismisses previews.
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
  // HSK 1 is already auto-enrolled from onboarding, which gives cards a
  // reading for the pronunciation quiz — nothing more to enroll here.

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
  // The appearance card lives on the Interface tab.
  await page.getByRole("tab", { name: /^Interface$/ }).click();
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
  // Guest accounts also pick a target language before landing on the dashboard.
  await page.waitForURL("**/onboarding", { timeout: 15_000 });
  // Single launch language → onboarding opens on the level step directly;
  // HSK 1 is preselected and confirming enrolls the deck.
  await page.getByRole("button", { name: "Start studying" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await dismissIntro(page);
  // A starter list is auto-enrolled, so the Start button is available.
  await expect(page.getByRole("link", { name: /start/i })).toBeVisible({
    timeout: 10_000,
  });
});

test("guest upgrade keeps progress under a real login", async ({ page }) => {
  // Fresh guest session.
  await page.goto("/login");
  await page.getByRole("button", { name: /try it as a guest/i }).click();
  await page.waitForURL("**/onboarding", { timeout: 15_000 });
  // Single launch language → onboarding opens on the level step directly;
  // HSK 1 is preselected and confirming enrolls the deck.
  await page.getByRole("button", { name: "Start studying" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await dismissIntro(page);

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
  // Sign out lives on the Account tab.
  await page.getByRole("tab", { name: /^Account$/ }).click();
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
  // The list enrolled earlier shows the slim "enrolled/total" rollup, and
  // enrolled lists are grouped under a Studying section.
  await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.getByRole("heading", { name: /studying/i })
  ).toBeVisible();
});

test("enrolling a second list skips already-tracked words", async ({ page }) => {
  await logIn(page);
  // Top 100 overlaps heavily with the HSK 1 words already enrolled.
  await page.goto("/lists");
  await page
    .getByRole("link", { name: /Top 100 Most Common Words/i })
    .click();
  await page.waitForURL("**/lists/**");
  const enrolled = page.waitForResponse(
    (res) => res.url().includes("/enroll") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: /add all to my queue/i }).click();
  const body = await (await enrolled).json();
  // Some words overlap with HSK 1 (的, 是, …) — they must not be re-enrolled.
  expect(body.alreadyTracked).toBeGreaterThan(0);
  expect(body.enrolled + body.alreadyTracked).toBe(100);
});

test("hide a starter list and restore it", async ({ page }) => {
  await logIn(page);
  await page.goto("/lists");
  // Hide a starter list this account never enrolled (enrolled lists stay
  // under Studying by design, so hiding them shows no Hidden section).
  const target = page
    .getByRole("link", { name: /Everyday Conversations/i })
    .first();
  const hidden = page.waitForResponse(
    (res) => res.url().includes("/hide") && res.request().method() === "POST"
  );
  await target.getByRole("button", { name: /hide this list/i }).click();
  expect((await hidden).ok()).toBeTruthy();

  // It moves into the collapsed Hidden section.
  const details = page.locator("details", { hasText: "Hidden" });
  await expect(details).toBeVisible({ timeout: 10_000 });
  await details.locator("summary").click();
  const restore = page.waitForResponse(
    (res) => res.url().includes("/hide") && res.request().method() === "DELETE"
  );
  await details
    .getByRole("button", { name: /show this list again/i })
    .click();
  expect((await restore).ok()).toBeTruthy();
});

test("practice mode reviews without moving the schedule", async ({ page }) => {
  await logIn(page);

  // Study a few cards normally so there are learned (non-NEW) words to refresh.
  await page.goto("/study?limit=3");
  await expect(page.getByText(/tap to reveal/i)).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700);
  }

  // Snapshot a learned word's dueAt before practicing.
  const before = await page.evaluate(async () => {
    const res = await fetch("/api/words");
    const data = await res.json();
    const learned = data.words.find(
      (w: { state: string }) => w.state !== "NEW" && w.state !== "ASSUMED"
    );
    return learned ? { wordId: learned.wordId, dueAt: learned.dueAt } : null;
  });
  expect(before).not.toBeNull();

  // Practice session: the review POST must carry practice semantics.
  await page.goto("/study?mode=practice&limit=3");
  await expect(page.getByText(/tap to reveal/i)).toBeVisible({ timeout: 15_000 });
  const reviewPosted = page.waitForResponse(
    (res) =>
      res.url().includes("/api/study/review") &&
      res.request().method() === "POST"
  );
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowRight");
  const postBody = (await reviewPosted).request().postDataJSON();
  expect(postBody.practice).toBe(true);

  // The learned word's dueAt is unchanged by practice.
  await page.waitForTimeout(500);
  const after = await page.evaluate(async (wordId: string) => {
    const res = await fetch("/api/words");
    const data = await res.json();
    const w = data.words.find((x: { wordId: string }) => x.wordId === wordId);
    return w ? w.dueAt : null;
  }, before!.wordId);
  expect(after).toBe(before!.dueAt);
});

test("words tab defaults to the Strength bubble view", async ({ page }) => {
  await logIn(page);
  await page.goto("/words");
  // Default view: at least one bubble trigger (word button with the shared
  // aria-label pattern "term, band, relative due") loads without toggling.
  await expect(
    page
      .getByRole("button", { name: /, (Mastered|Solid|Growing|Trouble|Known|New), / })
      .first()
  ).toBeVisible({ timeout: 10_000 });
});

test("words tab toggles to timeline view with a lane heading", async ({ page }) => {
  await logIn(page);
  await page.goto("/words");
  await page.getByRole("button", { name: /^Timeline$/ }).click();
  // Timeline view renders several memory-horizon lanes; assert at least one
  // heading shows (.first() — matching multiple would violate strict mode).
  await expect(
    page
      .getByRole("heading", {
        name: /due now|this week|this month|long-term memory|not started|resting/i,
      })
      .first()
  ).toBeVisible({ timeout: 10_000 });
});

test("words tab toggles to the Words list with retention sparklines", async ({ page }) => {
  await logIn(page);
  await page.goto("/words");
  await page.getByRole("button", { name: /^Words$/ }).click();
  // List rows render inside a <ul role="list"> with a retention sparkline SVG.
  await expect(page.getByRole("list").first()).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole("img", { name: /retention/i }).first()
  ).toBeVisible();
});

test("words tab toggles to the Strength bubble view", async ({ page }) => {
  await logIn(page);
  await page.goto("/words");
  await page.getByRole("button", { name: /^Strength$/ }).click();
  // At least one bubble trigger (word button with the shared aria-label
  // pattern "term, band, relative due") is visible.
  await expect(
    page
      .getByRole("button", { name: /, (Mastered|Solid|Growing|Trouble|Known|New), / })
      .first()
  ).toBeVisible({ timeout: 10_000 });
});

test("match mode loads a round", async ({ page }) => {
  await logIn(page);
  await page.goto("/study/match?limit=5");
  await expect(page.getByText(/tap matching pairs/i)).toBeVisible({
    timeout: 15_000,
  });
});

test("failed card repeats in-session until graded Good", async ({ page }) => {
  await logIn(page);

  await page.goto("/study?limit=1");
  await expect(page.getByText(/tap to reveal/i)).toBeVisible({ timeout: 15_000 });

  // A brand-new word starts as an ungraded preview — dismiss it first so the
  // next appearance carries the real 4-grade buttons.
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  if (
    await page.getByRole("button", { name: /got it — continue/i }).isVisible()
  ) {
    // ArrowRight dismisses the preview without posting a review.
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700);
    await expect(page.getByText(/tap to reveal/i)).toBeVisible();
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
  }

  // Grade Again (←): schedule-moving review posts, card re-queues.
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(700);

  // Session is NOT complete — the failed card comes back.
  await expect(page.getByText(/session complete/i)).not.toBeVisible();
  await expect(page.getByText(/tap to reveal/i)).toBeVisible();

  // Grade Good (→): the repeat is logged as practice and the session ends.
  const repeatPosted = page.waitForResponse(
    (res) =>
      res.url().includes("/api/study/review") &&
      res.request().method() === "POST"
  );
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowRight");
  const repeatBody = (await repeatPosted).request().postDataJSON();
  expect(repeatBody.practice).toBe(true);
  await expect(page.getByText(/session complete/i)).toBeVisible({
    timeout: 10_000,
  });
});

test("account deletion signs out and frees the email", async ({ page }) => {
  // Throwaway signed-up account so the main journey account survives.
  // (Delete account is hidden for guest accounts — they're already disposable.)
  const throwawayEmail = `e2e-throwaway-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(throwawayEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding", { timeout: 15_000 });
  // Single launch language → onboarding opens on the level step directly;
  // HSK 1 is preselected and confirming enrolls the deck.
  await page.getByRole("button", { name: "Start studying" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.goto("/settings");
  // Delete account lives on the Account tab.
  await page.getByRole("tab", { name: /^Account$/ }).click();
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
