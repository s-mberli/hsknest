import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { expect, test } from "playwright/test";
import { prisma } from "../src/lib/prisma";

test("list forms and theme recover after failed requests", async ({ page }) => {
  const language = await prisma.language.findFirst({ where: { code: "zh" }, select: { id: true } });
  if (!language) throw new Error("Seeded Chinese language required");
  const email = `e2e-correctness-${randomBytes(6).toString("hex")}@test.local`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hash("test-password-correctness", 12),
      targetLanguageId: language.id,
    },
  });

  try {
    const initialSession = page.waitForResponse(response => response.url().endsWith("/api/auth/session"));
    await page.goto("/login");
    await initialSession;
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("test-password-correctness");
    const authenticated = page.waitForResponse(async response =>
      response.url().endsWith("/api/auth/session") && (await response.json()).user?.email === email
    );
    await page.getByRole("button", { name: /sign in/i }).click();
    await authenticated;
    await page.waitForURL("**/dashboard");

    await page.goto("/lists/new");
    await page.getByLabel("Name").fill("Recovery list");
    await page.route("**/api/lists", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 500, body: "{}" });
      } else {
        await route.continue();
      }
    }, { times: 1 });
    const failedCreate = page.waitForResponse(response =>
      response.url().endsWith("/api/lists") && response.request().method() === "POST" && response.status() === 500
    );
    await page.getByRole("button", { name: "Create list" }).click();
    await failedCreate;
    await expect(page.getByLabel("Name")).toHaveValue("Recovery list");
    await expect(page.getByRole("button", { name: "Create list" })).toBeEnabled();
    const created = page.waitForResponse(response =>
      response.url().endsWith("/api/lists") && response.request().method() === "POST" && response.ok()
    );
    await page.getByRole("button", { name: "Create list" }).click();
    await created;
    await page.waitForURL(url => /^\/lists\/[^/]+$/.test(url.pathname) && url.pathname !== "/lists/new");

    await page.getByRole("button", { name: "Import batch" }).click();
    await page.getByPlaceholder(/你好/).fill("你好\thello");
    await page.route("**/api/lists/*/import", async (route) => {
      await route.fulfill({ status: 200, body: "{}", contentType: "application/json" });
    }, { times: 1 });
    const invalidImport = page.waitForResponse(response =>
      /\/api\/lists\/[^/]+\/import$/.test(response.url()) && response.request().method() === "POST" && response.ok()
    );
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await invalidImport;
    await expect(page.getByPlaceholder(/你好/)).toHaveValue("你好\thello");
    await expect(page.getByRole("button", { name: "Import", exact: true })).toBeEnabled();
    const imported = page.waitForResponse(response =>
      /\/api\/lists\/[^/]+\/import$/.test(response.url()) && response.request().method() === "POST" && response.ok()
    );
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await imported;
    await expect(page.getByRole("cell", { name: "你好", exact: true })).toBeVisible();

    await page.goto("/settings");
    await page.getByRole("tab", { name: "Interface", exact: true }).click();
    const theme = page.getByRole("group", { name: "App theme" });
    const dark = theme.getByRole("button", { name: "Dark" });
    const previous = (await theme.locator('[aria-pressed="true"]').textContent())?.trim();
    const next = previous === "Dark" ? theme.getByRole("button", { name: "Light" }) : dark;
    await page.route("**/api/settings", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({ status: 500, body: "{}" });
      } else {
        await route.continue();
      }
    }, { times: 1 });
    const failedTheme = page.waitForResponse(response =>
      response.url().endsWith("/api/settings") && response.request().method() === "PATCH" && response.status() === 500
    );
    await next.click();
    await failedTheme;
    await expect(theme.getByRole("button", { name: previous! })).toHaveAttribute("aria-pressed", "true");
    await expect(next).toBeEnabled();
    const savedTheme = page.waitForResponse(response =>
      response.url().endsWith("/api/settings") && response.request().method() === "PATCH" && response.ok()
    );
    await next.click();
    await savedTheme;
    await expect(next).toHaveAttribute("aria-pressed", "true");
  } finally {
    await prisma.wordList.deleteMany({ where: { createdById: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
