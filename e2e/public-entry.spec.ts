import { expect, test } from "playwright/test";

test.describe("Public entry and trust claims", () => {
  test("homepage explains HSK Nest and exposes a useful Mandarin demo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "HSK Nest" })
    ).toBeVisible();
    await expect(page.getByText(/mandarin vocabulary practice/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Try without signing up" }).first()
    ).toBeVisible();
    await expect(page.getByText("是").first()).toBeVisible();
    await expect(page.getByText("3,000 example sentences").first()).toBeVisible();
    await expect(page.getByText(/pronunciation audio/i).first()).toBeVisible();

    await expect(page.getByText(/3,000\+/i)).toHaveCount(0);
    await expect(page.getByText(/native audio/i)).toHaveCount(0);
  });

  test("guest entry recovers from a thrown request and restores the CTA", async ({ page }) => {
    await page.route("**/api/auth/guest", (route) => route.abort("failed"));
    await page.goto("/");

    const cta = page
      .getByRole("button", { name: "Try without signing up" })
      .first();
    await cta.click();

    await expect(
      page.getByText(/could not start.*connection|check your connection/i)
    ).toBeVisible();
    await expect(cta).toBeEnabled();
    await expect(cta).toHaveText("Try without signing up");
  });

  test("public metadata, sitemap, and FAQ point to the product", async ({ page, request }) => {
    await page.goto("/");

    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /Mandarin vocabulary practice/i
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      /Mandarin vocabulary practice/i
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /opengraph-image/
    );

    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toContain("/pricing");

    await page.goto("/pricing");
    await expect(page.getByRole("link", { name: /FAQ on the homepage/i })).toHaveAttribute(
      "href",
      "/#faq"
    );
    await page.goto("/#faq");
    await expect(page.getByRole("heading", { name: "Questions, answered" })).toBeVisible();
  });

  test("privacy and terms describe observable storage, export, and pricing facts", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("main, body")).toContainText(/hashed password/i);
    await expect(page.locator("main, body")).toContainText(/guestId.*cookie|attribution.*cookie/i);
    await expect(page.locator("main, body")).toContainText(/local storage/i);
    await expect(page.locator("main, body")).toContainText(/vocabulary and progress-summary CSV/i);
    await expect(page.locator("main, body")).not.toContainText(/encrypted password|cookie banner|full study data/i);

    await page.goto("/terms");
    await expect(page.locator("main, body")).toContainText("€10 per month or €99 per year");
    await expect(page.locator("main, body")).not.toContainText("**€10");
  });
});
