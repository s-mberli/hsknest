#!/usr/bin/env node
/**
 * add-story — create a story .md file from Gemini output or structured input.
 *
 * Usage:
 *   npx tsx scripts/add-story.ts --level 1 --slug my-story --title "我的故事" --title-en "My Story" --topic "日常" --topic-en "Daily Life"
 *   (then paste the paired CN|||EN lines, end with EOF)
 *
 * Input format: one sentence per line, Chinese ||| English
 *   我的家人有五个人。||| My family has five people.
 *   爸爸是老师。||| Dad is a teacher.
 *
 * The script writes content/reading/hsk<N>/<slug>.md with correct frontmatter.
 * Then run verify → audio → ingest.
 */

import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(process.cwd());
const CONTENT = path.join(REPO, "content", "reading");

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    if (key) out[key] = args[i + 1] ?? "";
  }
  return out;
}

async function main() {
  const a = parseArgs();
  const level = parseInt(a.level || "1", 10);
  const slug = a.slug || `hsk${level}-new-${Date.now()}`;
  const title = a.title || slug;
  const titleEn = a["title-en"] || "";
  const topic = a.topic || "";
  const topicEn = a["topic-en"] || "";

  if (!a.level || !a.slug) {
    console.error("Required: --level N --slug SLUG [--title T] [--title-en T] [--topic T] [--topic-en T]");
    process.exit(1);
  }

  // Read paired lines from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = Buffer.concat(chunks).toString("utf-8").trim();

  if (!input) {
    console.error("No input. Pipe CN|||EN lines to stdin (end with Ctrl+D / EOF).");
    process.exit(1);
  }

  const cnSentences: string[] = [];
  const enSentences: string[] = [];

  for (const line of input.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("|||");
    if (parts.length < 2) {
      console.warn(`Skipping line (no ||| separator): ${trimmed}`);
      continue;
    }
    cnSentences.push(parts[0].trim());
    enSentences.push(parts[1].trim());
  }

  if (cnSentences.length === 0) {
    console.error("No valid CN|||EN lines found.");
    process.exit(1);
  }

  // Build frontmatter
  const fm: string[] = [
    "---",
    `title: ${title}`,
    `titleEn: "${titleEn}"`,
    `level: ${level}`,
    `topic: "${topic}"`,
    `topicEn: "${topicEn}"`,
    "status: draft",
    "sentencesEn:",
  ];
  for (const en of enSentences) fm.push(`  - "${en}"`);
  fm.push("---");

  // Build body (sentences separated by blank lines for paragraph grouping)
  const body = cnSentences.join("\n\n");

  const dir = path.join(CONTENT, `hsk${level}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug}.md`);
  fs.writeFileSync(file, [...fm, "", body, ""].join("\n"), "utf-8");

  console.log(`Written: ${file}`);
  console.log(`Sentences: ${cnSentences.length}`);
  console.log(`Next steps:`);
  console.log(`  npx tsx scripts/verify-story.ts ${file}`);
  console.log(`  python scripts/generate-story-audio.py`);
  console.log(`  npx tsx scripts/ingest-story.ts ${file} --force`);
}

main().catch((e) => { console.error(e); process.exit(1); });
