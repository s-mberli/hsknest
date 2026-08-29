/**
 * Self-service diagnostic: "why is there no audio" (and a few other common
 * self-hosting questions), answerable from `docker exec <container> npm run
 * doctor` or Coolify's terminal button — no login, no admin route, nothing
 * that can itself be part of what's broken.
 *
 * Story-audio availability MUST be checked via the same resolution function
 * the app uses at read time (resolveStoryAudio / STORY_AUDIO_DIR from
 * src/lib/reading/storyAudio.ts) — never reimplemented here. Divergence
 * between "what the doctor checked" and "what the reader actually reads" is
 * exactly the bug class that caused the original Reading Mode outage (see
 * docs/adr/0001-audio-availability-is-derived.md). A unit test
 * (src/lib/reading/__tests__/storyAudio.test.ts) asserts this script imports
 * that same function rather than a local copy.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resolveStoryAudio } from "../src/lib/reading/storyAudio";

const prisma = new PrismaClient();

const AUDIO_ROOT = path.join(process.cwd(), "public", "audio");
const PACK_VERSIONS_FILE = path.join(process.cwd(), "audio", "PACK_VERSIONS");

/** SHA-256 of `text`, first 20 hex chars — matches src/lib/audio.ts's hashText
 * and scripts/generate-audio.py's filenames. Reimplemented (not imported)
 * because src/lib/audio.ts's version is async (Web Crypto, browser-facing);
 * this is the same algorithm, sync, for a one-shot CLI report. */
function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 20);
}

function readPackVersions(): Record<string, string> {
  const versions: Record<string, string> = {};
  if (!fs.existsSync(PACK_VERSIONS_FILE)) return versions;
  for (const line of fs.readFileSync(PACK_VERSIONS_FILE, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [name, version] = trimmed.split("=");
    if (name && version) versions[name.trim()] = version.trim();
  }
  return versions;
}

/** Installed-pack markers on the volume: .pack-<name>-<version>, one per line. */
function readInstalledMarkers(): { name: string; version: string; installedAt: Date }[] {
  if (!fs.existsSync(AUDIO_ROOT)) return [];
  return fs
    .readdirSync(AUDIO_ROOT)
    .filter((f) => f.startsWith(".pack-") && !f.includes("download"))
    .map((f) => {
      const rest = f.slice(".pack-".length);
      const lastDash = rest.lastIndexOf("-");
      const name = rest.slice(0, lastDash);
      const version = rest.slice(lastDash + 1);
      const stat = fs.statSync(path.join(AUDIO_ROOT, f));
      return { name, version, installedAt: stat.mtime };
    });
}

function checkAudioRoot(): { exists: boolean; writable: boolean; detail: string } {
  if (!fs.existsSync(AUDIO_ROOT)) {
    return { exists: false, writable: false, detail: "does not exist" };
  }
  let writable = false;
  try {
    const probe = path.join(AUDIO_ROOT, `.doctor-write-probe-${process.pid}`);
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
    writable = true;
  } catch {
    writable = false;
  }
  const stat = fs.statSync(AUDIO_ROOT);
  return { exists: true, writable, detail: `uid ${stat.uid}` };
}

async function checkNetwork(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://github.com", { method: "HEAD", signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

function countExisting(dir: string, hashes: string[]): number {
  if (!fs.existsSync(dir)) return 0;
  let found = 0;
  for (const h of hashes) {
    if (fs.existsSync(path.join(dir, `${h}.mp3`))) found++;
  }
  return found;
}

async function main() {
  const lines: string[] = [];
  const problems: string[] = [];
  const push = (line: string) => lines.push(line);

  push("HSK Nest doctor");

  // --- Audio root ---
  const root = checkAudioRoot();
  push(
    `  audio root      ${AUDIO_ROOT}          [${root.exists ? "exists" : "MISSING"}${
      root.exists ? `, ${root.writable ? "writable" : "NOT WRITABLE"}, ${root.detail}` : ""
    }]`
  );
  if (!root.exists) problems.push(`audio root ${AUDIO_ROOT} does not exist`);
  else if (!root.writable) problems.push(`audio root ${AUDIO_ROOT} is not writable by this process`);

  // --- Config ---
  const baseUrl = process.env.NEXT_PUBLIC_AUDIO_BASE_URL || "(unset)";
  push(`  NEXT_PUBLIC_AUDIO_BASE_URL  ${baseUrl}`);
  const audioPacksEnv = process.env.AUDIO_PACKS;
  const audioPacks = audioPacksEnv === undefined ? "stories (default)" : audioPacksEnv || "(none — audio disabled)";
  push(`  AUDIO_PACKS     ${audioPacks}`);

  // --- Installed vs expected pack versions ---
  const expected = readPackVersions();
  const installed = readInstalledMarkers();
  const installedByName = new Map(installed.map((m) => [m.name, m]));
  push("  installed packs");
  for (const [name, expectedVersion] of Object.entries(expected)) {
    const inst = installedByName.get(name);
    if (!inst) {
      push(`                  ${name.padEnd(11)} NOT INSTALLED  <- set AUDIO_PACKS to include it`);
    } else if (inst.version !== expectedVersion) {
      push(
        `                  ${name.padEnd(11)} ${inst.version} installed, ${expectedVersion} expected  <- outdated, redeploy to fetch`
      );
      problems.push(`pack "${name}" is outdated (${inst.version} installed, ${expectedVersion} expected)`);
    } else {
      push(`                  ${name.padEnd(11)} ${inst.version}, ${inst.installedAt.toISOString().slice(0, 10)}`);
    }
  }

  // --- Story audio: via the SAME function the app uses at read time ---
  const stories = await prisma.readingText.findMany({ select: { slug: true } });
  let storiesOk = 0;
  for (const s of stories) {
    if (resolveStoryAudio(s.slug)) storiesOk++;
  }
  push(
    `  stories   ${storiesOk}/${stories.length} playable (mp3+timings via resolveStoryAudio)   ${
      storiesOk === stories.length && stories.length > 0 ? "OK" : storiesOk === 0 ? "MISSING - no story narration will play" : "PARTIAL"
    }`
  );
  if (stories.length > 0 && storiesOk < stories.length) {
    problems.push(`${stories.length - storiesOk} of ${stories.length} stories are missing playable audio`);
  }

  // --- Word / sentence audio (zh) — expected set = seeded vocabulary only,
  // matching what scripts/generate-audio.py actually generates (custom
  // user words never have pre-generated clips, by design).
  const zh = await prisma.language.findFirst({ where: { code: "zh" } });
  if (zh) {
    const seededWords = await prisma.word.findMany({
      where: { wordList: { languageId: zh.id, createdById: null } },
      select: { term: true },
      distinct: ["term"],
    });
    const wordHashes = seededWords.map((w) => hashText(w.term));
    const wordDir = path.join(AUDIO_ROOT, "zh", "w");
    const wordsOk = countExisting(wordDir, wordHashes);
    push(
      `  words     ${wordsOk}/${wordHashes.length} mp3                       ${
        wordHashes.length === 0 ? "N/A" : wordsOk === wordHashes.length ? "OK" : wordsOk === 0 ? "MISSING - no word audio will play" : "PARTIAL"
      }`
    );
    if (wordHashes.length > 0 && wordsOk < wordHashes.length) {
      problems.push(`${wordHashes.length - wordsOk} of ${wordHashes.length} Mandarin words are missing audio`);
    }

    const sentences = await prisma.sentence.findMany({ where: { languageId: zh.id }, select: { text: true } });
    const sentenceHashes = sentences.map((s) => hashText(s.text));
    const sentenceDir = path.join(AUDIO_ROOT, "zh", "s");
    const sentencesOk = countExisting(sentenceDir, sentenceHashes);
    push(
      `  sentences ${sentencesOk}/${sentenceHashes.length} mp3                       ${
        sentenceHashes.length === 0 ? "N/A" : sentencesOk === sentenceHashes.length ? "OK" : sentencesOk === 0 ? "MISSING - no sentence audio will play" : "PARTIAL"
      }`
    );
    if (sentenceHashes.length > 0 && sentencesOk < sentenceHashes.length) {
      problems.push(`${sentenceHashes.length - sentencesOk} of ${sentenceHashes.length} Mandarin sentences are missing audio`);
    }
  }

  // --- Orphaned files: present on disk but not in an installed pack's
  // manifest — these are the only audio files a self-hoster actually needs
  // to back up (everything a manifest lists is re-fetchable by URL +
  // checksum; see docs/DEPLOYMENT.md). Best-effort: fetches each installed
  // pack's manifest.json from its GitHub Release (same repo as the pack
  // itself); a network failure here just skips this check, it never blocks
  // the rest of the report.
  const audioRepo = process.env.AUDIO_PACK_REPO || "s-mberli/hsknest";
  // Same pack-name -> subpath mapping as docker-entrypoint.sh's pack_subpath().
  const PACK_SUBPATHS: Record<string, string> = { stories: "zh/r", words: "zh/w", sentences: "zh/s", de: "de" };
  const orphans: string[] = [];
  for (const { name, version } of installed) {
    const subpath = PACK_SUBPATHS[name];
    if (!subpath) continue;
    const packDir = path.join(AUDIO_ROOT, subpath);
    if (!fs.existsSync(packDir)) continue;
    try {
      const manifestUrl = `https://github.com/${audioRepo}/releases/download/audio-${name}-${version}/${name}-${version}.manifest.json`;
      const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const manifest = (await res.json()) as { files: { path: string }[] };
      const knownPaths = new Set(manifest.files.map((f) => f.path));
      for (const filename of fs.readdirSync(packDir)) {
        const rel = `${subpath}/${filename}`;
        if (!knownPaths.has(rel)) orphans.push(rel);
      }
    } catch {
      // Network unavailable, release missing, malformed manifest — this
      // check is a bonus, not load-bearing. Silently skip.
    }
  }
  if (orphans.length > 0) {
    push(`  orphaned  ${orphans.length} file(s) on disk not in any pack manifest — NOT re-fetchable, back these up:`);
    for (const o of orphans.slice(0, 10)) push(`            ${o}`);
    if (orphans.length > 10) push(`            (+${orphans.length - 10} more)`);
  }

  const dbCounts = await prisma.readingText.count();
  push(`  db        ${dbCounts} stories`);

  const networkOk = await checkNetwork();
  push(`  network   github.com reachable      ${networkOk ? "OK" : "UNREACHABLE - audio pack downloads will fail"}`);
  if (!networkOk) problems.push("github.com is unreachable — audio pack downloads will fail on boot");

  push("");
  if (problems.length === 0) {
    push("Verdict: audio looks fully installed. No action needed.");
  } else {
    push(`Verdict: ${problems[0]}.`);
    if (problems.length > 1) {
      push(`  (+${problems.length - 1} more issue${problems.length - 1 === 1 ? "" : "s"} above)`);
    }
    push('Fix: check AUDIO_PACKS above, set it to include the missing pack(s), and redeploy.');
  }

  console.log(lines.join("\n"));
  await prisma.$disconnect();
  // process.exitCode (not process.exit()) — forcing an immediate exit here
  // raced the network check's fetch() teardown and crashed with a libuv
  // assertion on Windows ("UV_HANDLE_CLOSING", src/win/async.c) after the
  // report had already printed correctly. Setting exitCode lets Node drain
  // pending handles and exit cleanly on its own.
  process.exitCode = problems.length > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error("doctor: fatal error:", err);
  process.exitCode = 2;
});
