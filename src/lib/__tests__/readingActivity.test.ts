/**
 * Integration tests for getActivityDayBuckets/getActivityDates — the shared
 * union of ReviewLog + ReadingSession that feeds streak and heatmap. Uses a
 * real (dedicated) test DB, same pattern as reading-routes.test.ts, since
 * the whole point of this module is a Prisma query shape.
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const TEST_DB_PATH = path.join(__dirname, "..", "..", "..", "prisma", "test-integration-reading-activity.db");
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let testPrisma: PrismaClient;

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return testPrisma;
  },
}));

const { getActivityDayBuckets, getActivityDates, MIN_READING_SESSION_MS } = await import("@/lib/readingActivity");

function deleteTestDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

describe("readingActivity", () => {
  let testLang: { id: string };
  let testStory: { id: string };
  let user: { id: string };

  beforeAll(async () => {
    deleteTestDbFiles();
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      cwd: process.cwd(),
      stdio: "pipe",
    });
    testPrisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  }, 60000);

  afterAll(async () => {
    await testPrisma?.$disconnect();
    deleteTestDbFiles();
  });

  beforeEach(async () => {
    await testPrisma.readingSession.deleteMany();
    await testPrisma.reviewLog.deleteMany();
    await testPrisma.readingText.deleteMany();
    await testPrisma.userProgress.deleteMany();
    await testPrisma.word.deleteMany();
    await testPrisma.wordList.deleteMany();
    await testPrisma.language.deleteMany();
    await testPrisma.user.deleteMany();

    testLang = await testPrisma.language.create({
      data: { name: "Test Lang", code: `tl-${Date.now()}` },
    });
    user = await testPrisma.user.create({
      data: { email: `activity-${Date.now()}@test.local`, passwordHash: "x", preferredAlgorithm: "SM2", fuzzIntervals: false },
    });
    testStory = await testPrisma.readingText.create({
      data: { title: "Story", slug: `story-${Date.now()}`, bodyRaw: "你好。", languageId: testLang.id, level: 1 },
    });
  });

  const oneYearAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

  it("counts a review-only day with reviewCount but zero readingCount", async () => {
    const list = await testPrisma.wordList.create({ data: { name: "L", languageId: testLang.id, createdById: user.id } });
    const word = await testPrisma.word.create({ data: { term: "你好", translation: "hi", wordListId: list.id, position: 0 } });
    await testPrisma.reviewLog.create({
      data: { userId: user.id, wordId: word.id, quality: 4, algorithm: "SM2", intervalBefore: 0, intervalAfter: 1, source: "srs" },
    });

    const buckets = await getActivityDayBuckets(user.id, oneYearAgo);
    expect(buckets.size).toBe(1);
    const day = [...buckets.values()][0];
    expect(day.reviewCount).toBe(1);
    expect(day.correctCount).toBe(1); // quality 4 >= 3
    expect(day.readingCount).toBe(0);
  });

  it("counts any ReviewLog source, not just 'srs' — matches the heatmap's pre-existing all-source behavior", async () => {
    const list = await testPrisma.wordList.create({ data: { name: "L", languageId: testLang.id, createdById: user.id } });
    const word = await testPrisma.word.create({ data: { term: "你好", translation: "hi", wordListId: list.id, position: 0 } });
    await testPrisma.reviewLog.create({
      data: { userId: user.id, wordId: word.id, quality: 2, algorithm: "SM2", intervalBefore: 0, intervalAfter: 1, source: "ninja" },
    });

    const buckets = await getActivityDayBuckets(user.id, oneYearAgo);
    expect(buckets.size).toBe(1);
    expect([...buckets.values()][0].reviewCount).toBe(1);
  });

  it("counts a reading-only day with readingCount but zero reviewCount/correctCount", async () => {
    await testPrisma.readingSession.create({
      data: { userId: user.id, textId: testStory.id, durationMs: 60000, completed: true },
    });

    const buckets = await getActivityDayBuckets(user.id, oneYearAgo);
    expect(buckets.size).toBe(1);
    const day = [...buckets.values()][0];
    expect(day.readingCount).toBe(1);
    expect(day.reviewCount).toBe(0);
    expect(day.correctCount).toBe(0);
  });

  it("excludes reading sessions below the noise floor", async () => {
    await testPrisma.readingSession.create({
      data: { userId: user.id, textId: testStory.id, durationMs: MIN_READING_SESSION_MS - 1000, completed: false },
    });

    const buckets = await getActivityDayBuckets(user.id, oneYearAgo);
    expect(buckets.size).toBe(0);
  });

  it("includes reading sessions at or above the noise floor", async () => {
    await testPrisma.readingSession.create({
      data: { userId: user.id, textId: testStory.id, durationMs: MIN_READING_SESSION_MS, completed: false },
    });

    const buckets = await getActivityDayBuckets(user.id, oneYearAgo);
    expect(buckets.size).toBe(1);
  });

  it("merges a review and a reading session on the same day into one bucket", async () => {
    const list = await testPrisma.wordList.create({ data: { name: "L", languageId: testLang.id, createdById: user.id } });
    const word = await testPrisma.word.create({ data: { term: "你好", translation: "hi", wordListId: list.id, position: 0 } });
    await testPrisma.reviewLog.create({
      data: { userId: user.id, wordId: word.id, quality: 4, algorithm: "SM2", intervalBefore: 0, intervalAfter: 1, source: "srs" },
    });
    await testPrisma.readingSession.create({
      data: { userId: user.id, textId: testStory.id, durationMs: 60000, completed: true },
    });

    const buckets = await getActivityDayBuckets(user.id, oneYearAgo);
    expect(buckets.size).toBe(1);
    const day = [...buckets.values()][0];
    expect(day.reviewCount).toBe(1);
    expect(day.readingCount).toBe(1);
  });

  it("getActivityDates returns one date per active day, usable by computeStreak", async () => {
    await testPrisma.readingSession.create({
      data: { userId: user.id, textId: testStory.id, durationMs: 60000, completed: true },
    });
    const dates = await getActivityDates(user.id, oneYearAgo);
    expect(dates).toHaveLength(1);
    expect(dates[0]).toBeInstanceOf(Date);
  });

  it("scopes activity to the requesting user only", async () => {
    const other = await testPrisma.user.create({
      data: { email: `other-${Date.now()}@test.local`, passwordHash: "x", preferredAlgorithm: "SM2", fuzzIntervals: false },
    });
    await testPrisma.readingSession.create({
      data: { userId: other.id, textId: testStory.id, durationMs: 60000, completed: true },
    });

    const buckets = await getActivityDayBuckets(user.id, oneYearAgo);
    expect(buckets.size).toBe(0);
  });
});
