import { expect, test } from "playwright/test";
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function createTestGuestUser() {
  const suffix = randomBytes(6).toString("hex");
  const email = `guest-${suffix}@guest.local`;
  const password = "test-guest-password-123";
  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Guest",
    },
  });

  return { user, email, password };
}

test.describe("Guest Architecture E2E Flow", () => {
  test.describe.configure({ mode: "serial" });

  test("Persona A: First-time Guest finishes session and hits Single-Session Cap", async ({ page }) => {
    // 1. Create a guest user via Prisma (bypass rate limit)
    const { email, password } = await createTestGuestUser();

    // 2. Sign in as the new guest
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // 3. New guest goes to onboarding -> starts studying
    await page.waitForURL("**/onboarding", { timeout: 15_000 });
    await page.getByRole("button", { name: "Start studying" }).click();
    await page.waitForURL("**/study**", { timeout: 15_000 });
    await page.goto("/study?limit=1");
    
    await expect(page.getByText(/tap to reveal/i)).toBeVisible({
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

    // 5. Verify Single-Session Cap UX on Session Complete Screen
    await expect(page.getByText(/session complete|practice done/i)).toBeVisible();
    
    // Verify "Save Progress & Continue Free" button IS VISIBLE
    await expect(page.getByRole("button", { name: /save progress & continue free/i })).toBeVisible();

    // Verify "Keep practicing" and "Back to dashboard" ARE HIDDEN for guest
    await expect(page.getByRole("link", { name: /keep practicing/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /back to dashboard/i })).not.toBeVisible();
  });

  test("Persona B: Returning Guest on Day 2 sees Dashboard but hits Soft Wall on 'Start Studying'", async ({ page }) => {
    // 1. Create a guest user via Prisma
    const { user, email, password } = await createTestGuestUser();

    // 2. Mutate createdAt to yesterday (Day 2)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Also assign a target language and enroll a list so onboarding is bypassed and cards are due
    const lang = await prisma.language.findFirst({ where: { code: "zh" } });
    await prisma.user.update({
      where: { id: user!.id },
      data: {
        createdAt: yesterday,
        targetLanguageId: lang?.id,
      },
    });

    const words = await prisma.word.findMany({
      where: { wordList: { languageId: lang!.id } },
      take: 5,
    });
    if (words.length > 0) {
      await prisma.userProgress.createMany({
        data: words.map((w) => ({
          userId: user.id,
          wordId: w.id,
          state: "REVIEW",
          dueAt: yesterday,
        })),
      });
    }

    // 3. Sign in as returning guest
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // 4. Zeigarnik Effect Check: Dashboard, stats, and heading ARE VISIBLE (not blocked on load)
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

    // 5. Intercept Check: Click "Start studying"
    await page.getByRole("button", { name: /start studying/i }).click();

    // 6. Verify Day-2 Soft Wall Modal slides up
    await expect(page.getByText(/welcome back! your day-2 reviews are due/i)).toBeVisible();
    await expect(page.getByText(/create your free account in 5 seconds to unlock your queue/i)).toBeVisible();
  });
});
