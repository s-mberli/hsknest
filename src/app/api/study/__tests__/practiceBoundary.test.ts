/**
 * Route-level tests for the Practice/Review boundary — proving that Practice
 * mode logs activity but leaves the scheduler untouched, while Review mode
 * advances the schedule. This is ticket-05's core evidence that recognition
 * tasks cannot inflate ease and intervals.
 *
 * Uses its own DB file (separate from review.test.ts) to avoid race conditions
 * when Vitest runs route-test files in parallel.
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { CardState } from "@/lib/srs";

const TEST_DB_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "prisma",
  "test-practice-boundary.db"
);
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let testPrisma: PrismaClient;
let currentUserId: string | null = null;

vi.mock("@/lib/session", () => ({
  getCurrentUserId: () => currentUserId,
}));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return testPrisma;
  },
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: () => true,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    has: () => false,
    getAll: () => [],
    toString: () => "",
  }),
}));

// Imported after the mocks above so the route picks up the mocked modules.
const { POST: reviewPOST } = await import("@/app/api/study/review/route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/study/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteTestDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

describe("Practice/Review boundary — scheduler isolation", () => {
  beforeAll(() => {
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
    currentUserId = null;
    await testPrisma.reviewLog.deleteMany();
    await testPrisma.userProgress.deleteMany();
    await testPrisma.word.deleteMany();
    await testPrisma.wordList.deleteMany();
    await testPrisma.language.deleteMany();
    await testPrisma.user.deleteMany();
  });

  async function makeUser(overrides: Record<string, unknown> = {}) {
    return testPrisma.user.create({
      data: {
        email: `boundary-${Date.now()}@test.local`,
        passwordHash: "x",
        preferredAlgorithm: "SM2",
        fuzzIntervals: false,
        ...overrides,
      },
    });
  }

  async function makeWord() {
    const lang = await testPrisma.language.create({
      data: { name: "Lang", code: `l-${Date.now()}` },
    });
    const list = await testPrisma.wordList.create({
      data: { name: "List", languageId: lang.id },
    });
    const word = await testPrisma.word.create({
      data: { term: "你好", translation: "hello", wordListId: list.id },
    });
    return word;
  }

  describe("practice mode (quality 3, same word)", () => {
    it("leaves intervalDays untouched", async () => {
      const user = await makeUser();
      const word = await makeWord();
      const originalInterval = 7;
      const dueDate = new Date(Date.now() + originalInterval * 86_400_000);

      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: "REVIEW",
          intervalDays: originalInterval,
          dueAt: dueDate,
          easeFactor: 2.5,
          repetitions: 5,
        },
      });
      currentUserId = user.id;

      const res = await reviewPOST(
        jsonRequest({ wordId: word.id, quality: 3, practice: true, source: "quiz" })
      );
      expect(res.status).toBe(200);

      const row = await testPrisma.userProgress.findUnique({
        where: { userId_wordId: { userId: user.id, wordId: word.id } },
      });
      expect(row?.intervalDays).toBe(originalInterval);
      expect(row?.dueAt.getTime()).toBe(dueDate.getTime());
    });

    it("leaves easeFactor untouched", async () => {
      const user = await makeUser();
      const word = await makeWord();
      const originalEase = 2.3;

      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: "REVIEW",
          intervalDays: 7,
          easeFactor: originalEase,
          repetitions: 5,
        },
      });
      currentUserId = user.id;

      await reviewPOST(
        jsonRequest({ wordId: word.id, quality: 3, practice: true, source: "match" })
      );

      const row = await testPrisma.userProgress.findUnique({
        where: { userId_wordId: { userId: user.id, wordId: word.id } },
      });
      expect(row?.easeFactor).toBe(originalEase);
    });

    it("leaves state and repetitions untouched", async () => {
      const user = await makeUser();
      const word = await makeWord();
      const originalState: CardState = "REVIEW";
      const originalReps = 8;

      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: originalState,
          intervalDays: 7,
          repetitions: originalReps,
        },
      });
      currentUserId = user.id;

      await reviewPOST(
        jsonRequest({ wordId: word.id, quality: 3, practice: true })
      );

      const row = await testPrisma.userProgress.findUnique({
        where: { userId_wordId: { userId: user.id, wordId: word.id } },
      });
      expect(row?.state).toBe(originalState);
      expect(row?.repetitions).toBe(originalReps);
    });

    it("does not stamp introducedAt (respects daily-new cap)", async () => {
      const user = await makeUser();
      const word = await makeWord();

      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: "REVIEW",
          intervalDays: 7,
          introducedAt: null,
        },
      });
      currentUserId = user.id;

      await reviewPOST(
        jsonRequest({ wordId: word.id, quality: 3, practice: true })
      );

      const row = await testPrisma.userProgress.findUnique({
        where: { userId_wordId: { userId: user.id, wordId: word.id } },
      });
      expect(row?.introducedAt).toBeNull();
    });

    it("logs a ReviewLog row with intervalBefore === intervalAfter", async () => {
      const user = await makeUser();
      const word = await makeWord();
      const interval = 7;

      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: "REVIEW",
          intervalDays: interval,
        },
      });
      currentUserId = user.id;

      await reviewPOST(
        jsonRequest({ wordId: word.id, quality: 3, practice: true, source: "sentences" })
      );

      const log = await testPrisma.reviewLog.findFirst({
        where: { userId: user.id },
      });
      expect(log).toBeDefined();
      expect(log?.quality).toBe(3);
      expect(log?.source).toBe("sentences");
      expect(log?.intervalBefore).toBe(interval);
      expect(log?.intervalAfter).toBe(interval);
    });
  });

  describe("contrast: review mode (non-practice) on the same word", () => {
    it("does advance the schedule on quality >= 3", async () => {
      const user = await makeUser();
      const word = await makeWord();

      // Start with LEARNING 1 day out.
      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: "LEARNING",
          intervalDays: 1,
          easeFactor: 2.5,
          repetitions: 1,
        },
      });
      currentUserId = user.id;

      // Grade Good (quality 4) — should advance to REVIEW.
      const res = await reviewPOST(
        jsonRequest({ wordId: word.id, quality: 4 })
      );
      expect(res.status).toBe(200);

      const row = await testPrisma.userProgress.findUnique({
        where: { userId_wordId: { userId: user.id, wordId: word.id } },
      });
      expect(row?.state).toBe("REVIEW");
      expect(row?.intervalDays).toBeGreaterThan(1); // SM-2: 1 → 6
      expect(row?.repetitions).toBe(2);
    });

    it("changes dueAt accordingly", async () => {
      const user = await makeUser();
      const word = await makeWord();
      const originalDue = new Date(Date.now() + 86_400_000);

      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: "LEARNING",
          intervalDays: 1,
          dueAt: originalDue,
        },
      });
      currentUserId = user.id;

      await reviewPOST(jsonRequest({ wordId: word.id, quality: 4 }));

      const row = await testPrisma.userProgress.findUnique({
        where: { userId_wordId: { userId: user.id, wordId: word.id } },
      });
      // New dueAt should be ~6 days in the future (SM-2 LEARNING→REVIEW interval).
      expect(row?.dueAt.getTime()).toBeGreaterThan(originalDue.getTime());
    });

    it("still logs a ReviewLog, with intervalBefore !== intervalAfter", async () => {
      const user = await makeUser();
      const word = await makeWord();

      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: "LEARNING",
          intervalDays: 1,
          repetitions: 1, // Second review: 1 → 6 days per SM-2
        },
      });
      currentUserId = user.id;

      await reviewPOST(
        jsonRequest({ wordId: word.id, quality: 4, source: "quiz" })
      );

      const log = await testPrisma.reviewLog.findFirst({
        where: { userId: user.id },
      });
      expect(log).toBeDefined();
      expect(log?.intervalBefore).toBe(1);
      expect(log?.intervalAfter).toBeGreaterThan(1);
      expect(log?.source).toBe("quiz");
    });
  });

  describe("activity logging — streak and heatmap still register Practice", () => {
    it("practice quality 3 logs reviewLog so streak counts activity", async () => {
      const user = await makeUser();
      const word = await makeWord();

      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: "REVIEW",
          intervalDays: 5,
        },
      });
      currentUserId = user.id;

      const beforeCount = await testPrisma.reviewLog.count({
        where: { userId: user.id },
      });
      expect(beforeCount).toBe(0);

      await reviewPOST(
        jsonRequest({ wordId: word.id, quality: 3, practice: true })
      );

      const afterCount = await testPrisma.reviewLog.count({
        where: { userId: user.id },
      });
      expect(afterCount).toBe(1);

      const log = await testPrisma.reviewLog.findFirst({
        where: { userId: user.id },
      });
      expect(log?.quality).toBe(3);
    });

    it("practice with source='ninja' preserves source for activity logging", async () => {
      const user = await makeUser();
      const word = await makeWord();

      await testPrisma.userProgress.create({
        data: {
          userId: user.id,
          wordId: word.id,
          state: "REVIEW",
          intervalDays: 5,
        },
      });
      currentUserId = user.id;

      await reviewPOST(
        jsonRequest({ wordId: word.id, quality: 2, practice: true, source: "ninja" })
      );

      const log = await testPrisma.reviewLog.findFirst({
        where: { userId: user.id },
      });
      expect(log?.source).toBe("ninja");
    });
  });
});
