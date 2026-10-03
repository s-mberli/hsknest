import { expect, test, type Page } from "playwright/test";

async function openReader(page: Page) {
  await page.goto("/reading");
  const storyHref = await page.locator("h2 + div a[href*='/reading/']").first().getAttribute("href");
  if (!storyHref) throw new Error("Seeded reading story required");
  await page.goto(storyHref);
  await expect(page.getByRole("link", { name: /read & listen/i })).toBeVisible({ timeout: 15_000 });
  const readHref = await page.getByRole("link", { name: /read & listen/i }).getAttribute("href");
  if (!readHref) throw new Error("Reader link required");
  await page.goto(readHref);
  await page.waitForURL(/\/reading\/[^/]+\/read\/?$/);
  await expect(page.locator("[data-sentence]").first()).toBeVisible({ timeout: 15_000 });
}

test("reader scroll progress, adaptive hints, and toolbar preferences", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 360, height: 400 });
  const email = `e2e-reader-correctness-${Date.now()}@example.com`;
  const initialSession = page.waitForResponse(response => response.url().endsWith("/api/auth/session"));
  await page.goto("/signup");
  await initialSession;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-test-password");
  const authenticated = page.waitForResponse(async response =>
    response.url().endsWith("/api/auth/session") && (await response.json()).user?.email === email
  );
  await page.getByRole("button", { name: "Create account" }).click();
  await authenticated;
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Start studying" }).click();
  await page.waitForURL("**/study**");
  const progressPosts: Array<{ position: number; completed: boolean }> = [];
  page.on("request", request => {
    if (request.url().endsWith("/api/reading/progress") && request.method() === "POST") {
      progressPosts.push(request.postDataJSON());
    }
  });
  await openReader(page);

  const scroller = page.getByTestId("reading-scroll");
  await expect.poll(() => scroller.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  expect(await scroller.evaluate(el => el.scrollTop)).toBe(0);
  await page.waitForTimeout(2300);
  expect(progressPosts.some(post => post.completed)).toBe(false);

  const leaveSaved = page.waitForResponse(response => {
    if (!response.url().endsWith("/api/reading/progress") || response.request().method() !== "POST" || !response.ok()) return false;
    const post = response.request().postDataJSON() as { position: number; completed: boolean };
    return post.position >= 20 && post.position <= 30 && !post.completed;
  });
  await scroller.evaluate(async el => {
    await new Promise<void>(resolve => {
      el.addEventListener("scroll", () => resolve(), { once: true });
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 4;
    });
  });
  await page.getByRole("link", { name: "Back" }).click();
  await leaveSaved;
  await page.waitForURL(/\/reading\/[^/]+\/?$/);
  await page.getByRole("link", { name: /read & listen/i }).click();
  await page.waitForURL(/\/reading\/[^/]+\/read\/?$/);
  await expect(page.locator("[data-sentence]").first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => scroller.evaluate(el => el.scrollTop / (el.scrollHeight - el.clientHeight))).toBeGreaterThan(0.2);

  const halfwaySaved = page.waitForResponse(response => response.url().endsWith("/api/reading/progress") && response.request().method() === "POST" && response.ok());
  await scroller.evaluate(el => { el.scrollTop = (el.scrollHeight - el.clientHeight) / 2; });
  await halfwaySaved;
  expect(progressPosts.some(post => post.position >= 40 && post.position <= 60)).toBe(true);
  await page.reload();
  await expect.poll(() => scroller.evaluate(el => el.scrollTop / (el.scrollHeight - el.clientHeight))).toBeGreaterThan(0.35);

  await page.getByRole("button", { name: "Increase text size" }).click();
  await page.getByRole("button", { name: "Increase text size" }).click();
  await page.getByRole("button", { name: "Pinyin" }).click();
  await page.getByRole("button", { name: "Reading settings" }).click();
  await page.getByRole("button", { name: "Always show sentence translations" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "汉字" })).toBeVisible();
  await expect(page.locator("[data-sentence]").first().locator("..")).toHaveCSS("font-size", "39px");
  await page.getByRole("button", { name: "Reading settings" }).click();
  await expect(page.getByRole("button", { name: "Always show sentence translations" })).toContainText("Always show sentence translations");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hn-reader-prefs") ?? "{}").showTranslations)).toBe(false);

  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "汉字" }).click();
  const token = page.locator("[data-sentence] span[role='button']").filter({ has: page.locator("ruby rt") }).first();
  const lemma = await token.locator("ruby").evaluate(el => el.firstChild?.textContent ?? "");
  await page.route("**/api/reading/known-words", route => route.fulfill({ json: { known: [{ lemma, strength: "shaky", learned: false }] } }));
  await page.reload();
  await expect(page.locator("[data-sentence] span[role='button'] ruby").filter({ hasText: lemma }).first()).toBeVisible();
  await page.route("**/api/reading/known-words", route => route.fulfill({ json: { known: [{ lemma, strength: "growing", learned: true }] } }));
  await page.reload();
  await expect(page.locator("[data-sentence]").first()).toBeVisible();
  await expect(page.locator("[data-sentence] span[role='button']").filter({ hasText: lemma }).first().locator("ruby")).toHaveCount(0);

  await page.route("**/api/reading/known-words", route => route.fulfill({ json: { known: [] } }));
  await page.reload();
  const unfamiliar = page.locator("[data-sentence] span[role='button'] ruby").first();
  const unfamiliarTerm = await unfamiliar.evaluate(el => el.firstChild?.textContent ?? "");
  await unfamiliar.click();
  await expect(page.getByRole("button", { name: "Add to vocabulary", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to vocabulary", exact: true }).click();
  await expect(page.getByText("Added ✓", { exact: true })).toBeVisible();
  await expect(page.locator("[data-sentence] span[role='button'] ruby").filter({ hasText: unfamiliarTerm }).first()).toBeVisible();

  progressPosts.length = 0;
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(() => progressPosts.filter(post => post.completed).length).toBe(1);
  const bounds = await page.evaluate(() => ({
    lastLine: document.querySelector("[data-sentence]:last-child")?.getBoundingClientRect().bottom,
    readingBottom: document.querySelector("[data-testid='reading-scroll']")?.getBoundingClientRect().bottom,
  }));
  expect(bounds.lastLine).toBeLessThanOrEqual(bounds.readingBottom!);
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight / 2; });
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(2300);
  expect(progressPosts.filter(post => post.completed)).toHaveLength(1);
});
