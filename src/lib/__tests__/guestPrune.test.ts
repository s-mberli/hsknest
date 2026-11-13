/**
 * Guest pruning must count Reading Mode visits as activity: a guest who only
 * reads writes ReadingSession rows and never a ReviewLog.
 *
 * Uses its own DB file so this file's `prisma db push` doesn't race other
 * integration tests when Vitest runs files in parallel.
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import { pruneStaleGuests } from "@/lib/guestPrune";

const TEST_DB_PATH = path.join(__dirname, "..", "..", "..", "prisma", "test-integration-guest-prune.db");
const TEST_DB_URL = `file:${TEST_DB_PATH}`;
const DAY = 24 * 60 * 60 * 1000;

let prisma: PrismaClient;

function deleteTestDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

describe("pruneStaleGuests", () => {
  beforeAll(() => {
    deleteTestDbFiles();
    writeFileSync(TEST_DB_PATH, "");
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      cwd: process.cwd(),
      stdio: "pipe",
    });
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  }, 60000);

  afterAll(async () => {
    await prisma?.$disconnect();
    deleteTestDbFiles();
  });

  it("keeps guests with recent reviews or reading sessions, deletes idle ones", async () => {
    const now = Date.now();
    const cutoff = new Date(now - 35 * DAY);
    const old = new Date(now - 60 * DAY);
    const recent = new Date(now - 2 * DAY);

    const language = await prisma.language.create({ data: { name: "Mandarin", code: "zh" } });
    const list = await prisma.wordList.create({ data: { name: "Starter", languageId: language.id } });
    const word = await prisma.word.create({
      data: { wordListId: list.id, term: "你好", translation: "hello", position: 0 },
    });
    const text = await prisma.readingText.create({
      data: { languageId: language.id, slug: "s1", title: "Story", level: 1, bodyRaw: "你好" },
    });

    const user = (email: string, createdAt: Date) =>
      prisma.user.create({ data: { email, passwordHash: "x", createdAt } });

    const idle = await user("guest-idle@guest.local", old);
    const reader = await user("guest-reader@guest.local", old);
    const reviewer = await user("guest-reviewer@guest.local", old);
    const oldReader = await user("guest-old-reader@guest.local", old);
    const fresh = await user("guest-fresh@guest.local", recent);
    const real = await user("learner@example.com", old);

    await prisma.readingSession.create({
      data: { userId: reader.id, textId: text.id, startedAt: recent },
    });
    await prisma.readingSession.create({
      data: { userId: oldReader.id, textId: text.id, startedAt: old },
    });
    await prisma.reviewLog.create({
      data: {
        userId: reviewer.id,
        wordId: word.id,
        quality: 4,
        algorithm: "FSRS",
        intervalBefore: 0,
        intervalAfter: 1,
        reviewedAt: recent,
      },
    });
    // A guest-owned list goes with its guest (no cascade from User).
    await prisma.wordList.create({
      data: { name: "Idle guest list", languageId: language.id, createdById: idle.id },
    });

    expect(await pruneStaleGuests(prisma, cutoff)).toBe(2);

    const remaining = (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id);
    expect(remaining.sort()).toEqual([reader.id, reviewer.id, fresh.id, real.id].sort());
    expect(await prisma.wordList.count({ where: { createdById: idle.id } })).toBe(0);
  });
});
