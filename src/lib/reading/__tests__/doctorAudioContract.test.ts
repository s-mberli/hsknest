import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * scripts/doctor.ts (npm run doctor) reports whether Reading Mode story
 * audio is playable. The issue that motivated this script explicitly warns
 * against reimplementing that check: a prior version of the app had ingest
 * decide audio availability by stat-ing a path that diverged from the one
 * Next actually serves from, which silently broke audio forever for anyone
 * who hit it (see docs/adr/0001-audio-availability-is-derived.md).
 *
 * scripts/ isn't part of vitest's `src/**` include pattern (it's tsx-run
 * CLI tooling, not app code), so this is a static source check rather than
 * an import-and-call test — cheap, and it fails loudly the moment someone
 * "simplifies" the doctor by inlining its own path.join/fs.existsSync
 * instead of calling the shared resolver.
 */
describe("scripts/doctor.ts audio-resolution contract", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../../../scripts/doctor.ts"), "utf8");

  it("imports the canonical story-audio resolver instead of reimplementing it", () => {
    expect(source).toMatch(/import\s*\{[^}]*\bresolveStoryAudio\b[^}]*\}\s*from\s*["']\.\.\/src\/lib\/reading\/storyAudio["']/);
  });

  it("uses resolveStoryAudio to determine per-story playability, not a raw fs check", () => {
    // The story-audio loop must call resolveStoryAudio(...) — not
    // fs.existsSync/path.join against a hand-rolled "zh/r" path, which is
    // exactly the divergence that caused the original outage.
    expect(source).toMatch(/resolveStoryAudio\(/);
  });
});
