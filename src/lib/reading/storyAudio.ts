/**
 * Resolves Reading Mode story narration from the filesystem at read time.
 *
 * THE RULE (see docs/adr/0001-audio-availability-is-derived.md): the artifact
 * on disk is the availability signal. No DB row ever asserts that a file
 * exists. This mirrors the philosophy `src/lib/audio.ts` documents for
 * word/sentence clips ("no DB column... survives DB reseeds... nothing breaks
 * without the audio volume") — story audio previously deviated from it with a
 * `ReadingAudio` table, and that deviation caused a production outage: the
 * ingest script decided whether to write the row by stat-ing a directory that
 * only exists on a maintainer's machine, so a self-hoster who placed the files
 * correctly still got no player, forever, with no error anywhere.
 *
 * Deriving at render time also kills the mirror bug that table allowed:
 * delete an mp3 and the row would persist, rendering a play button over a 404.
 * Here, "can we render a player" and "does the file exist" are the same
 * question asked at the same instant.
 *
 * Server-only: imports node:fs, so it cannot be pulled into a client bundle.
 * (The repo has no `server-only` package; `src/lib/reading/cedict.ts` relies
 * on the same property.)
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * The directory Next actually serves story audio from — `public/` is static,
 * and in Docker this path is the mounted `recall-audio` volume. Exported so
 * that scripts (ingest, doctor) consume the same constant instead of keeping
 * their own copy, which is exactly how the directories drifted apart before.
 */
export const STORY_AUDIO_DIR = path.join(process.cwd(), "public", "audio", "zh", "r");

/** Path relative to NEXT_PUBLIC_AUDIO_BASE_URL, e.g. "zh/r/hsk1-dumplings.mp3". */
export const storyAudioRel = (slug: string): string => `zh/r/${slug}.mp3`;

/** Sidecar emitted by scripts/generate-story-audio.py next to each mp3. */
export interface StoryTimings {
  v: number;
  voice: string;
  durationMs: number;
  /** Char span (s,e) into the story body ↔ millisecond span (t0,t1). */
  marks: { s: number; e: number; t0: number; t1: number }[];
  /**
   * Hash of the story body the marks were generated against. Optional: files
   * generated before this field existed are treated as matching, so adding it
   * never retroactively disables karaoke for audio someone already has.
   */
  textHash?: string;
}

export interface StoryAudio {
  /** Relative URL for the mp3 (join with NEXT_PUBLIC_AUDIO_BASE_URL). */
  audioUrl: string;
  timings: StoryTimings;
}

/** SHA-256 of `text`, first 20 hex chars — same convention as src/lib/audio.ts. */
export function hashStoryText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 20);
}

/**
 * True when `timings` was generated against `body`. Timings without a
 * `textHash` are assumed current (see StoryTimings.textHash).
 */
export function timingsMatchText(timings: StoryTimings, body: string): boolean {
  return !timings.textHash || timings.textHash === hashStoryText(body);
}

// Memo so a page render doesn't stat+parse per request. Short TTL rather than a
// boot-built manifest on purpose: a manifest would reintroduce the staleness
// this module exists to remove (an operator dropping an mp3 onto the volume
// would need a container restart to see it). Negative results are cached too —
// the common self-host path is "no audio volume at all", which should not cost
// a stat per render.
const CACHE_TTL_MS = process.env.NODE_ENV === "production" ? 60_000 : 0;
const cache = new Map<string, { at: number; value: StoryAudio | null }>();

/** Drop memoized lookups — for tests and for scripts that write audio files. */
export function clearStoryAudioCache(): void {
  cache.clear();
}

/**
 * Narration for `slug`, or null when it isn't fully present. Requires BOTH the
 * mp3 and a parseable timings sidecar: half a pair is not playable, and
 * returning it would resurrect the 404-play-button bug.
 */
export function resolveStoryAudio(slug: string): StoryAudio | null {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const value = readStoryAudio(slug);
  cache.set(slug, { at: Date.now(), value });
  return value;
}

function readStoryAudio(slug: string): StoryAudio | null {
  const mp3 = path.join(STORY_AUDIO_DIR, `${slug}.mp3`);
  const timingsFile = path.join(STORY_AUDIO_DIR, `${slug}.timings.json`);
  try {
    if (!fs.existsSync(mp3) || !fs.existsSync(timingsFile)) return null;
    const timings = JSON.parse(fs.readFileSync(timingsFile, "utf-8")) as StoryTimings;
    // A sidecar without marks can't drive karaoke and probably means a
    // truncated copy — treat it as absent rather than rendering a dead player.
    if (!Array.isArray(timings?.marks)) return null;
    return { audioUrl: storyAudioRel(slug), timings };
  } catch {
    // Malformed JSON, permissions, a partially-copied file: all mean "no
    // usable audio". Never throw — audio is optional and must not break the
    // reader for someone who simply hasn't installed it.
    return null;
  }
}
