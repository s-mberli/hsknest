/**
 * Exercises the real next-auth JWT plumbing inside getCurrentUserId — the
 * seam the other session tests mock away. staleSession.test.ts / auth.test.ts
 * mock next-auth/jwt's getToken, so the fake-req construction, secure-prefix
 * cookie pick, and actual token decode never run under CI. This file encodes
 * a REAL JWT with next-auth's own `encode()` and lets the REAL getToken +
 * SessionStore parse it, proving the fake req shape (see session.ts) actually
 * satisfies next-auth's contract.
 *
 * Uses its own DB file (same pattern as the other route tests).
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
  "test-integration-rtoken.db"
);
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

const TEST_SECRET = "test-secret-0123456789abcdef0123456789abcdef";

let testPrisma: PrismaClient;
let mockCookieValue: string | null = null;

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return testPrisma;
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    has: (name: string) => name === "next-auth.session-token",
    get: () =>
      mockCookieValue
        ? { name: "next-auth.session-token", value: mockCookieValue }
        : undefined,
    getAll: () =>
      mockCookieValue
        ? [{ name: "next-auth.session-token", value: mockCookieValue }]
        : [],
    toString: () =>
      mockCookieValue ? `next-auth.session-token=${mockCookieValue}` : "",
  }),
}));

// Imported after the mocks so it picks up the mocked prisma/headers. next-auth
// is deliberately NOT mocked — getToken + encode run for real.
const { getCurrentUserId } = await import("@/lib/session");
const { encode } = await import("next-auth/jwt");

function deleteTestDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

describe("getCurrentUserId — real JWT plumbing", () => {
  beforeAll(() => {
    deleteTestDbFiles();
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      cwd: process.cwd(),
      stdio: "pipe",
    });
    testPrisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
  }, 60000);

  afterAll(async () => {
    await testPrisma?.$disconnect();
    deleteTestDbFiles();
  });

  beforeEach(async () => {
    mockCookieValue = null;
    await testPrisma.userProgress.deleteMany();
    await testPrisma.word.deleteMany();
    await testPrisma.wordList.deleteMany();
    await testPrisma.language.deleteMany();
    await testPrisma.user.deleteMany();
  });

  async function makeUser() {
    return testPrisma.user.create({
      data: { email: `rtoken-${Date.now()}@test.local`, passwordHash: "x" },
    });
  }

  it("decodes a real next-auth JWT and resolves the user", async () => {
    const user = await makeUser();
    mockCookieValue = await encode({
      token: { id: user.id },
      secret: TEST_SECRET,
      maxAge: 60 * 60,
    });

    expect(await getCurrentUserId()).toBe(user.id);
  });

  it("returns null for an undecryptable cookie (corrupt value)", async () => {
    await makeUser();
    mockCookieValue = "not-a-valid-jwt";

    expect(await getCurrentUserId()).toBeNull();
  });

  it("returns null when the cookie is absent", async () => {
    const user = await makeUser();
    expect(mockCookieValue).toBeNull();
    expect(await getCurrentUserId()).toBeNull();
    // (user exists — the null must come from the missing session, not a deleted row)
    expect(await testPrisma.user.count({ where: { id: user.id } })).toBe(1);
  });

  it("revokes a real token issued before a password change", async () => {
    const user = await makeUser();
    mockCookieValue = await encode({
      token: { id: user.id },
      secret: TEST_SECRET,
      maxAge: 60 * 60,
    });

    // Password reset AFTER the token was issued → token must be revoked even
    // though it decodes fine and the user still exists.
    await testPrisma.user.update({
      where: { id: user.id },
      data: { passwordChangedAt: new Date(Date.now() + 60_000) },
    });

    expect(await getCurrentUserId()).toBeNull();
  });

  it("keeps a token issued after the password change (control)", async () => {
    const user = await makeUser();
    mockCookieValue = await encode({
      token: { id: user.id },
      secret: TEST_SECRET,
      maxAge: 60 * 60,
    });

    expect(await getCurrentUserId()).toBe(user.id);
  });
});
