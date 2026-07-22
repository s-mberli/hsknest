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

test.describe("Guest-to-Paid Critical Path", () => {
  test.describe.configure({ mode: "serial" });

  test("Guest completes session → hits cap → upgrades → initiates checkout", async ({ page }) => {
    // 1. Create guest user with 1 seeded review card
    const { email, password, suffix } = await createTestGuestUser();

    // 2. Sign in as guest
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);

    const loginRes = page.waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"));
    await page.getByRole("button", { name: /sign in/i }).click();
    await loginRes;
    // The login form does a client-side redirect to /dashboard after sign-in;
    // wait for it to settle before navigating away, or the next goto races
    // it and gets aborted.
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // 3. Navigate to study screen
    await page.goto("/study");

    // 4. Grade card until session completes
    await expect(page.getByText(/tap to reveal|forgot|knew|easy|hard|got it/i).first()).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 8; i++) {
      if (await page.getByText(/session complete|practice done/i).isVisible()) break;
      await page.keyboard.press("Space");
      await page.waitForTimeout(150);
      await page.keyboard.press("Space");
      await page.waitForTimeout(150);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(700);
    }

    // 5. Verify Single-Session Cap UX on Session Complete Screen
    await expect(page.getByText(/session complete|practice done/i)).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /save progress & continue free/i })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /keep practicing/i })).not.toBeVisible();

    // 6. Upgrade account from modal
    await page.getByRole("button", { name: /save progress & continue free/i }).click();
    const realEmail = `upgraded-${suffix}@e2e.local`;
    await expect(page.locator("#upgrade-email-modal")).toBeVisible({ timeout: 10_000 });
    await page.locator("#upgrade-email-modal").fill(realEmail);
    await page.locator("#upgrade-password-modal").fill("upgraded-password");
    await page.getByRole("button", { name: /create my account/i }).click();

    // 7. Mock Stripe Checkout to prevent external API calls
    await page.route("**/api/billing/checkout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "https://mocked-stripe-checkout.local/success" }),
      });
    });

    // 8. Navigate to Settings and initiate checkout
    await page.goto("/settings");
    const checkoutBtn = page.getByRole("button", { name: /upgrade|subscribe|yearly/i });
    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
    }
  });
});
