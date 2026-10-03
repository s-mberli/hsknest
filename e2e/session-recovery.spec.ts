import { expect, test, type Page } from "playwright/test";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

const cards = [
  { wordId: "target-a", term: "Alpha", translation: "first", phonetic: "alpha", metadata: null, state: "REVIEW", languageCode: "en", sentence: { text: "Alpha is first.", translation: "Alpha is first.", phonetic: null, source: null } },
  { wordId: "target-b", term: "Beta", translation: "second", phonetic: "beta", metadata: null, state: "REVIEW", languageCode: "en", sentence: { text: "Beta is second.", translation: "Beta is second.", phonetic: null, source: null } },
];
const counts = { due: 0, newAllowedToday: 0, checksAllowedToday: 0 };

async function login(page: Page) {
  const email = `session-${randomUUID()}@test.local`;
  const language = await prisma.language.findFirst({ where: { code: "zh" } });
  if (!language) throw new Error("Requires seeded language");
  await prisma.user.create({ data: { email, passwordHash: await hash("session-test-password", 12), targetLanguageId: language.id } });
  await page.addInitScript(() => {
    localStorage.setItem("hsknest-intro-seen", "true");
  });
  const initialSession = page.waitForResponse(response => response.url().endsWith("/api/auth/session"));
  await page.goto("/login");
  await initialSession;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("session-test-password");
  const authenticated = page.waitForResponse(async response => response.url().endsWith("/api/auth/session") && (await response.json()).user?.email === email);
  await page.getByRole("button", { name: /sign in/i }).click();
  await authenticated;
  await page.waitForURL("**/dashboard");
  const intro = page.getByRole("button", { name: "Got it", exact: true });
  if (await intro.isVisible()) await intro.click();
  const cookies = page.getByRole("button", { name: /accept all/i });
  if (await cookies.isVisible()) await cookies.click();
  await page.route("**/api/study/review", (route) => route.fulfill({ json: { ok: true } }));
}

async function complete(page: Page, mode: string, wrong = false) {
  if (mode === "match") {
    await page.getByRole("button", { name: "Alpha", exact: true }).click();
    await page.getByRole("button", { name: "first", exact: true }).click();
    await page.getByRole("button", { name: "Beta", exact: true }).click();
    await page.getByRole("button", { name: "second", exact: true }).click();
  } else if (mode === "quiz" || mode === "pronounce") {
    await page.getByRole("button", { name: wrong ? "wrong" : mode === "quiz" ? "first" : "alpha", exact: true }).click();
    await page.getByText("Beta", { exact: true }).waitFor();
    await page.getByRole("button", { name: mode === "quiz" ? "second" : "beta", exact: true }).click();
  } else if (mode === "sentences") {
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Show translation" }).click();
      await page.getByRole("button", { name: "Good", exact: true }).click();
    }
  } else {
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press("Space");
      await page.keyboard.press("Space");
      await page.getByRole("button", { name: "Good", exact: true }).click();
    }
  }
  await expect(page.getByRole("heading", { name: "Practice done" })).toBeVisible();
}

test("every standalone session restarts cleanly and recovers queue failures", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  let fail: "none" | "network" | "http" | "invalid" = "none";
  await page.route("**/api/study/queue?**", async (route) => {
    if (fail === "network") return route.abort();
    if (fail === "http") return route.fulfill({ status: 500, json: {} });
    if (fail === "invalid") return route.fulfill({ json: { cards: "not a queue" } });
    const query = new URL(route.request().url()).searchParams;
    await route.fulfill({ json: { counts, cards: cards.map((card) => ({ ...card,
      choices: [query.get("choices") === "reading" ? card.phonetic : card.translation, "wrong"],
    })) } });
  });
  for (const mode of ["study", "quiz", "pronounce", "match", "sentences"]) {
    const path = mode === "study" ? "/study" : `/study/${mode}`;
    for (const failure of ["network", "http", "invalid"] as const) {
      fail = failure;
      await page.goto(`${path}?mode=practice&limit=20`);
      await expect(page.getByRole("alert").filter({ hasText: "Could not load your session" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Practice done|Learn a few words first/ })).toHaveCount(0);
      fail = "none";
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(page.getByText(mode === "sentences" ? "Alpha is first." : "Alpha", { exact: true }).first()).toBeVisible();
    }
    await complete(page, mode);
    const firstSession = new URL(page.url()).searchParams.get("session");
    await page.getByRole("button", { name: "Keep practicing", exact: true }).click();
    await page.waitForURL(url => url.searchParams.has("session") && url.searchParams.get("session") !== firstSession);
    await expect(page.getByRole("heading", { name: "Practice done" })).toHaveCount(0);
    await expect(page.getByText(mode === "sentences" ? "Alpha is first." : "Alpha", { exact: true }).first()).toBeVisible();
    await complete(page, mode);
    const secondSession = new URL(page.url()).searchParams.get("session");
    await page.getByRole("button", { name: "Keep practicing", exact: true }).click();
    await page.waitForURL(url => url.searchParams.has("session") && url.searchParams.get("session") !== secondSession);
    await expect(page.getByText(mode === "sentences" ? "Alpha is first." : "Alpha", { exact: true }).first()).toBeVisible();
  }
});

test("missed-word retry preserves scope and sends exact target IDs", async ({ page }) => {
  await login(page);
  await page.route("**/api/study/queue?**", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const selected = query.has("wordIds") ? cards.filter((card) => query.get("wordIds")!.split(",").includes(card.wordId)) : cards;
    await route.fulfill({ json: { counts, cards: selected.map((card) => ({ ...card, choices: [card.translation, "wrong"] })) } });
  });
  await page.goto("/study/quiz?mode=practice&limit=2&listIds=fixture-list");
  await complete(page, "quiz", true);
  const request = page.waitForRequest((request) => request.url().includes("/api/study/queue?") && new URL(request.url()).searchParams.has("wordIds"));
  await page.getByRole("button", { name: "Redo the 1 you missed" }).click();
  const query = new URL((await request).url()).searchParams;
  expect(query.get("wordIds")).toBe("target-a");
  expect(query.get("listIds")).toBe("fixture-list");
  await expect(page.getByText("Alpha", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "first", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Practice done" })).toBeVisible();
  await expect(page.getByText("You reviewed 1 card.", { exact: false })).toBeVisible();
});

test("a partially unavailable Match retry falls back without widening the target set", async ({ page }) => {
  await login(page);
  await page.route("**/api/study/queue?**", route => route.fulfill({ json: { counts, cards: [cards[0]], retryOmitted: 1 } }));
  await page.goto("/study/match?mode=practice&wordIds=target-a,target-b&limit=2");
  await expect(page.getByRole("status").filter({ hasText: "1 retry word is no longer available" })).toBeVisible();
  await expect(page.locator('[data-card-content] [data-term]').first()).toHaveText("Alpha");
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  const review = page.waitForRequest(request => request.url().endsWith("/api/study/review") && request.method() === "POST");
  await page.getByRole("button", { name: "Good", exact: true }).click();
  expect((await review).postDataJSON()).toMatchObject({ wordId: "target-a", practice: true, source: "match" });
  await expect(page.getByRole("heading", { name: "Practice done" })).toBeVisible();
});

test("short flashcards retain their content, report form, and grading controls", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 400 });
  await login(page);
  let reviews = 0;
  await page.route("**/api/study/review", async (route) => {
    reviews++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/study/queue?**", (route) => route.fulfill({ json: {
    counts,
    cards: [{ ...cards[0], translation: "A long definition with enough detail to wrap across several lines on a narrow phone screen.",
      sentence: { ...cards[0].sentence, translation: "An extended example translation that must remain reachable even when a phone keyboard reduces the viewport height." } }],
  } }));
  await page.goto("/study?mode=practice&limit=1");
  await expect(page.locator('[data-card-content] [data-term]').first()).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  const content = page.locator('[data-card-content]').first();
  await content.getByRole("button", { name: "Example sentence" }).scrollIntoViewIfNeeded();
  await content.getByRole("button", { name: "Example sentence" }).click();
  await content.getByText(/An extended example translation/).scrollIntoViewIfNeeded();
  await expect(content.getByText(/An extended example translation/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("short-card.png") });
  await page.getByRole("button", { name: "Report this word" }).click();
  await page.getByRole("textbox").fill("This report should remain reachable.");
  await page.setViewportSize({ width: 360, height: 280 });
  await page.getByRole("button", { name: "Cancel", exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(reviews).toBe(0);
  const good = page.getByRole("button", { name: "Good", exact: true });
  await good.scrollIntoViewIfNeeded();
  await expect(good).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await good.click();
  await expect(page.getByRole("heading", { name: "Practice done" })).toBeVisible();
});

test("the Study term stays vertically centered on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await login(page);
  await page.route("**/api/study/queue?**", (route) => route.fulfill({ json: { counts, cards: [cards[0]] } }));
  await page.goto("/study?mode=practice&limit=1");

  const content = page.locator("[data-card-content]").first();
  const term = content.locator("[data-term]").first();
  await expect(term).toBeVisible();
  const [contentBox, termBox] = await Promise.all([content.boundingBox(), term.boundingBox()]);
  expect(contentBox).not.toBeNull();
  expect(termBox).not.toBeNull();
  const contentCenter = contentBox!.y + contentBox!.height / 2;
  const termCenter = termBox!.y + termBox!.height / 2;
  expect(Math.abs(termCenter - contentCenter)).toBeLessThan(8);
});

test("Ninja prompt and end actions remain reachable on a short viewport", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 400 });
  await login(page);
  await page.route("**/api/study/queue?**", (route) => route.fulfill({ json: { counts, cards } }));
  await page.goto("/study/ninja?mode=practice&limit=2");
  await expect(page.getByRole("link", { name: "Exit session" })).toBeInViewport();
  await expect(page.getByRole("status", { name: /of 5 lives left/ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /first|second/ })).toBeInViewport({ timeout: 10_000 });
  const again = page.getByRole("button", { name: "Play Again", exact: true });
  await expect(again).toBeVisible({ timeout: 60_000 });
  await again.scrollIntoViewIfNeeded();
  await expect(again).toBeInViewport();
  await expect(page.getByRole("link", { name: "Exit", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("ninja-results.png") });
  await again.click();
  await expect(page.getByRole("status", { name: "5 of 5 lives left" })).toBeVisible({ timeout: 15_000 });
});
