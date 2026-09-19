import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import { seedContentMatches, seedList, type SeedWord } from "../../../prisma/seed";

const TEST_DB_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "prisma",
  "test-seed-refresh.db"
);
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

const db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

const WORDS_V1: SeedWord[] = [
  { term: "一", translation: "one", phonetic: "yī", metadata: { level: 1 } },
  { term: "二", translation: "two", phonetic: "èr", metadata: { level: 1 } },
  { term: "三", translation: "three", phonetic: "sān", metadata: { level: 1 } },
  { term: "四", translation: "four", phonetic: "sì", metadata: { level: 1 } },
  { term: "五", translation: "five", phonetic: "wǔ", metadata: { level: 1 } },
];

const WORDS_V2: SeedWord[] = [WORDS_V1[2], WORDS_V1[0], WORDS_V1[3]];

function deleteTestDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = TEST_DB_PATH + suffix;
    if (existsSync(file)) unlinkSync(file);
  }
}

describe("seed vocabulary refresh", () => {
  beforeAll(async () => {
    deleteTestDbFiles();
    await db.$connect();
    await db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    await db.$executeRawUnsafe(`
      CREATE TABLE "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "passwordHash" TEXT NOT NULL,
        "name" TEXT,
        "preferredAlgorithm" TEXT NOT NULL DEFAULT 'FSRS',
        "settings" TEXT,
        "theme" TEXT NOT NULL DEFAULT 'system',
        "studyTheme" TEXT NOT NULL DEFAULT 'follow',
        "cardTextSize" TEXT NOT NULL DEFAULT 'normal',
        "characterStyle" TEXT NOT NULL DEFAULT 'modern',
        "showReading" BOOLEAN NOT NULL DEFAULT true,
        "soundEffects" BOOLEAN NOT NULL DEFAULT true,
        "autoPlayPronunciation" BOOLEAN NOT NULL DEFAULT true,
        "dailyNewWords" INTEGER NOT NULL DEFAULT 10,
        "assumedCheckPerDay" INTEGER NOT NULL DEFAULT 3,
        "intervalModifier" REAL NOT NULL DEFAULT 1.0,
        "lapseModifier" REAL NOT NULL DEFAULT 0.0,
        "masteryThresholdDays" INTEGER,
        "fuzzIntervals" BOOLEAN NOT NULL DEFAULT true,
        "desiredRetention" REAL NOT NULL DEFAULT 0.90,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        "passwordChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "emailVerified" DATETIME,
        "stripeCustomerId" TEXT UNIQUE,
        "subscriptionStatus" TEXT NOT NULL DEFAULT 'trialing',
        "trialEndsAt" DATETIME,
        "billingConsentAt" DATETIME,
        "targetLanguageId" TEXT,
        FOREIGN KEY ("targetLanguageId") REFERENCES "Language" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE "Language" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "code" TEXT NOT NULL UNIQUE,
        "createdById" TEXT,
        FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE "WordList" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "languageId" TEXT NOT NULL,
        "isPublic" BOOLEAN NOT NULL DEFAULT false,
        "createdById" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE "Word" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "term" TEXT NOT NULL,
        "translation" TEXT NOT NULL,
        "phonetic" TEXT,
        "metadata" TEXT,
        "wordListId" TEXT NOT NULL,
        "position" INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY ("wordListId") REFERENCES "WordList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE "UserProgress" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "wordId" TEXT NOT NULL,
        "state" TEXT NOT NULL DEFAULT 'NEW',
        "easeFactor" REAL NOT NULL DEFAULT 2.5,
        "intervalDays" REAL NOT NULL DEFAULT 0,
        "repetitions" INTEGER NOT NULL DEFAULT 0,
        "box" INTEGER NOT NULL DEFAULT 1,
        "lapses" INTEGER NOT NULL DEFAULT 0,
        "dueAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastReviewedAt" DATETIME,
        "introducedAt" DATETIME,
        "assumedCheckedAt" DATETIME,
        "srsData" TEXT,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE "ReviewLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "guestId" TEXT,
        "wordId" TEXT NOT NULL,
        "quality" INTEGER NOT NULL,
        "algorithm" TEXT NOT NULL,
        "intervalBefore" REAL NOT NULL,
        "intervalAfter" REAL NOT NULL,
        "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "source" TEXT NOT NULL DEFAULT 'srs',
        "latencyMs" INTEGER,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
  });

  afterAll(async () => {
    await db.$disconnect();
    deleteTestDbFiles();
  });

  it("detects a changed word at a formerly unsampled position", async () => {
    const language = await db.language.create({ data: { code: "zh-seed-test", name: "Mandarin" } });
    const listName = "Seed refresh regression";

    await seedList(language.id, listName, "Test list", WORDS_V1, db);

    const beforeList = await db.wordList.findFirstOrThrow({ where: { name: listName } });
    const middleWord = await db.word.findFirstOrThrow({
      where: { wordListId: beforeList.id, term: "二" },
    });
    const user = await db.user.create({
      data: { email: `seed-test-${Date.now()}@example.com`, passwordHash: "test" },
    });
    const dueAt = new Date("2026-01-02T00:00:00.000Z");
    const lastReviewedAt = new Date("2026-01-01T00:00:00.000Z");
    const progress = await db.userProgress.create({
      data: {
        userId: user.id,
        wordId: middleWord.id,
        state: "REVIEW",
        easeFactor: 2.1,
        intervalDays: 12,
        repetitions: 3,
        box: 3,
        lapses: 1,
        dueAt,
        lastReviewedAt,
      },
    });
    const review = await db.reviewLog.create({
      data: {
        userId: user.id,
        wordId: middleWord.id,
        quality: 4,
        algorithm: "FSRS",
        intervalBefore: 6,
        intervalAfter: 12,
        reviewedAt: lastReviewedAt,
      },
    });

    const changedWords = WORDS_V1.map((word) =>
      word.term === "二"
        ? { ...word, translation: "two; couple", metadata: { level: 1, corrected: true } }
        : word
    );
    await seedList(language.id, listName, "Test list", changedWords, db);

    const afterList = await db.wordList.findFirstOrThrow({ where: { name: listName } });
    const afterWord = await db.word.findFirstOrThrow({
      where: { wordListId: afterList.id, term: "二" },
    });

    expect(afterList.id).toBe(beforeList.id);
    expect(afterWord.id).toBe(middleWord.id);
    expect(afterWord.translation).toBe("two; couple");
    expect(afterWord.metadata).toEqual({ level: 1, corrected: true });
    expect(await db.userProgress.findUniqueOrThrow({ where: { id: progress.id } })).toEqual(progress);
    expect(await db.reviewLog.findUniqueOrThrow({ where: { id: review.id } })).toEqual(review);
  });

  it("treats a retained retired term as already current", () => {
    const incoming = WORDS_V1.slice(0, 4);
    const stored = [
      ...incoming.map((word, position) => ({ ...word, position })),
      { ...WORDS_V1[4], position: 4 },
    ];

    expect(seedContentMatches(stored, incoming)).toBe(true);
  });

  it("compacts incoming terms and deterministically places retired terms after them", async () => {
    const language = await db.language.create({ data: { code: "zh-seed-order-test", name: "Mandarin" } });
    const listName = "Seed retired order regression";

    await seedList(language.id, listName, "Test list", WORDS_V1, db);
    const beforeList = await db.wordList.findFirstOrThrow({ where: { name: listName } });
    const retiredTwo = await db.word.findFirstOrThrow({
      where: { wordListId: beforeList.id, term: "二" },
    });
    const retiredFive = await db.word.findFirstOrThrow({
      where: { wordListId: beforeList.id, term: "五" },
    });
    const user = await db.user.create({
      data: { email: `seed-order-${Date.now()}@example.com`, passwordHash: "test" },
    });
    const progress = await db.userProgress.create({
      data: { userId: user.id, wordId: retiredTwo.id, state: "REVIEW" },
    });
    const review = await db.reviewLog.create({
      data: {
        userId: user.id,
        wordId: retiredTwo.id,
        quality: 4,
        algorithm: "FSRS",
        intervalBefore: 1,
        intervalAfter: 2,
      },
    });

    await seedList(language.id, listName, "Test list", WORDS_V2, db);

    const afterFirstRefresh = await db.word.findMany({
      where: { wordListId: beforeList.id },
      orderBy: { position: "asc" },
      select: { id: true, term: true, position: true },
    });
    expect(afterFirstRefresh).toEqual([
      { id: expect.any(String), term: "三", position: 0 },
      { id: expect.any(String), term: "一", position: 1 },
      { id: expect.any(String), term: "四", position: 2 },
      { id: retiredTwo.id, term: "二", position: 3 },
      { id: retiredFive.id, term: "五", position: 4 },
    ]);
    expect(new Set(afterFirstRefresh.map((word) => word.position)).size).toBe(
      afterFirstRefresh.length
    );
    expect(await db.userProgress.findUniqueOrThrow({ where: { id: progress.id } })).toEqual(progress);
    expect(await db.reviewLog.findUniqueOrThrow({ where: { id: review.id } })).toEqual(review);

    await seedList(language.id, listName, "Test list", WORDS_V2, db);

    const afterSecondRefresh = await db.word.findMany({
      where: { wordListId: beforeList.id },
      orderBy: { position: "asc" },
      select: { id: true, term: true, position: true },
    });
    expect(afterSecondRefresh).toEqual(afterFirstRefresh);
  });
});
