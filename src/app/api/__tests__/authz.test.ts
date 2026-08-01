/**
 * Route-level authorization tests for the four list-mutating routes that
 * hand-roll ownership checks (src/lib/ownership.ts:ownedListWhere and its
 * call sites). Unit tests on the ownership helpers only prove the helpers
 * are correct — they say nothing about whether a route actually calls one.
 * These tests call the real route handlers against a real (test) database,
 * so a route that silently drops its ownership check fails here.
 *
 * Uses its own DB file (separate from ownership.test.ts's) so the two test
 * files' `prisma db push` calls don't race when Vitest runs files in
 * parallel.
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
  "test-integration-authz.db"
);
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let testPrisma: PrismaClient;
let currentUserId: string | null = null;

// Both mocks are lazy getters closing over module-scope `let`s, so they can
// be reassigned per-test after the modules they replace have been imported.
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

// Imported after the mocks above so the routes pick up the mocked modules.
const { PATCH: listPATCH, DELETE: listDELETE } = await import("@/app/api/lists/[id]/route");
const { POST: wordsPOST } = await import("@/app/api/lists/[id]/words/route");
const { POST: importPOST } = await import("@/app/api/lists/[id]/import/route");

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/lists/x", {
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

let ownerId: string;
let otherId: string;
let ownedListId: string;

describe(
  "route-level authz — list-mutating routes",
  () => {
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
      await testPrisma.word.deleteMany();
      await testPrisma.wordList.deleteMany();
      await testPrisma.language.deleteMany();
      await testPrisma.user.deleteMany();

      const lang = await testPrisma.language.create({
        data: { name: "Lang", code: `l-${Date.now()}` },
      });

      const owner = await testPrisma.user.create({
        data: { email: `owner-${Date.now()}@test.local`, passwordHash: "x" },
      });
      ownerId = owner.id;
      const other = await testPrisma.user.create({
        data: { email: `other-${Date.now()}@test.local`, passwordHash: "x" },
      });
      otherId = other.id;

      const list = await testPrisma.wordList.create({
        data: {
          name: "Owner's list",
          languageId: lang.id,
          isPublic: false,
          createdById: ownerId,
        },
      });
      ownedListId = list.id;
    });

    describe.each([
      {
        name: "PATCH /api/lists/[id]",
        call: (id: string) =>
          listPATCH(jsonRequest({ name: "Renamed" }), params(id)),
      },
      {
        name: "DELETE /api/lists/[id]",
        call: (id: string) =>
          listDELETE(new Request("http://localhost/api/lists/x"), params(id)),
      },
      {
        name: "POST /api/lists/[id]/words",
        call: (id: string) =>
          wordsPOST(
            jsonRequest({ term: "你好", translation: "hello" }),
            params(id)
          ),
      },
      {
        name: "POST /api/lists/[id]/import",
        call: (id: string) =>
          importPOST(jsonRequest({ text: "你好\thello" }), params(id)),
      },
    ])("$name", ({ call }) => {
      it("401s when unauthenticated", async () => {
        currentUserId = null;
        const res = await call(ownedListId);
        expect(res.status).toBe(401);
      });

      it("succeeds for the owner", async () => {
        currentUserId = ownerId;
        const res = await call(ownedListId);
        expect([200, 201]).toContain(res.status);
      });

      it("rejects a non-owner with 403/404, not a silent success", async () => {
        currentUserId = otherId;
        const res = await call(ownedListId);
        expect([403, 404]).toContain(res.status);
      });
    });
  },
  60000
);
