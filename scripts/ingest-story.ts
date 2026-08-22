/**
 * Ingest Reading Mode stories into the database.
 *
 * Accepts only `status: approved` stories (the human-review gate) unless
 * `--force` is passed (dev drafts). For each story: hydrate (segment +
 * annotate + CEDICT senses), grade against the target level, then upsert
 * ReadingText, rebuild the ReadingTextWord index, and register pre-generated
 * audio when the MP3 + timings files exist (scripts/generate-story-audio.py).
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
import type { StoryToken } from "../src/lib/reading/types";
import { parseStory, slugFor } from "./reading-md";

interface Timings {
  durationMs: number;
  voice: string;
}

// Checks the SERVING location (public/audio), not audio-out (generation
// scratch space that lives only on whoever's machine ran
// generate-story-audio.py). audio-out is never shipped in the Docker image
// and never mounted as a volume — public/audio is (see docs/AUDIO.md's
// `docker cp .../public/audio` step) — so checking audio-out here meant
// this auto-detection could never fire for a Docker deployment even when a
// self-hoster followed the documented process to the letter: files would
// sit correctly under public/audio/zh/r, and every boot's ingest would
// still report "no audio yet" forever, because it was looking in a
// directory that only ever exists on a dev machine mid-generation.
function findAudio(slug: string): { mp3: string; timings: Timings } | null {
  const dir = path.join(process.cwd(), "public", "audio", "zh", "r");
  const mp3 = path.join(dir, `${slug}.mp3`);
  const timingsFile = path.join(dir, `${slug}.timings.json`);
  if (!fs.existsSync(mp3) || !fs.existsSync(timingsFile)) return null;
  return { mp3, timings: JSON.parse(fs.readFileSync(timingsFile, "utf-8")) as Timings };
}

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

    const audio = findAudio(slug);
    if (audio) {
      const rel = (name: string) => `zh/r/${name}`;
      await prisma.readingAudio.upsert({
        where: { textId: row.id },
        create: {
          textId: row.id,
          voice: audio.timings.voice,
          audioUrl: rel(`${slug}.mp3`),
          timingsUrl: rel(`${slug}.timings.json`),
          durationMs: Math.round(audio.timings.durationMs),
        },
        update: {
          voice: audio.timings.voice,
          audioUrl: rel(`${slug}.mp3`),
          timingsUrl: rel(`${slug}.timings.json`),
          durationMs: Math.round(audio.timings.durationMs),
        },
      });
    }

    console.log(
      `${slug}: ${report.verdict.toUpperCase()} above ${(report.aboveLevelPct * 100).toFixed(1)}%` +
        `, ${hydrated.words.unique} unique words${audio ? ", audio ✓" : ", no audio yet"}`
    );
    ingested++;
  }

  console.log(`\n${ingested} story(ies) ingested.`);
  await prisma.$disconnect();
  return 0;
}

main().then((code) => { process.exitCode = code; });
