/**
 * Regression test for GET /api/study/queue's `?sentences=1` filter.
 *
 * Prisma's JSON-field `path` filter takes a different shape per provider:
 * Postgres wants string[], but SQLite/MySQL (what this app actually runs,
 * see prisma/schema.prisma) want a dot-notation string — passing the array
 * form throws a PrismaClientValidationError that 500s the entire queue
 * whenever sentence mode is requested. Caught by e2e (`sentence mode: Hard
 * counts as correct...`) but nothing at the unit level, so this pins the
 * fix directly against a real SQLite test DB.
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const TEST_DB_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "prisma",
  "test-integration-queue.db"
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
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    has: () => false,
    getAll: () => [],
    toString: () => "",
  }),
}));

const { GET: queueGET } = await import("@/app/api/study/queue/route");

function deleteTestDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

describe("GET /api/study/queue?sentences=1", () => {
  let testLang: { id: string; code: string };

  beforeAll(async () => {
    deleteTestDbFiles();
    writeFileSync(TEST_DB_PATH, "");
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
    testLang = await testPrisma.language.create({
      data: { name: "Test Lang", code: `tl-${Date.now()}` },
    });
  });

  async function makeUser() {
    return testPrisma.user.create({
      data: {
        email: `queue-${Date.now()}@test.local`,
        passwordHash: "x",
        preferredAlgorithm: "SM2",
        fuzzIntervals: false,
      },
    });
  }

  it("does not 500 when a card's only sentence is a reading-mode encounterSentence", async () => {
    const user = await makeUser();
    currentUserId = user.id;
    const list = await testPrisma.wordList.create({
      data: { name: "From Reading", languageId: testLang.id, createdById: user.id },
    });
    const word = await testPrisma.word.create({
      data: {
        term: "你好",
        translation: "hello",
        wordListId: list.id,
        position: 0,
        metadata: { encounterSentence: "你好，我叫小明。" },
      },
    });
    await testPrisma.userProgress.create({
      data: { userId: user.id, wordId: word.id, dueAt: new Date(0) },
    });

    const res = await queueGET(
      new Request("http://localhost/api/study/queue?sentences=1&limit=5")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.cards)).toBe(true);
  });

  it("does not 500 when no card has any sentence at all", async () => {
    const user = await makeUser();
    currentUserId = user.id;
    const list = await testPrisma.wordList.create({
      data: { name: "Plain", languageId: testLang.id, createdById: user.id },
    });
    const word = await testPrisma.word.create({
      data: { term: "谢谢", translation: "thanks", wordListId: list.id, position: 0 },
    });
    await testPrisma.userProgress.create({
      data: { userId: user.id, wordId: word.id, dueAt: new Date(0) },
    });

    const res = await queueGET(
      new Request("http://localhost/api/study/queue?sentences=1&limit=5")
    );
    expect(res.status).toBe(200);
  });

  it("retries only selected eligible owned words and never widens an empty selection", async () => {
    const user = await makeUser();
    currentUserId = user.id;
    const list = await testPrisma.wordList.create({
      data: { name: "Retry", languageId: testLang.id, createdById: user.id },
    });
    const a = await testPrisma.word.create({ data: { term: "A", translation: "first", wordListId: list.id } });
    const b = await testPrisma.word.create({ data: { term: "B", translation: "missed", wordListId: list.id } });
    const untouched = await testPrisma.word.create({ data: { term: "C", translation: "new", wordListId: list.id } });
    await testPrisma.userProgress.createMany({ data: [
      { userId: user.id, wordId: a.id, state: "REVIEW", dueAt: new Date(0) },
      { userId: user.id, wordId: b.id, state: "REVIEW", dueAt: new Date(1000) },
      { userId: user.id, wordId: untouched.id, state: "NEW" },
    ] });
    const res = await queueGET(new Request(`http://localhost/api/study/queue?mode=practice&wordIds=${b.id},${untouched.id}&limit=20`));
    expect(res.status).toBe(200);
    const retry = await res.json();
    expect(retry.cards.map((card: { wordId: string }) => card.wordId)).toEqual([b.id]);
    expect(retry.retryOmitted).toBe(1);
    const bounded = await queueGET(new Request(`http://localhost/api/study/queue?mode=practice&wordIds=${a.id},${b.id}&limit=1`));
    expect((await bounded.json()).cards.map((card: { wordId: string }) => card.wordId).sort()).toEqual([a.id, b.id].sort());
    const empty = await queueGET(new Request("http://localhost/api/study/queue?mode=practice&wordIds="));
    expect((await empty.json()).cards).toEqual([]);
    const foreign = await makeUser();
    currentUserId = foreign.id;
    const other = await queueGET(new Request(`http://localhost/api/study/queue?mode=practice&wordIds=${b.id}`));
    expect((await other.json()).cards).toEqual([]);
  });

  it("rejects malformed retry IDs and retry filters on Review", async () => {
    currentUserId = (await makeUser()).id;
    for (const query of ["mode=practice&wordIds=a,,b", "wordIds=a", `mode=practice&wordIds=${Array(501).fill("a").join(",")}`]) {
      expect((await queueGET(new Request(`http://localhost/api/study/queue?${query}`))).status).toBe(400);
    }
  });
});
