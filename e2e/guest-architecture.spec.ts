import { expect, test } from "playwright/test";
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function createTestGuestUser() {
  const suffix = randomBytes(6).toString("hex");
  const email = `guest-${suffix}@guest.local`;
  const password = "test-guest-password-123";
  const passwordHash = await hash(password, 12);

  const lang = await prisma.language.findFirst({ where: { code: "zh" } });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Guest",
      targetLanguageId: lang?.id,
    },
  });

  const words = await prisma.word.findMany({
    where: { wordList: { languageId: lang!.id } },
    take: 1,
  });

  if (words.length > 0) {
    await prisma.userProgress.createMany({
      data: words.map((w) => ({
        userId: user.id,
        wordId: w.id,
        state: "REVIEW",
        dueAt: new Date(),
      })),
    });
  }

  return { user, email, password, suffix };
}

test.describe("Guest Architecture E2E Flow", () => {

  test("Persona A: First-time Guest finishes session and hits Single-Session Cap", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const { email, password } = await createTestGuestUser();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    
    const loginRes = page.waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"));
    await page.getByRole("button", { name: /sign in/i }).click();
    await loginRes;

    await page.waitForURL("**/dashboard", { timeout: 10_000 });

    await page.goto("/study");
    
    await expect(page.getByText(/tap to reveal|forgot|knew|easy|hard|got it/i).first()).toBeVisible({
      timeout: 15_000,
    });
    for (let i = 0; i < 8; i++) {
      if (await page.getByText("Session complete").isVisible()) break;
      await page.keyboard.press("Space");
      await page.waitForTimeout(150);
      await page.keyboard.press("Space");
      await page.waitForTimeout(150);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(700);
    }

    await expect(page.getByText("Session complete")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create free account/i })
    ).toBeVisible();
    // Guests keep a way onward next to the save-progress nudge.
    await expect(
      page.getByRole("button", { name: /back to dashboard/i })
    ).toBeVisible();
    await context.close();
  });

  test("Persona B: returning guest with words due is offered an account on 'Start studying' and can decline", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const { user, email, password } = await createTestGuestUser();

    // Backdate createdAt past the 24-hour threshold (25h, clear of DST shifts).
    await prisma.user.update({
      where: { id: user.id },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);

    const loginRes = page.waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"));
    await page.getByRole("button", { name: /sign in/i }).click();
    await loginRes;

    // Land on dashboard — wait for client-side router.push("/dashboard") to settle
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 15_000 });

    // 'Start studying' first offers the account, with copy that states what is
    // really due (not the generic "Save your progress" title used elsewhere).
    await page.getByRole("link", { name: /start studying/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /1 word is due for review/i })
    ).toBeVisible();
    expect(page.url()).not.toContain("/study");

    // The prompt is dismissible: declining continues into Study.
    await page.getByRole("button", { name: /not now, keep studying/i }).click();
    await page.waitForURL("**/study**", { timeout: 15_000 });

    // Once declined, the prompt does not come back in this browser session.
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /start studying/i }).click();
    await page.waitForURL("**/study**", { timeout: 15_000 });
    await context.close();
  });

  test("a guest in their first 24 hours goes straight to Study", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const { email, password } = await createTestGuestUser();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);

    const loginRes = page.waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"));
    await page.getByRole("button", { name: /sign in/i }).click();
    await loginRes;

    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await page.getByRole("link", { name: /start studying/i }).click();
    await page.waitForURL("**/study**", { timeout: 15_000 });
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await context.close();
  });
});

test("login recovers from an explicit CSRF response before entering the dashboard", async ({ page }) => {
  const { email, password } = await createTestGuestUser();
  let attempts = 0;
  await page.route("**/api/auth/callback/credentials", async route => {
    attempts += 1;
    if (attempts === 1) {
      const origin = new URL(route.request().url()).origin;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: `${origin}/api/auth/signin?csrf=true` }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});
