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
      page.getByRole("button", { name: /save progress & continue free/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /keep practicing/i })
    ).not.toBeVisible();
    await context.close();
  });

  test("Persona B: Returning Guest on Day 2 sees Dashboard but hits Soft Wall on 'Start Studying'", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const { user, email, password } = await createTestGuestUser();

    // Backdate createdAt to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await prisma.user.update({
      where: { id: user.id },
      data: { createdAt: yesterday },
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

    // Click 'Start Studying' -> Day-2 Soft Wall modal triggers
    await page.getByRole("button", { name: /start studying/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Day-2 soft wall uses its own copy (not the generic "Save your
    // progress" title shown elsewhere) — same upgrade dialog, different hook.
    await expect(
      page.getByRole("heading", { name: /day-2 reviews are due/i })
    ).toBeVisible();

    await expect(page.url()).not.toContain("/study");
    await context.close();
  });
});
