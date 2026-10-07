import { expect, test } from "playwright/test";

type TrackedEvent = { name: string; props?: Record<string, string> };

test.describe("homepage tour teaser", () => {
  test("defers media, keeps its frame stable, and supports keyboard playback activation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      // Exercise the browser's rejected-play fallback without pretending a
      // nonexistent approved file decoded or played.
      const prototype = HTMLMediaElement.prototype;
      prototype.play = function () {
        const w = window as typeof window & { __playCalls?: number };
        w.__playCalls = (w.__playCalls ?? 0) + 1;
        return Promise.reject(new DOMException("No test media installed", "NotSupportedError"));
      };
    });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Six ways to make Chinese words stick." })).toBeVisible();
    const play = page.getByRole("button", { name: "Watch the 20-second tour" });
    const video = page.locator('section[aria-labelledby="landing-teaser-title"] video');
    await expect(play).toBeVisible();
    await expect(video).toHaveCount(1);
    await expect(video).not.toHaveAttribute("src", /.+/);
    const initialBox = await video.boundingBox();
    expect(initialBox).not.toBeNull();

    await play.focus();
    await expect(play).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(video).toHaveAttribute("src", "/media/hsknest-tour.mp4");
    await expect(video.locator("track[kind='captions']")).toHaveAttribute("src", "/media/hsknest-tour.vtt");
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.controls)).toBe(true);
    await expect(page.getByText(/The tour could not be played/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try without signing up" }).last()).toBeVisible();
    expect(await video.boundingBox()).toMatchObject({ width: initialBox!.width, height: initialBox!.height });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __playCalls?: number }).__playCalls ?? 0)).toBeGreaterThan(1);
    await expect(page.getByText(/The tour could not be played/i)).toBeVisible();
  });

  test("reports deduplicated playback events and CTA intent through the optional analytics hook", async ({ page }) => {
    const tracked: TrackedEvent[] = [];
    await page.addInitScript(() => {
      const w = window as typeof window & { __teaserTracked: TrackedEvent[]; umami: { track: (name: string, props?: Record<string, string>) => void } };
      w.__teaserTracked = [];
      w.umami = { track: (name, props) => w.__teaserTracked.push({ name, props }) };
    });
    await page.route("**/api/auth/guest", (route) => route.abort("failed"));
    await page.route("**/media/hsknest-tour.mp4", (route) => route.abort("failed"));
    await page.goto("/");
    const video = page.locator('section[aria-labelledby="landing-teaser-title"] video');
    await page.getByRole("button", { name: "Watch the 20-second tour" }).click();
    await expect(video).toHaveAttribute("src", "/media/hsknest-tour.mp4");

    // Synthetic media events here isolate event wiring and deduplication. The
    // separate real-asset test below verifies native decoding and playback.
    await video.evaluate((element) => {
      element.dispatchEvent(new Event("play")); // play intent alone must not count as playback.
    });
    expect(await page.evaluate(() => (window as typeof window & { __teaserTracked: TrackedEvent[] }).__teaserTracked)).toEqual([]);
    await video.evaluate((element) => {
      element.dispatchEvent(new Event("playing"));
      element.dispatchEvent(new Event("playing"));
      element.dispatchEvent(new Event("ended"));
      element.dispatchEvent(new Event("ended"));
    });
    await page.locator('section[aria-labelledby="landing-teaser-title"]')
      .getByRole("button", { name: "Try without signing up" }).click();
    await expect.poll(async () => page.evaluate(() => (window as typeof window & { __teaserTracked: TrackedEvent[] }).__teaserTracked.map(({ name }) => name))).toEqual([
      "promo_play",
      "promo_complete",
      "promo_try_click",
    ]);
    tracked.push(...(await page.evaluate(() => (window as typeof window & { __teaserTracked: TrackedEvent[] }).__teaserTracked)));
    expect(tracked.map(({ name }) => name)).toEqual(["promo_play", "promo_complete", "promo_try_click"]);
  });

  test("loads and plays the approved assets with native controls, captions, and byte-range delivery", async ({ page, request }) => {
    const mediaRequests: string[] = [];
    await page.addInitScript(() => {
      const w = window as typeof window & { __teaserTracked: string[]; umami: { track: (name: string) => void } };
      w.__teaserTracked = [];
      w.umami = { track: (name) => w.__teaserTracked.push(name) };
    });
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/media/hsknest-tour.mp4") mediaRequests.push(req.url());
    });

    const posterResponse = await request.get("/media/hsknest-tour-poster.webp");
    expect(posterResponse.status()).toBe(200);
    expect(posterResponse.headers()["content-type"]).toMatch(/^image\/webp/);
    expect((await posterResponse.body()).byteLength).toBeGreaterThan(0);

    const rangeResponse = await request.get("/media/hsknest-tour.mp4", {
      headers: { Range: "bytes=0-1023" },
    });
    expect(rangeResponse.status()).toBe(206);
    expect(rangeResponse.headers()["content-type"]).toMatch(/^video\/mp4/);
    expect(rangeResponse.headers()["content-range"]).toMatch(/^bytes 0-1023\//);
    expect((await rangeResponse.body()).byteLength).toBe(1024);

    await page.goto("/");
    const video = page.locator('section[aria-labelledby="landing-teaser-title"] video');
    await expect(video).not.toHaveAttribute("src", /.+/);
    expect(mediaRequests).toHaveLength(0);

    await page.getByRole("button", { name: "Watch the 20-second tour" }).click();
    await expect(video).toHaveAttribute("src", "/media/hsknest-tour.mp4");
    await expect.poll(() => mediaRequests.length).toBeGreaterThan(0);
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThan(0);
    await expect.poll(async () => page.evaluate(() => (window as typeof window & { __teaserTracked: string[] }).__teaserTracked)).toContain("promo_play");
    const captionTrack = video.locator("track[kind='captions']");
    await expect(captionTrack).toHaveAttribute("src", "/media/hsknest-tour.vtt");
    await expect.poll(async () => captionTrack.evaluate((track: HTMLTrackElement) => ({
      mode: track.track.mode,
      cueCount: track.track.cues?.length ?? 0,
    }))).toMatchObject({ mode: "showing" });
    const caption = await captionTrack.evaluate((track: HTMLTrackElement) =>
      (track.track.cues?.[0] as VTTCue | undefined)?.text ?? ""
    );
    expect(caption.trim().length).toBeGreaterThan(0);

    await video.evaluate((element: HTMLVideoElement) => element.pause());
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await video.evaluate((element: HTMLVideoElement) => element.play());
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => !element.paused && !element.ended)).toBe(true);
    await video.evaluate((element: HTMLVideoElement) => {
      element.currentTime = Math.max(0, element.duration - 1.25);
    });
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.ended), { timeout: 15_000 }).toBe(true);
    await expect.poll(async () => page.evaluate(() => (window as typeof window & { __teaserTracked: string[] }).__teaserTracked)).toEqual([
      "promo_play",
      "promo_complete",
    ]);
    expect(mediaRequests.length).toBeGreaterThan(0);
    await expect(page.getByText(/The tour could not be played/i)).toHaveCount(0);
  });

  test("fits common viewport widths without horizontal page overflow", async ({ page }) => {
    await page.goto("/");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole("heading", { name: "Six ways to make Chinese words stick." })).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        teaser: document.querySelector('section[aria-labelledby="landing-teaser-title"]')?.getBoundingClientRect().width ?? 0,
      }));
      expect(dimensions.document, `document overflows at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.teaser).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
});
