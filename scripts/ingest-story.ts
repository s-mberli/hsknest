/**
 * Ingest Reading Mode stories into the database.
 *
 * Accepts only `status: approved` stories (the human-review gate) unless
 * `--force` is passed (dev drafts). For each story: hydrate (segment +
 * annotate + CEDICT senses), grade against the target level, then upsert
 * ReadingText and rebuild the ReadingTextWord index. Narration is NOT
 * registered here — audio availability is derived from the filesystem at read
 * time (src/lib/reading/storyAudio.ts); this script only reports what it sees.
 *
 * Idempotent — re-run after edits; everything is rebuilt from the file.
 *
 * Usage:
 *   npx tsx scripts/ingest-story.ts content/reading/hsk1/coffee-shop.md
 *   npx tsx scripts/ingest-story.ts --all
 *   npx tsx scripts/ingest-story.ts --all --force   # allow status: draft
 */

import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { loadCedict } from "../src/lib/reading/cedict";
import { hydrateText } from "../src/lib/reading/hydrate";
import { loadHskLexicon } from "../src/lib/reading/lexicon";
import { clearStoryAudioCache, resolveStoryAudio, timingsMatchText } from "../src/lib/reading/storyAudio";
import type { StoryToken } from "../src/lib/reading/types";
import { parseStory, slugFor } from "./reading-md";

// Audio presence is resolved by the SAME function the reader uses at render
// time (src/lib/reading/storyAudio.ts) rather than a second copy of the path
// logic here. A divergent copy is exactly what caused the outage this
// replaces: this script stat-ed audio-out/ while the app served from
// public/audio/, so audio could be correctly installed and still never appear.
// This script no longer writes a ReadingAudio row — availability is derived
// from the filesystem, never stored. It only REPORTS what it sees, which is
// genuinely useful operator feedback and now reports the same truth the
// reader will render.

function wordIndex(tokens: StoryToken[]): { lemma: string; level: number | null; position: number }[] {
  const seen = new Map<string, { lemma: string; level: number | null; position: number }>();
  for (const t of tokens) {
    if (t.isPunct) continue;
    if (!seen.has(t.w)) seen.set(t.w, { lemma: t.w, level: t.lvl, position: seen.size });
  }
  return [...seen.values()];
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const files = args.filter((a) => !a.startsWith("--"));
  const all = args.includes("--all") || files.length === 0;

  const targets: string[] = all
    ? (() => {
        const dir = path.join(process.cwd(), "content", "reading");
        const out: string[] = [];
        const walk = (d: string) => {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith(".md")) out.push(p);
          }
        };
        walk(dir);
        return out;
      })()
    : files;

  if (targets.length === 0) {
    console.log("no story files found under content/reading/");
    return 1;
  }

  const lexicon = loadHskLexicon();
  const cedict = loadCedict();
  const zh = await prisma.language.findUnique({ where: { code: "zh" } });
  if (!zh) {
    console.error('language "zh" not found — run npm run db:seed first');
    return 1;
  }

  let ingested = 0;
  for (const file of targets) {
    const story = parseStory(file);
    const slug = slugFor(story);
    const fm = story.frontmatter;
    const status = (fm.status as string) ?? "draft";
    const level = Number(fm.level);

    if (!Number.isInteger(level) || level < 1) {
      console.log(`${slug}: skip — invalid level "${fm.level}"`);
      continue;
    }
    if (status !== "approved" && !force) {
      console.log(`${slug}: skip — status "${status}" (use --force for drafts)`);
      continue;
    }

    const { hydrated, report } = hydrateText(story.body, lexicon, cedict, level, fm.sentencesEn as string[] | undefined);

    const row = await prisma.readingText.upsert({
      where: { languageId_slug: { languageId: zh.id, slug } },
      create: {
        languageId: zh.id,
        slug,
        title: (fm.title as string) ?? slug,
        titleEn: (fm.titleEn as string) ?? null,
        level,
        topic: (fm.topic as string) ?? null,
        topicEn: (fm.topicEn as string) ?? null,
        bodyRaw: story.body,
        bodyHydrated: hydrated as unknown as object,
        gradeReport: report as unknown as object,
        source: (fm.source as string) ?? "original",
        license: (fm.license as string) || null,
        attribution: (fm.attribution as string) || null,
        status: "published",
        estimatedMin: report.estimatedMin,
      },
      update: {
        title: (fm.title as string) ?? slug,
        titleEn: (fm.titleEn as string) ?? null,
        level,
        topic: (fm.topic as string) ?? null,
        topicEn: (fm.topicEn as string) ?? null,
        bodyRaw: story.body,
        bodyHydrated: hydrated as unknown as object,
        gradeReport: report as unknown as object,
        source: (fm.source as string) ?? "original",
        license: (fm.license as string) || null,
        attribution: (fm.attribution as string) || null,
        status: "published",
        estimatedMin: report.estimatedMin,
      },
    });

    await prisma.readingTextWord.deleteMany({ where: { textId: row.id } });
    await prisma.readingTextWord.createMany({
      data: wordIndex(hydrated.tokens).map((w) => ({ ...w, textId: row.id })),
    });

    // Report only — no row is written. The story just changed on disk, so
    // drop any memoized lookup before asking (this process may have resolved
    // the same slug earlier in the run).
    clearStoryAudioCache();
    const audio = resolveStoryAudio(slug);
    const audioNote = !audio
      ? ", no audio yet"
      : timingsMatchText(audio.timings, story.body)
        ? `, audio ✓ (${audio.timings.voice})`
        : ", audio ⚠ stale (timings predate current text — narration plays, word highlighting off)";

    console.log(
      `${slug}: ${report.verdict.toUpperCase()} above ${(report.aboveLevelPct * 100).toFixed(1)}%` +
        `, ${hydrated.words.unique} unique words${audioNote}`
    );
    ingested++;
  }

  console.log(`\n${ingested} story(ies) ingested.`);
  await prisma.$disconnect();
  return 0;
}

main().then((code) => { process.exitCode = code; });
