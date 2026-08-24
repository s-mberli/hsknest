import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearStoryAudioCache,
  hashStoryText,
  resolveStoryAudio,
  STORY_AUDIO_DIR,
  storyAudioRel,
  timingsMatchText,
} from "../storyAudio";

/**
 * Regression guard for the production outage described in storyAudio.ts:
 * ingest looked for narration in `audio-out/` while Next served it from
 * `public/audio/`, so audio could be installed correctly and still never
 * appear — silently, forever.
 *
 * Note what these tests deliberately do NOT do: assert a hardcoded path
 * string. That test would have been written wrong alongside the wrong code.
 * Instead they write a real fixture into STORY_AUDIO_DIR and assert it is
 * reachable at the public URL the browser will request — tying "where we
 * look" to "where Next serves from", which is the invariant that broke.
 */

const SLUG = "__test-story-audio__";
const mp3Path = path.join(STORY_AUDIO_DIR, `${SLUG}.mp3`);
const timingsPath = path.join(STORY_AUDIO_DIR, `${SLUG}.timings.json`);
const BODY = "今天我的朋友小李来我家。";

function writeTimings(extra: Record<string, unknown> = {}) {
  fs.writeFileSync(
    timingsPath,
    JSON.stringify({
      v: 1,
      voice: "zh-CN-XiaoxiaoNeural",
      durationMs: 4200,
      marks: [{ s: 0, e: 2, t0: 0, t1: 400 }],
      ...extra,
    })
  );
}

beforeEach(() => {
  fs.mkdirSync(STORY_AUDIO_DIR, { recursive: true });
  clearStoryAudioCache();
});

afterEach(() => {
  fs.rmSync(mp3Path, { force: true });
  fs.rmSync(timingsPath, { force: true });
  clearStoryAudioCache();
});

describe("resolveStoryAudio", () => {
  it("finds audio in the same directory Next serves it from", () => {
    fs.writeFileSync(mp3Path, "fake-mp3");
    writeTimings();

    const audio = resolveStoryAudio(SLUG);
    expect(audio).not.toBeNull();

    // The load-bearing assertion: the URL we hand the browser must resolve to
    // the very file we just found. audioUrl is relative to
    // NEXT_PUBLIC_AUDIO_BASE_URL, which self-hosts set to "/audio" (see
    // docker-compose.yml) — and Next serves "/audio/x" from "public/audio/x".
    // So public/audio + audioUrl is the on-disk file the browser will fetch.
    // If STORY_AUDIO_DIR ever drifts away from the served location again
    // (the original bug pointed it at audio-out/), this fails.
    const served = path.join(process.cwd(), "public", "audio", audio!.audioUrl);
    expect(fs.existsSync(served)).toBe(true);
    expect(path.resolve(served)).toBe(path.resolve(mp3Path));
  });

  it("returns null when the mp3 is missing but timings exist", () => {
    writeTimings();
    expect(resolveStoryAudio(SLUG)).toBeNull();
  });

  it("returns null when timings are missing but the mp3 exists", () => {
    // The mirror of the original bug: the old DB-row design would happily
    // keep asserting audio existed after the file was deleted, rendering a
    // play button over a 404.
    fs.writeFileSync(mp3Path, "fake-mp3");
    expect(resolveStoryAudio(SLUG)).toBeNull();
  });

  it("returns null (never throws) on malformed timings JSON", () => {
    fs.writeFileSync(mp3Path, "fake-mp3");
    fs.writeFileSync(timingsPath, "{ this is not json");
    expect(() => resolveStoryAudio(SLUG)).not.toThrow();
    expect(resolveStoryAudio(SLUG)).toBeNull();
  });

  it("returns null when timings carry no marks array", () => {
    fs.writeFileSync(mp3Path, "fake-mp3");
    fs.writeFileSync(timingsPath, JSON.stringify({ v: 1, voice: "x", durationMs: 1 }));
    expect(resolveStoryAudio(SLUG)).toBeNull();
  });

  it("reflects a deleted file after the cache is cleared", () => {
    fs.writeFileSync(mp3Path, "fake-mp3");
    writeTimings();
    expect(resolveStoryAudio(SLUG)).not.toBeNull();

    fs.rmSync(mp3Path);
    clearStoryAudioCache();
    expect(resolveStoryAudio(SLUG)).toBeNull();
  });

  it("builds a public URL under zh/r", () => {
    expect(storyAudioRel("hsk1-dumplings")).toBe("zh/r/hsk1-dumplings.mp3");
  });
});

describe("timingsMatchText", () => {
  const base = { v: 1, voice: "v", durationMs: 1, marks: [] };

  it("treats timings without a textHash as current", () => {
    // Back-compat: audio generated before textHash existed must keep working,
    // or shipping this feature would silently kill karaoke for everyone who
    // already generated narration.
    expect(timingsMatchText(base, BODY)).toBe(true);
  });

  it("matches when the hash was generated from the same body", () => {
    expect(timingsMatchText({ ...base, textHash: hashStoryText(BODY) }, BODY)).toBe(true);
  });

  it("detects timings generated against an older body", () => {
    expect(timingsMatchText({ ...base, textHash: hashStoryText("different text") }, BODY)).toBe(
      false
    );
  });

  it("hashes to 20 hex chars, matching src/lib/audio.ts's convention", () => {
    expect(hashStoryText(BODY)).toMatch(/^[0-9a-f]{20}$/);
  });

  it("hashes CRLF and LF versions of the same text identically", () => {
    // scripts/generate-story-audio.py computes textHash after reading the
    // file with Python's Path.read_text(), which silently translates CRLF
    // to LF; hashStoryText reads via fs.readFileSync, which does not. On a
    // checkout with CRLF line endings (Windows, or any repo without
    // .gitattributes forcing LF) the two would hash different bytes for
    // byte-identical content — confirmed live: 15 of 17 stories reported
    // "audio stale" immediately after generating their own audio, 0% of the
    // text actually different. hashStoryText must normalize CRLF -> LF so
    // it's invariant to the checkout's line-ending convention.
    const lf = "第一行。\n\n第二行。";
    const crlf = "第一行。\r\n\r\n第二行。";
    expect(hashStoryText(crlf)).toBe(hashStoryText(lf));
  });
});
