/**
 * Functional tests for reading API routes — encounter, deck, progress, known-words.
 * Uses a dedicated test DB to avoid race conditions with other route tests.
 *
 * Tests cover: auth (401), validation (400), rate limiting (429),
 * language validation, happy paths, dedup, metadata storage, upsert behavior,
 * position clamping, completion, and user scoping.
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { TRACKED_STATES } from "@/lib/cardStates";

const TEST_DB_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "prisma",
  "test-integration-reading.db"
);
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let testPrisma: PrismaClient;
let currentUserId: string | null = null;
let rateLimitResult = true;

vi.mock("@/lib/session", () => ({
  getCurrentUserId: () => currentUserId,
}));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return testPrisma;
  },
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: () => rateLimitResult,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    has: () => false,
    getAll: () => [],
    toString: () => "",
  }),
}));

const { POST: encounterPOST } = await import("@/app/api/reading/encounter/route");
const { POST: deckPOST } = await import("@/app/api/reading/deck/route");
const { POST: progressPOST } = await import("@/app/api/reading/progress/route");
const { GET: knownWordsGET } = await import("@/app/api/reading/known-words/route");
const { POST: sessionPOST } = await import("@/app/api/reading/session/route");
const { POST: deckBatchPOST } = await import("@/app/api/reading/deck/batch/route");

function jsonPost(body: unknown, url = "http://localhost/api/reading/encounter") {
  return new Request(url, {
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

describe("Reading API routes", () => {
  let testLang: { id: string; code: string };

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
    currentUserId = null;
    rateLimitResult = true;
    await testPrisma.wordEncounter.deleteMany();
    await testPrisma.readingSession.deleteMany();
    await testPrisma.reviewLog.deleteMany();
    await testPrisma.listPriority.deleteMany();
    await testPrisma.userProgress.deleteMany();
    await testPrisma.readingProgress.deleteMany();
    await testPrisma.word.deleteMany();
    await testPrisma.wordList.deleteMany();
    await testPrisma.readingText.deleteMany();
    await testPrisma.language.deleteMany();
    await testPrisma.user.deleteMany();
    testLang = await testPrisma.language.create({
      data: { name: "Test Lang", code: `tl-${Date.now()}` },
    });
  });

  async function makeUser() {
    return testPrisma.user.create({
      data: {
        email: `reading-${Date.now()}@test.local`,
        passwordHash: "x",
        preferredAlgorithm: "SM2",
        fuzzIntervals: false,
      },
    });
  }

  // ── encounter ──────────────────────────────────────────────────────────────

  describe("POST /api/reading/encounter", () => {
    it("returns 401 without a session", async () => {
      const res = await encounterPOST(jsonPost({ lemma: "你好", languageId: testLang.id }));
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid body", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await encounterPOST(jsonPost({ lemma: "" }));
      expect(res.status).toBe(400);
    });

    it("returns 429 when rate limited", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      rateLimitResult = false;
      const res = await encounterPOST(jsonPost({ lemma: "你好", languageId: testLang.id }));
      expect(res.status).toBe(429);
    });

    it("returns 400 for invalid languageId", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await encounterPOST(jsonPost({ lemma: "你好", languageId: "nonexistent" }));
      expect(res.status).toBe(400);
    });

    it("creates encounter on first lookup", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await encounterPOST(jsonPost({ lemma: "你好", languageId: testLang.id }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.lookups).toBe(1);
      expect(data.added).toBe(false);
      expect(data.nudge).toBe(false);
    });

    it("increments lookups on repeated lookup", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await encounterPOST(jsonPost({ lemma: "你好", languageId: testLang.id }));
      const res = await encounterPOST(jsonPost({ lemma: "你好", languageId: testLang.id }));
      const data = await res.json();
      expect(data.lookups).toBe(2);
    });

    it("nudges at lookups >= 3 when not added", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await encounterPOST(jsonPost({ lemma: "你好", languageId: testLang.id }));
      await encounterPOST(jsonPost({ lemma: "你好", languageId: testLang.id }));
      const res = await encounterPOST(jsonPost({ lemma: "你好", languageId: testLang.id }));
      const data = await res.json();
      expect(data.lookups).toBe(3);
      expect(data.nudge).toBe(true);
    });

    it("scopes encounters by language", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const lang2 = await testPrisma.language.create({
        data: { name: "Other", code: `ot-${Date.now()}` },
      });
      await encounterPOST(jsonPost({ lemma: "你好", languageId: testLang.id }));
      const res = await encounterPOST(jsonPost({ lemma: "你好", languageId: lang2.id }));
      const data = await res.json();
      expect(data.lookups).toBe(1); // different language = separate encounter
    });
  });

  // ── deck ───────────────────────────────────────────────────────────────────

  describe("POST /api/reading/deck", () => {
    it("returns 401 without a session", async () => {
      const res = await deckPOST(jsonPost({ lemma: "你好", languageId: testLang.id }, "http://localhost/api/reading/deck"));
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid body", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await deckPOST(jsonPost({ lemma: "" }, "http://localhost/api/reading/deck"));
      expect(res.status).toBe(400);
    });

    it("returns 429 when rate limited", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      rateLimitResult = false;
      const res = await deckPOST(jsonPost({ lemma: "你好", languageId: testLang.id }, "http://localhost/api/reading/deck"));
      expect(res.status).toBe(429);
    });

    it("returns 400 for invalid languageId", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await deckPOST(jsonPost({ lemma: "你好", languageId: "nonexistent" }, "http://localhost/api/reading/deck"));
      expect(res.status).toBe(400);
    });

    it("creates word + progress atomically", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await deckPOST(jsonPost(
        { lemma: "你好", languageId: testLang.id, pinyin: "nǐ hǎo" },
        "http://localhost/api/reading/deck"
      ));
      expect(res.status).toBe(200);
      const word = await testPrisma.word.findFirst({ where: { term: "你好" } });
      expect(word).toBeTruthy();
      const progress = await testPrisma.userProgress.findFirst({
        where: { userId: user.id, wordId: word!.id },
      });
      expect(progress).toBeTruthy();
      expect(progress!.state).toBe("NEW");
    });

    it("stores metadata (HSK level, encounter sentence, source)", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await deckPOST(jsonPost(
        { lemma: "咖啡", languageId: testLang.id, level: 2, sentence: "我去咖啡店。", storySlug: "coffee-story" },
        "http://localhost/api/reading/deck"
      ));
      expect(res.status).toBe(200);
      const word = await testPrisma.word.findFirst({ where: { term: "咖啡" } });
      expect(word).toBeTruthy();
      const meta = word!.metadata as Record<string, unknown>;
      expect(meta.hskLevel).toBe(2);
      expect(meta.encounterSentence).toBe("我去咖啡店。");
      expect(meta.encounterSource).toBe("coffee-story");
      expect(Array.isArray(meta.meanings)).toBe(true);
    });

    it("returns 'Already in deck' for duplicate word in same language", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await deckPOST(jsonPost(
        { lemma: "你好", languageId: testLang.id },
        "http://localhost/api/reading/deck"
      ));
      const res = await deckPOST(jsonPost(
        { lemma: "你好", languageId: testLang.id },
        "http://localhost/api/reading/deck"
      ));
      const data = await res.json();
      expect(data.message).toBe("Already in deck");
    });

    it("does not duplicate a word already tracked from a seeded (non-owned) list", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      // Seeded list: createdById is null, same as the real HSK seed lists.
      const seededList = await testPrisma.wordList.create({
        data: { name: "HSK 1", languageId: testLang.id, createdById: null },
      });
      const seededWord = await testPrisma.word.create({
        data: { term: "你好", translation: "hello", wordListId: seededList.id, position: 0 },
      });
      await testPrisma.userProgress.create({
        data: { userId: user.id, wordId: seededWord.id },
      });

      const res = await deckPOST(jsonPost(
        { lemma: "你好", languageId: testLang.id },
        "http://localhost/api/reading/deck"
      ));
      const data = await res.json();
      expect(data.message).toBe("Already in deck");

      const progressCount = await testPrisma.userProgress.count({ where: { userId: user.id } });
      expect(progressCount).toBe(1); // no second card was created

      const readingListWords = await testPrisma.word.count({
        where: { wordList: { createdById: user.id, name: "From Reading" } },
      });
      expect(readingListWords).toBe(0); // "From Reading" list was never even created
    });

    it("allows same lemma in different language", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const lang2 = await testPrisma.language.create({
        data: { name: "Other", code: `ot-${Date.now()}` },
      });
      await deckPOST(jsonPost(
        { lemma: "你好", languageId: testLang.id },
        "http://localhost/api/reading/deck"
      ));
      const res = await deckPOST(jsonPost(
        { lemma: "你好", languageId: lang2.id },
        "http://localhost/api/reading/deck"
      ));
      expect(res.status).toBe(200);
    });

    it("marks encounter as added", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      // Create encounter first
      await testPrisma.wordEncounter.create({
        data: { userId: user.id, languageId: testLang.id, lemma: "你好", lookups: 2 },
      });
      await deckPOST(jsonPost(
        { lemma: "你好", languageId: testLang.id },
        "http://localhost/api/reading/deck"
      ));
      const enc = await testPrisma.wordEncounter.findFirst({
        where: { userId: user.id, languageId: testLang.id, lemma: "你好" },
      });
      expect(enc!.addedWordId).toBeTruthy();
    });

    it("gives the 'From Reading' list a ListPriority row so the queue doesn't treat it as unranked", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await deckPOST(jsonPost(
        { lemma: "你好", languageId: testLang.id },
        "http://localhost/api/reading/deck"
      ));
      const list = await testPrisma.wordList.findFirst({
        where: { createdById: user.id, name: "From Reading" },
      });
      expect(list).toBeTruthy();
      const priority = await testPrisma.listPriority.findUnique({
        where: { userId_wordListId: { userId: user.id, wordListId: list!.id } },
      });
      expect(priority).toBeTruthy();
    });

    it("assigns increasing positions across successive adds instead of always 0", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await deckPOST(jsonPost({ lemma: "你好", languageId: testLang.id }, "http://localhost/api/reading/deck"));
      await deckPOST(jsonPost({ lemma: "谢谢", languageId: testLang.id }, "http://localhost/api/reading/deck"));
      const words = await testPrisma.word.findMany({
        where: { wordList: { createdById: user.id, name: "From Reading" } },
        orderBy: { position: "asc" },
      });
      expect(words.map((w) => w.position)).toEqual([0, 1]);
    });
  });

  // ── deck batch ─────────────────────────────────────────────────────────────

  describe("POST /api/reading/deck/batch", () => {
    it("returns 401 without a session", async () => {
      const res = await deckBatchPOST(jsonPost(
        { languageId: testLang.id, items: [{ lemma: "你好" }] },
        "http://localhost/api/reading/deck/batch"
      ));
      expect(res.status).toBe(401);
    });

    it("returns 400 for an empty items array", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await deckBatchPOST(jsonPost(
        { languageId: testLang.id, items: [] },
        "http://localhost/api/reading/deck/batch"
      ));
      expect(res.status).toBe(400);
    });

    it("returns 429 when rate limited", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      rateLimitResult = false;
      const res = await deckBatchPOST(jsonPost(
        { languageId: testLang.id, items: [{ lemma: "你好" }] },
        "http://localhost/api/reading/deck/batch"
      ));
      expect(res.status).toBe(429);
    });

    it("returns 400 for invalid languageId", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await deckBatchPOST(jsonPost(
        { languageId: "nonexistent", items: [{ lemma: "你好" }] },
        "http://localhost/api/reading/deck/batch"
      ));
      expect(res.status).toBe(400);
    });

    it("creates a word + progress for every item, all sharing one 'From Reading' list", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await deckBatchPOST(jsonPost(
        { languageId: testLang.id, storySlug: "s1", items: [{ lemma: "你好" }, { lemma: "谢谢", level: 1 }] },
        "http://localhost/api/reading/deck/batch"
      ));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.added).toBe(2);
      expect(data.alreadyTracked).toBe(0);

      const words = await testPrisma.word.findMany({
        where: { wordList: { createdById: user.id, name: "From Reading" } },
        orderBy: { position: "asc" },
      });
      expect(words).toHaveLength(2);
      expect(words.map((w) => w.term)).toEqual(["你好", "谢谢"]);
      expect(words.map((w) => w.position)).toEqual([0, 1]);

      const progressCount = await testPrisma.userProgress.count({ where: { userId: user.id } });
      expect(progressCount).toBe(2);
    });

    it("skips items already tracked from any list (own or seeded), keeping the rest", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const seededList = await testPrisma.wordList.create({
        data: { name: "HSK 1", languageId: testLang.id, createdById: null },
      });
      const seededWord = await testPrisma.word.create({
        data: { term: "你好", translation: "hello", wordListId: seededList.id, position: 0 },
      });
      await testPrisma.userProgress.create({ data: { userId: user.id, wordId: seededWord.id } });

      const res = await deckBatchPOST(jsonPost(
        { languageId: testLang.id, items: [{ lemma: "你好" }, { lemma: "谢谢" }] },
        "http://localhost/api/reading/deck/batch"
      ));
      const data = await res.json();
      expect(data.added).toBe(1);
      expect(data.alreadyTracked).toBe(1);
      expect(data.addedLemmas).toEqual(["谢谢"]);
    });

    it("de-dupes repeated lemmas within the same request", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await deckBatchPOST(jsonPost(
        { languageId: testLang.id, items: [{ lemma: "你好" }, { lemma: "你好" }] },
        "http://localhost/api/reading/deck/batch"
      ));
      const data = await res.json();
      expect(data.added).toBe(1);
      const count = await testPrisma.word.count({ where: { term: "你好", wordList: { createdById: user.id } } });
      expect(count).toBe(1);
    });

    it("continues position numbering across a prior single add", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await deckPOST(jsonPost({ lemma: "你好", languageId: testLang.id }, "http://localhost/api/reading/deck"));
      await deckBatchPOST(jsonPost(
        { languageId: testLang.id, items: [{ lemma: "谢谢" }] },
        "http://localhost/api/reading/deck/batch"
      ));
      const words = await testPrisma.word.findMany({
        where: { wordList: { createdById: user.id, name: "From Reading" } },
        orderBy: { position: "asc" },
      });
      expect(words.map((w) => w.position)).toEqual([0, 1]);
    });

    it("marks each item's WordEncounter as added", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await testPrisma.wordEncounter.create({
        data: { userId: user.id, languageId: testLang.id, lemma: "你好", lookups: 2 },
      });
      await deckBatchPOST(jsonPost(
        { languageId: testLang.id, items: [{ lemma: "你好" }] },
        "http://localhost/api/reading/deck/batch"
      ));
      const enc = await testPrisma.wordEncounter.findFirst({
        where: { userId: user.id, languageId: testLang.id, lemma: "你好" },
      });
      expect(enc!.addedWordId).toBeTruthy();
    });
  });

  // ── progress ───────────────────────────────────────────────────────────────

  describe("POST /api/reading/progress", () => {
    let testStory: { id: string };

    beforeEach(async () => {
      testStory = await testPrisma.readingText.create({
        data: {
          title: "Test Story",
          slug: `test-story-${Date.now()}`,
          bodyRaw: "你好世界。",
          languageId: testLang.id,
          level: 1,
        },
      });
    });

    it("returns 401 without a session", async () => {
      const res = await progressPOST(jsonPost(
        { textId: testStory.id, position: 0 },
        "http://localhost/api/reading/progress"
      ));
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid body", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await progressPOST(jsonPost(
        { textId: "", position: -1 },
        "http://localhost/api/reading/progress"
      ));
      expect(res.status).toBe(400);
    });

    it("returns 429 when rate limited", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      rateLimitResult = false;
      const res = await progressPOST(jsonPost(
        { textId: testStory.id, position: 50 },
        "http://localhost/api/reading/progress"
      ));
      expect(res.status).toBe(429);
    });

    it("returns 404 for nonexistent story", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await progressPOST(jsonPost(
        { textId: "nonexistent", position: 0 },
        "http://localhost/api/reading/progress"
      ));
      expect(res.status).toBe(404);
    });

    it("clamps position to 0-100", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await progressPOST(jsonPost(
        { textId: testStory.id, position: 200 },
        "http://localhost/api/reading/progress"
      ));
      expect(res.status).toBe(400); // max(100) rejects 200
    });

    it("creates progress on first save", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await progressPOST(jsonPost(
        { textId: testStory.id, position: 25 },
        "http://localhost/api/reading/progress"
      ));
      expect(res.status).toBe(200);
      const prog = await testPrisma.readingProgress.findFirst({
        where: { userId: user.id, textId: testStory.id },
      });
      expect(prog!.lastPosition).toBe(25);
    });

    it("sets completedAt when completed flag is true", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await progressPOST(jsonPost(
        { textId: testStory.id, position: 95, completed: true },
        "http://localhost/api/reading/progress"
      ));
      const prog = await testPrisma.readingProgress.findFirst({
        where: { userId: user.id, textId: testStory.id },
      });
      expect(prog!.completedAt).toBeTruthy();
    });

    it("scopes progress per user", async () => {
      const user1 = await makeUser();
      const user2 = await makeUser();
      currentUserId = user1.id;
      await progressPOST(jsonPost(
        { textId: testStory.id, position: 50 },
        "http://localhost/api/reading/progress"
      ));
      currentUserId = user2.id;
      await progressPOST(jsonPost(
        { textId: testStory.id, position: 75 },
        "http://localhost/api/reading/progress"
      ));
      const p1 = await testPrisma.readingProgress.findFirst({
        where: { userId: user1.id, textId: testStory.id },
      });
      const p2 = await testPrisma.readingProgress.findFirst({
        where: { userId: user2.id, textId: testStory.id },
      });
      expect(p1!.lastPosition).toBe(50);
      expect(p2!.lastPosition).toBe(75);
    });
  });

  // ── session ────────────────────────────────────────────────────────────────

  describe("POST /api/reading/session", () => {
    let testStory: { id: string };

    beforeEach(async () => {
      testStory = await testPrisma.readingText.create({
        data: {
          title: "Test Story",
          slug: `test-story-session-${Date.now()}`,
          bodyRaw: "你好世界。",
          languageId: testLang.id,
          level: 1,
        },
      });
    });

    it("returns 401 without a session", async () => {
      const res = await sessionPOST(jsonPost(
        { textId: testStory.id, durationMs: 10000 },
        "http://localhost/api/reading/session"
      ));
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid body", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await sessionPOST(jsonPost(
        { textId: "", durationMs: -1 },
        "http://localhost/api/reading/session"
      ));
      expect(res.status).toBe(400);
    });

    it("returns 400 for a duration over the 3-hour cap", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await sessionPOST(jsonPost(
        { textId: testStory.id, durationMs: 4 * 60 * 60 * 1000 },
        "http://localhost/api/reading/session"
      ));
      expect(res.status).toBe(400);
    });

    it("returns 429 when rate limited", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      rateLimitResult = false;
      const res = await sessionPOST(jsonPost(
        { textId: testStory.id, durationMs: 10000 },
        "http://localhost/api/reading/session"
      ));
      expect(res.status).toBe(429);
    });

    it("returns 404 for nonexistent story", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await sessionPOST(jsonPost(
        { textId: "nonexistent", durationMs: 10000 },
        "http://localhost/api/reading/session"
      ));
      expect(res.status).toBe(404);
    });

    it("creates a session row with the reported duration and completed flag", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const res = await sessionPOST(jsonPost(
        { textId: testStory.id, durationMs: 45000, completed: true },
        "http://localhost/api/reading/session"
      ));
      expect(res.status).toBe(200);
      const session = await testPrisma.readingSession.findFirst({
        where: { userId: user.id, textId: testStory.id },
      });
      expect(session!.durationMs).toBe(45000);
      expect(session!.completed).toBe(true);
      expect(session!.endedAt).toBeTruthy();
    });

    it("defaults completed to false when omitted", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await sessionPOST(jsonPost(
        { textId: testStory.id, durationMs: 10000 },
        "http://localhost/api/reading/session"
      ));
      const session = await testPrisma.readingSession.findFirst({
        where: { userId: user.id, textId: testStory.id },
      });
      expect(session!.completed).toBe(false);
    });

    it("allows repeat sessions for the same text (re-reads accumulate, not upsert)", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      await sessionPOST(jsonPost(
        { textId: testStory.id, durationMs: 10000 },
        "http://localhost/api/reading/session"
      ));
      await sessionPOST(jsonPost(
        { textId: testStory.id, durationMs: 20000 },
        "http://localhost/api/reading/session"
      ));
      const count = await testPrisma.readingSession.count({
        where: { userId: user.id, textId: testStory.id },
      });
      expect(count).toBe(2);
    });
  });

  // ── known-words ────────────────────────────────────────────────────────────

  describe("GET /api/reading/known-words", () => {
    it("returns 401 without a session", async () => {
      const res = await knownWordsGET();
      expect(res.status).toBe(401);
    });

    it("returns 429 when rate limited", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      rateLimitResult = false;
      const res = await knownWordsGET();
      expect(res.status).toBe(429);
    });

    it("returns known words with strength", async () => {
      const user = await makeUser();
      currentUserId = user.id;
      const list = await testPrisma.wordList.create({
        data: { name: "Test", languageId: testLang.id, createdById: user.id },
      });
      const word = await testPrisma.word.create({
        data: { term: "你好", translation: "hello", wordListId: list.id },
      });
      await testPrisma.userProgress.create({
        data: { userId: user.id, wordId: word.id, state: "REVIEW", intervalDays: 5 },
      });
      const res = await knownWordsGET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.known).toHaveLength(1);
      expect(data.known[0].lemma).toBe("你好");
      expect(data.known[0].strength).toBeDefined();
    });

    it("scopes to current user only", async () => {
      const user1 = await makeUser();
      const user2 = await makeUser();
      const list = await testPrisma.wordList.create({
        data: { name: "Test", languageId: testLang.id, createdById: user1.id },
      });
      const word = await testPrisma.word.create({
        data: { term: "你好", translation: "hello", wordListId: list.id },
      });
      await testPrisma.userProgress.create({
        data: { userId: user1.id, wordId: word.id },
      });
      currentUserId = user2.id;
      const res = await knownWordsGET();
      const data = await res.json();
      expect(data.known).toHaveLength(0);
    });
  });

  // ── /reading library page coverage query ────────────────────────────────
  // Regression coverage for the "enrolled-but-unstudied words count as known"
  // bug: enrolling a list bulk-creates a NEW-state UserProgress row per word
  // (see enroll/route.ts), so a coverage query with no state filter counted
  // every enrolled word as known — a story became "100% known" the moment
  // its list was enrolled, without a single review. reading/page.tsx now
  // filters by TRACKED_STATES; this asserts that filter's actual DB
  // behavior directly (the page itself is a server component and isn't
  // easily invoked from a unit test).
  describe("Reading library page — coverage query", () => {
    it("excludes NEW-state progress rows from the known-words set", async () => {
      const user = await makeUser();
      const list = await testPrisma.wordList.create({
        data: { name: "Test", languageId: testLang.id, createdById: user.id },
      });
      const learningWord = await testPrisma.word.create({
        data: { term: "你好", translation: "hello", wordListId: list.id },
      });
      const newWord = await testPrisma.word.create({
        data: { term: "再见", translation: "goodbye", wordListId: list.id },
      });
      // Enrollment shape: a real review (LEARNING) alongside a bulk-enrolled,
      // never-studied word (NEW) — the exact mix a real account has.
      await testPrisma.userProgress.create({
        data: { userId: user.id, wordId: learningWord.id, state: "LEARNING" },
      });
      await testPrisma.userProgress.create({
        data: { userId: user.id, wordId: newWord.id, state: "NEW" },
      });

      const rows = await testPrisma.userProgress.findMany({
        where: {
          userId: user.id,
          state: { in: [...TRACKED_STATES] },
          word: { wordList: { languageId: testLang.id } },
        },
        select: { word: { select: { term: true } } },
      });

      expect(rows.map((r) => r.word.term)).toEqual(["你好"]);
    });

    it("includes ASSUMED — the user explicitly claimed the word", async () => {
      const user = await makeUser();
      const list = await testPrisma.wordList.create({
        data: { name: "Test", languageId: testLang.id, createdById: user.id },
      });
      const word = await testPrisma.word.create({
        data: { term: "谢谢", translation: "thanks", wordListId: list.id },
      });
      await testPrisma.userProgress.create({
        data: { userId: user.id, wordId: word.id, state: "ASSUMED" },
      });

      const rows = await testPrisma.userProgress.findMany({
        where: {
          userId: user.id,
          state: { in: [...TRACKED_STATES] },
          word: { wordList: { languageId: testLang.id } },
        },
        select: { word: { select: { term: true } } },
      });

      expect(rows).toHaveLength(1);
    });
  });
});
