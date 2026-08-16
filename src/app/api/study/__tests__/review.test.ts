/**
 * Route-level tests for POST /api/study/review — the wiring around the
 * scheduler (the scheduler math itself is covered by src/lib/srs/__tests__).
 * Verifies the dedup guard (no double-advance), the ASSUMED-check branch,
 * practice-mode no-op, and the 401/404 gates.
 *
 * Uses its own DB file so this file's `prisma db push` doesn't race the
 * other route-test files when Vitest runs files in parallel (same reasoning
 * as authz.test.ts / staleSession.test.ts).
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
  "test-integration-review.db"
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

describe("POST /api/study/review", () => {
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
        email: `review-${Date.now()}@test.local`,
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

  async function enroll(userId: string, wordId: string, state: CardState = "NEW") {
    return testPrisma.userProgress.create({
      data: { userId, wordId, state },
    });
  }

  it("returns 401 without a session", async () => {
    const res = await reviewPOST(
      jsonRequest({ wordId: "x", quality: 4 })
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for a word the user is not enrolled in", async () => {
    const user = await makeUser();
    const word = await makeWord();
    currentUserId = user.id;

    const res = await reviewPOST(
      jsonRequest({ wordId: word.id, quality: 4 })
    );
    expect(res.status).toBe(404);
  });

  it("advances a NEW card to REVIEW on success, stamps introducedAt, logs the review", async () => {
    const user = await makeUser();
    const word = await makeWord();
    await enroll(user.id, word.id);
    currentUserId = user.id;

    const res = await reviewPOST(jsonRequest({ wordId: word.id, quality: 4 }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.next.state).toBe("REVIEW");
    expect(body.next.intervalDays).toBe(1); // SM-2 first success

    const row = await testPrisma.userProgress.findUnique({
      where: { userId_wordId: { userId: user.id, wordId: word.id } },
    });
    expect(row?.repetitions).toBe(1);
    expect(row?.introducedAt).not.toBeNull(); // first-ever review stamps the daily-new cap
    expect(await testPrisma.reviewLog.count()).toBe(1);
  });

  it("dedups: a second post within 5s does not double-advance the schedule", async () => {
    const user = await makeUser();
    const word = await makeWord();
    await enroll(user.id, word.id);
    currentUserId = user.id;

    const first = await reviewPOST(jsonRequest({ wordId: word.id, quality: 4 }));
    expect(first.status).toBe(200);

    const second = await reviewPOST(jsonRequest({ wordId: word.id, quality: 4 }));
    expect(second.status).toBe(200); // P2025 is swallowed, not a 500

    const row = await testPrisma.userProgress.findUnique({
      where: { userId_wordId: { userId: user.id, wordId: word.id } },
    });
    expect(row?.intervalDays).toBe(1); // still the first review's interval
    expect(row?.repetitions).toBe(1); // not advanced twice
    expect(await testPrisma.reviewLog.count()).toBe(1); // one log, not two
  });

  it("ASSUMED swipe-right graduates to a long REVIEW interval", async () => {
    const user = await makeUser();
    const word = await makeWord();
    await enroll(user.id, word.id, "ASSUMED");
    currentUserId = user.id;

    const res = await reviewPOST(jsonRequest({ wordId: word.id, quality: 4 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next.state).toBe("REVIEW");
    expect(body.next.intervalDays).toBe(30); // ASSUMED_CONFIRMED_INTERVAL_DAYS

    const row = await testPrisma.userProgress.findUnique({
      where: { userId_wordId: { userId: user.id, wordId: word.id } },
    });
    expect(row?.state).toBe("REVIEW");
    expect(row?.introducedAt).toBeNull(); // assumed checks must not burn the daily-new budget
  });

  it("ASSUMED swipe-left restarts the card as LEARNING 1 day out", async () => {
    const user = await makeUser();
    const word = await makeWord();
    await enroll(user.id, word.id, "ASSUMED");
    currentUserId = user.id;

    const res = await reviewPOST(jsonRequest({ wordId: word.id, quality: 1 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next.state).toBe("LEARNING");
    expect(body.next.intervalDays).toBe(1);
  });

  it("practice mode logs the review but leaves the schedule untouched", async () => {
    const user = await makeUser();
    const word = await makeWord();
    const due = new Date(Date.now() + 5 * 86_400_000);
    await testPrisma.userProgress.create({
      data: { userId: user.id, wordId: word.id, state: "REVIEW", intervalDays: 5, dueAt: due },
    });
    currentUserId = user.id;

    const res = await reviewPOST(
      jsonRequest({ wordId: word.id, quality: 3, practice: true, source: "quiz" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next.state).toBe("REVIEW");
    expect(body.next.intervalDays).toBe(5);
    expect(new Date(body.next.dueAt).getTime()).toBe(due.getTime());

    const row = await testPrisma.userProgress.findUnique({
      where: { userId_wordId: { userId: user.id, wordId: word.id } },
    });
    expect(row?.intervalDays).toBe(5); // schedule untouched
    expect(row?.dueAt.getTime()).toBe(due.getTime());
    expect(row?.introducedAt).toBeNull(); // practice must not stamp the cap

    const log = await testPrisma.reviewLog.findFirst({ where: { userId: user.id } });
    expect(log?.source).toBe("quiz");
    expect(log?.quality).toBe(3);
  });

  it("records the source on a normal review", async () => {
    const user = await makeUser();
    const word = await makeWord();
    await enroll(user.id, word.id);
    currentUserId = user.id;

    const res = await reviewPOST(
      jsonRequest({ wordId: word.id, quality: 4, source: "sentences" })
    );
    expect(res.status).toBe(200);
    const log = await testPrisma.reviewLog.findFirst({ where: { userId: user.id } });
    expect(log?.source).toBe("sentences");
  });
});
