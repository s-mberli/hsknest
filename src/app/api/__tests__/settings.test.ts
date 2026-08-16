/**
 * Route-level tests for PATCH /api/settings — specifically the target
 * language visibility check (SEC-1 audit finding) and the auto-enroll of a
 * starter list when a user switches to a language they have no progress in.
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

const TEST_DB_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "prisma",
  "test-integration-settings.db"
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

// Imported after the mocks above so the route picks up the mocked modules.
const { PATCH: settingsPATCH } = await import("@/app/api/settings/route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/settings", {
    method: "PATCH",
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

async function makeUser(email: string, data: Record<string, unknown> = {}) {
  return testPrisma.user.create({
    data: { email, passwordHash: "x", ...data },
  });
}

describe("PATCH /api/settings — target language validation & auto-enroll", () => {
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
    await testPrisma.userProgress.deleteMany();
    await testPrisma.word.deleteMany();
    await testPrisma.wordList.deleteMany();
    await testPrisma.language.deleteMany();
    await testPrisma.user.deleteMany();
  });

  it("rejects a target language owned by another user (private row)", async () => {
    const me = await makeUser(`me-${Date.now()}@test.local`);
    const other = await makeUser(`other-${Date.now()}@test.local`);
    const privateLang = await testPrisma.language.create({
      data: { name: "Secret", code: `sec-${Date.now()}`, createdById: other.id },
    });
    currentUserId = me.id;

    const res = await settingsPATCH(
      jsonRequest({ targetLanguageId: privateLang.id })
    );
    expect(res.status).toBe(404);
  });

  it("rejects a non-existent language id with 404, not an FK 500", async () => {
    const me = await makeUser(`me-${Date.now()}@test.local`);
    currentUserId = me.id;

    const res = await settingsPATCH(
      jsonRequest({ targetLanguageId: "ckz0000000000000000000000" })
    );
    expect(res.status).toBe(404);
  });

  it("accepts a seeded (global) language", async () => {
    const me = await makeUser(`me-${Date.now()}@test.local`);
    const lang = await testPrisma.language.create({
      data: { name: "Chinese", code: `zh-${Date.now()}` },
    });
    currentUserId = me.id;

    const res = await settingsPATCH(jsonRequest({ targetLanguageId: lang.id }));
    expect(res.status).toBe(200);
    const updated = await testPrisma.user.findUnique({ where: { id: me.id } });
    expect(updated?.targetLanguageId).toBe(lang.id);
  });

  it("auto-enrolls the smallest non-empty seeded list when no name match", async () => {
    const me = await makeUser(`me-${Date.now()}@test.local`);
    const lang = await testPrisma.language.create({
      data: { name: "Chinese", code: `zh-${Date.now()}` },
    });
    // Two public seeded lists, no "starter"/"foundation" in the name — the
    // picker must fall back to the smallest non-empty one.
    const big = await testPrisma.wordList.create({
      data: { name: "HSK 1", languageId: lang.id, isPublic: true },
    });
    const small = await testPrisma.wordList.create({
      data: { name: "HSK 1 Core", languageId: lang.id, isPublic: true },
    });
    await testPrisma.word.createMany({
      data: [
        { term: "一", translation: "one", wordListId: big.id, position: 0 },
        { term: "二", translation: "two", wordListId: big.id, position: 1 },
        { term: "好", translation: "good", wordListId: small.id, position: 0 },
      ],
    });
    currentUserId = me.id;

    const res = await settingsPATCH(jsonRequest({ targetLanguageId: lang.id }));
    expect(res.status).toBe(200);

    const enrolled = await testPrisma.userProgress.count({ where: { userId: me.id } });
    expect(enrolled).toBe(1);
    const row = await testPrisma.userProgress.findFirst({ where: { userId: me.id } });
    expect(row?.wordId).toBe((await testPrisma.word.findFirst({ where: { wordListId: small.id } }))?.id);
  });

  it("does not auto-enroll when the user already has progress in the language", async () => {
    const me = await makeUser(`me-${Date.now()}@test.local`);
    const lang = await testPrisma.language.create({
      data: { name: "Chinese", code: `zh-${Date.now()}` },
    });
    const list = await testPrisma.wordList.create({
      data: { name: "Starter", languageId: lang.id, isPublic: true },
    });
    const word = await testPrisma.word.create({
      data: { term: "好", translation: "good", wordListId: list.id },
    });
    await testPrisma.userProgress.create({
      data: { userId: me.id, wordId: word.id },
    });
    currentUserId = me.id;

    const res = await settingsPATCH(jsonRequest({ targetLanguageId: lang.id }));
    expect(res.status).toBe(200);
    const enrolled = await testPrisma.userProgress.count({ where: { userId: me.id } });
    expect(enrolled).toBe(1); // unchanged
  });

  it("clears the target language with null and still succeeds", async () => {
    const me = await makeUser(`me-${Date.now()}@test.local`);
    currentUserId = me.id;

    const res = await settingsPATCH(jsonRequest({ targetLanguageId: null }));
    expect(res.status).toBe(200);
  });

  it("still performs a plain settings update (no target language) — control", async () => {
    const me = await makeUser(`me-${Date.now()}@test.local`);
    currentUserId = me.id;

    const res = await settingsPATCH(jsonRequest({ name: "New Name" }));
    expect(res.status).toBe(200);
    const updated = await testPrisma.user.findUnique({ where: { id: me.id } });
    expect(updated?.name).toBe("New Name");
  });
});
