/**
 * Regression guard for the "stale session" bug: NextAuth JWTs live 30 days
 * (src/lib/auth.ts:9), but scripts/prune-guests.ts deletes inactive guest
 * accounts after 14 — so a pruned guest can hold a cryptographically valid
 * token for a User row that no longer exists. Every write route then throws
 * an unhandled Prisma error (P2025 "record not found", or a foreign-key
 * violation) instead of the ordinary 401 a logged-out request gets.
 *
 * Deliberately does NOT mock @/lib/session — the fix lives inside
 * getCurrentUserId(), so mocking that module would bypass the code under
 * test and this loop would prove nothing. Mocks next-auth's
 * getServerSession() instead, one level below, so the real
 * getCurrentUserId() runs for real against a session pointing at a user
 * that has since been deleted.
 *
 * Uses its own DB file so this file's `prisma db push` doesn't race
 * ownership.test.ts / authz.test.ts when Vitest runs files in parallel.
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
  "test-integration-stale-session.db"
);
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let testPrisma: PrismaClient;
let mockSession: { user: { id: string } } | null = null;

vi.mock("next-auth", () => ({
  getServerSession: () => mockSession,
}));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return testPrisma;
  },
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: () => true,
}));

// Imported after the mocks above so the routes (and getCurrentUserId, via
// requireUser) pick up the mocked getServerSession/prisma.
const { PATCH: settingsPATCH } = await import("@/app/api/settings/route");
const { POST: enrollPOST } = await import("@/app/api/lists/[id]/enroll/route");

function jsonRequest(body: unknown, method = "PATCH") {
  return new Request("http://localhost/api/x", {
    method,
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

describe(
  "stale session — user row deleted after the JWT was issued",
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
      mockSession = null;
      await testPrisma.userProgress.deleteMany();
      await testPrisma.word.deleteMany();
      await testPrisma.wordList.deleteMany();
      await testPrisma.language.deleteMany();
      await testPrisma.user.deleteMany();
    });

    /**
     * Creates then deletes a user, and points the mocked session at the
     * (now-gone) id — reproducing exactly what a pruned guest's still-valid
     * JWT looks like server-side.
     */
    async function sessionForDeletedUser(): Promise<string> {
      const user = await testPrisma.user.create({
        data: { email: `ghost-${Date.now()}@guest.local`, passwordHash: "x" },
      });
      await testPrisma.user.delete({ where: { id: user.id } });
      mockSession = { user: { id: user.id } };
      return user.id;
    }

    it("PATCH /api/settings returns 401 for a stale session, not a 500", async () => {
      await sessionForDeletedUser();
      const res = await settingsPATCH(jsonRequest({}));
      expect(res.status).toBe(401);
    });

    it("POST /api/lists/[id]/enroll returns 401 for a stale session, not a 500/FK crash", async () => {
      await sessionForDeletedUser();

      // A public list the deleted user can still *see* (visibleListWhere
      // doesn't check the caller exists), with a word to enroll — so the
      // route reaches the FK-violating userProgress.createMany write instead
      // of short-circuiting earlier on a 404/403. This is what actually
      // crashed in production: a guest who could still browse lists hit
      // "Enroll" and got a raw foreign-key error.
      const lang = await testPrisma.language.create({
        data: { name: "Lang", code: `l-${Date.now()}` },
      });
      const list = await testPrisma.wordList.create({
        data: { name: "Public", languageId: lang.id, isPublic: true },
      });
      await testPrisma.word.create({
        data: { term: "你好", translation: "hello", wordListId: list.id },
      });

      const res = await enrollPOST(jsonRequest({}, "POST"), {
        params: Promise.resolve({ id: list.id }),
      });
      expect(res.status).toBe(401);
    });

    it("a live session for an existing user still works (control — the fix must not break normal auth)", async () => {
      const lang = await testPrisma.language.create({
        data: { name: "Lang", code: `l-${Date.now()}` },
      });
      const user = await testPrisma.user.create({
        data: {
          email: `real-${Date.now()}@test.local`,
          passwordHash: "x",
          targetLanguageId: lang.id,
        },
      });
      mockSession = { user: { id: user.id } };
      const res = await settingsPATCH(jsonRequest({}));
      expect(res.status).toBe(200);
    });
  },
  60000
);
