import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import {
  ownedListWhere,
  ownedWordWhere,
  visibleLanguageWhere,
  visibleListWhere,
} from "@/lib/ownership";

const TEST_DB_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "prisma",
  "test-integration.db"
);
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let testPrisma: PrismaClient;
let userA: { id: string };
let userB: { id: string };
let seededListId: string;
let privateListAId: string;
let seededWordId: string;
let privateWordAId: string;
let seededLangId: string;
let privateLangAId: string;

function deleteTestDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

describe("ownership — unit shape", () => {
  it("visibleListWhere returns public OR createdById=userId", () => {
    expect(visibleListWhere("user_x")).toEqual({
      OR: [{ isPublic: true }, { createdById: "user_x" }],
    });
  });

  it("visibleLanguageWhere returns seeded OR createdById=userId", () => {
    expect(visibleLanguageWhere("user_x")).toEqual({
      OR: [{ createdById: null }, { createdById: "user_x" }],
    });
  });

  it("ownedWordWhere requires the parent list to be owned by the user", () => {
    expect(ownedWordWhere("word_1", "user_x")).toEqual({
      id: "word_1",
      wordList: { createdById: "user_x" },
    });
  });

  it("ownedListWhere requires the list to be owned by the user (not merely visible)", () => {
    expect(ownedListWhere("list_1", "user_x")).toEqual({
      id: "list_1",
      createdById: "user_x",
    });
  });
});

describe(
  "ownership — integration against a real Prisma DB",
  () => {
    beforeAll(() => {
      deleteTestDbFiles();
      // `db push` resolves the schema against the schema file's directory,
      // so we MUST use an absolute `file:` URL — a relative one resolves
      // to `prisma/prisma/test-integration.db` and silently lands an
      // empty DB. The PrismaClient below also takes the absolute URL so
      // both sides agree on the file location.
      execSync("npx prisma db push --skip-generate --accept-data-loss", {
        env: { ...process.env, DATABASE_URL: TEST_DB_URL },
        cwd: process.cwd(),
        stdio: "pipe",
      });
      testPrisma = new PrismaClient({
        datasources: { db: { url: TEST_DB_URL } },
      });
    }, 60000);

    afterAll(async () => {
      await testPrisma?.$disconnect();
      deleteTestDbFiles();
    });

    beforeEach(async () => {
      // Fresh rows per test, in declaration order (FK targets first).
      await testPrisma.userProgress.deleteMany();
      await testPrisma.word.deleteMany();
      await testPrisma.hiddenList.deleteMany();
      await testPrisma.listPriority.deleteMany();
      await testPrisma.wordList.deleteMany();
      await testPrisma.language.deleteMany();
      await testPrisma.feedback.deleteMany();
      await testPrisma.reviewLog.deleteMany();
      await testPrisma.user.deleteMany();

      const seededLang = await testPrisma.language.create({
        data: { name: "Seeded Lang", code: `sl-${Date.now()}` },
      });
      seededLangId = seededLang.id;

      userA = await testPrisma.user.create({
        data: { email: `a-${Date.now()}@test.local`, passwordHash: "x" },
      });
      userB = await testPrisma.user.create({
        data: { email: `b-${Date.now()}@test.local`, passwordHash: "x" },
      });

      const privateLangA = await testPrisma.language.create({
        data: {
          name: "PrivateA Lang",
          code: `pa-${Date.now()}`,
          createdById: userA.id,
        },
      });
      privateLangAId = privateLangA.id;

      const seededList = await testPrisma.wordList.create({
        data: {
          name: "Seeded",
          languageId: seededLang.id,
          isPublic: true,
          createdById: null,
        },
      });
      seededListId = seededList.id;

      const privateListA = await testPrisma.wordList.create({
        data: {
          name: "PrivateA",
          languageId: seededLang.id,
          isPublic: false,
          createdById: userA.id,
        },
      });
      privateListAId = privateListA.id;

      const seededWord = await testPrisma.word.create({
        data: { term: "seed", translation: "seed-t", wordListId: seededList.id },
      });
      seededWordId = seededWord.id;

      const privateWord = await testPrisma.word.create({
        data: { term: "private", translation: "private-t", wordListId: privateListA.id },
      });
      privateWordAId = privateWord.id;
    });

    it("visibleListWhere(userA) returns both the seeded and the private list", async () => {
      const rows = await testPrisma.wordList.findMany({
        where: visibleListWhere(userA.id),
        orderBy: { name: "asc" },
      });
      const ids = rows.map((r) => r.id).sort();
      expect(ids).toEqual([seededListId, privateListAId].sort());
    });

    it("visibleListWhere(userB) returns ONLY the seeded list — private list of A is invisible", async () => {
      const rows = await testPrisma.wordList.findMany({
        where: visibleListWhere(userB.id),
      });
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(seededListId);
      expect(ids).not.toContain(privateListAId);
    });

    it("visibleLanguageWhere(userA) returns the seeded language AND A's own language", async () => {
      const rows = await testPrisma.language.findMany({
        where: visibleLanguageWhere(userA.id),
      });
      const ids = rows.map((r) => r.id).sort();
      expect(ids).toEqual([seededLangId, privateLangAId].sort());
    });

    it("visibleLanguageWhere(userB) returns ONLY the seeded language — A's private language is invisible", async () => {
      const rows = await testPrisma.language.findMany({
        where: visibleLanguageWhere(userB.id),
      });
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(seededLangId);
      expect(ids).not.toContain(privateLangAId);
    });

    it("ownedWordWhere(seededWord, userA) does NOT match — seeded content is read-only", async () => {
      const found = await testPrisma.word.findFirst({
        where: ownedWordWhere(seededWordId, userA.id),
      });
      expect(found).toBeNull();
    });

    it("ownedWordWhere(privateWord, userA) matches the word — A owns its list", async () => {
      const found = await testPrisma.word.findFirst({
        where: ownedWordWhere(privateWordAId, userA.id),
      });
      expect(found).not.toBeNull();
      expect(found?.id).toBe(privateWordAId);
    });

    it("ownedWordWhere(privateWord, userB) does NOT match — A's list is not B's", async () => {
      const found = await testPrisma.word.findFirst({
        where: ownedWordWhere(privateWordAId, userB.id),
      });
      expect(found).toBeNull();
    });

    it("ownedListWhere(privateListA, userA) matches — A owns it", async () => {
      const found = await testPrisma.wordList.findFirst({
        where: ownedListWhere(privateListAId, userA.id),
      });
      expect(found).not.toBeNull();
      expect(found?.id).toBe(privateListAId);
    });

    it("ownedListWhere(seededList, userA) does NOT match — public/seeded is visible but not owned", async () => {
      const found = await testPrisma.wordList.findFirst({
        where: ownedListWhere(seededListId, userA.id),
      });
      expect(found).toBeNull();
    });

    it("ownedListWhere(privateListA, userB) does NOT match — A's list is not B's", async () => {
      const found = await testPrisma.wordList.findFirst({
        where: ownedListWhere(privateListAId, userB.id),
      });
      expect(found).toBeNull();
    });
  },
  60000
);
