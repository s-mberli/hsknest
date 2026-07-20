import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * BASE is read once at module load, so each case sets the env then imports a
 * fresh copy of the module via vi.resetModules() + dynamic import.
 */
async function load(base: string | undefined) {
  vi.resetModules();
  if (base === undefined) vi.stubEnv("NEXT_PUBLIC_AUDIO_BASE_URL", "");
  else vi.stubEnv("NEXT_PUBLIC_AUDIO_BASE_URL", base);
  return import("@/lib/audio");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("audioUrl", () => {
  it("returns null when no base URL is configured", async () => {
    const { audioUrl } = await load(undefined);
    expect(await audioUrl("你好", "word", "zh")).toBeNull();
  });

  it("returns null for unsupported languages (fall back to speech)", async () => {
    const { audioUrl } = await load("/audio");
    expect(await audioUrl("hola", "word", "es")).toBeNull();
    expect(await audioUrl("你好", "word", undefined)).toBeNull();
  });

  it("builds the clip path from sha256(text)[:20] — matches the generator", async () => {
    const { audioUrl } = await load("/audio");
    // Hashes computed with Node crypto (sha256, utf8, first 20 hex) — the
    // Python generator (hashlib.sha256(text.encode()).hexdigest()[:20]) MUST
    // produce these same names or clips won't resolve. Do not edit without
    // regenerating audio.
    expect(await audioUrl("你好", "word", "zh")).toBe(
      "/audio/zh/w/670d9743542cae3ea7eb.mp3"
    );
    expect(await audioUrl("的", "word", "zh")).toBe(
      "/audio/zh/w/8af2350cfd65805bd50b.mp3"
    );
    expect(await audioUrl("火！", "sentence", "zh")).toBe(
      "/audio/zh/s/de23a4bf503d602af28a.mp3"
    );
    // German: the article is part of the term ("die Familie") and gets
    // spoken with it — see scripts/generate-audio.py --lang de.
    expect(await audioUrl("die Familie", "word", "de")).toBe(
      "/audio/de/w/5c0c4227776695d86a90.mp3"
    );
  });

  it("accepts region subtags (zh-CN) and strips a trailing slash on the base", async () => {
    const { audioUrl } = await load("https://hsknest.com/audio/");
    expect(await audioUrl("你好", "word", "zh-CN")).toBe(
      "https://hsknest.com/audio/zh/w/670d9743542cae3ea7eb.mp3"
    );
  });
});

describe("audioAvailableFor", () => {
  it("is true for every supported language when a base URL is set", async () => {
    const { audioAvailableFor } = await load("/audio");
    expect(audioAvailableFor("zh")).toBe(true);
    expect(audioAvailableFor("de")).toBe(true);
    expect(audioAvailableFor("de-DE")).toBe(true);
    expect(audioAvailableFor("es")).toBe(false);
    expect(audioAvailableFor(undefined)).toBe(false);
  });

  it("is false for everything when no base URL is configured", async () => {
    const { audioAvailableFor } = await load(undefined);
    expect(audioAvailableFor("zh")).toBe(false);
    expect(audioAvailableFor("de")).toBe(false);
  });
});
