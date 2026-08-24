/**
 * Minimal frontmatter parser for Reading Mode story files under
 * content/reading. Controlled format — key: value lines between two
 * `---` markers. Supports simple YAML arrays (sentencesEn: with - items).
 */

import fs from "node:fs";

export interface Story {
  file: string;
  frontmatter: Record<string, string | string[]>;
  body: string;
}

export function parseStory(file: string): Story {
  const raw = fs.readFileSync(file, "utf-8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) {
    throw new Error(`${file}: missing frontmatter block (--- ... ---)`);
  }
  const frontmatter: Record<string, string | string[]> = {};
  const lines = m[1].split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (kv) {
      const key = kv[1];
      const val = kv[2].trim().replace(/^["']|["']$/g, "");
      // Check if next lines are array items (- "...")
      if (val === "" && i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        const arr: string[] = [];
        i++;
        while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
          const item = lines[i].replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, "");
          arr.push(item);
          i++;
        }
        frontmatter[key] = arr;
      } else {
        frontmatter[key] = val;
        i++;
      }
    } else {
      i++;
    }
  }
  return { file, frontmatter, body: m[2].trim() };
}

/** hsk1/coffee-shop.md → "hsk1-coffee-shop" (dir stem + file stem). */
export function slugFor(story: Story): string {
  if (typeof story.frontmatter.slug === "string") return story.frontmatter.slug;
  const parts = story.file.split(/[\\/]/);
  const dir = parts[parts.length - 2] ?? "reading";
  const stem = parts[parts.length - 1].replace(/\.md$/i, "");
  return `${dir}-${stem}`;
}
