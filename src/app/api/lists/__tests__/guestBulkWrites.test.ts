/**
 * Guests are anonymous and free to create, so per-account limits don't bound
 * how many rows one client can write. CSV import and multi-word add need a
 * saved account; a guest can still add words one at a time.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  email: "guest-abc@guest.local",
  createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
}));

vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn(() => true) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => ({ email: mocks.email })) },
    wordList: { findFirst: vi.fn(async () => ({ createdById: "user-1" })) },
    word: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      createMany: mocks.createMany,
    },
  },
}));

import { rateLimit } from "@/lib/rateLimit";
import { POST as importPOST } from "@/app/api/lists/[id]/import/route";
import { POST as wordsPOST } from "@/app/api/lists/[id]/words/route";

const params = { params: Promise.resolve({ id: "list-1" }) };

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/lists/list-1/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const twoWords = {
  words: [
    { term: "你好", translation: "hello" },
    { term: "谢谢", translation: "thank you" },
  ],
};

beforeEach(() => {
  mocks.email = "guest-abc@guest.local";
  mocks.createMany.mockClear();
  vi.mocked(rateLimit).mockClear();
});

describe("guest bulk writes", () => {
  it("refuses a guest import before consuming its rate limit", async () => {
    const res = await importPOST(jsonRequest({ text: "你好\thello" }), params);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Save your account first to import words" });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("refuses a guest bulk word add", async () => {
    const res = await wordsPOST(jsonRequest(twoWords), params);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Save your account first to import words" });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("still lets a guest add a single word", async () => {
    const res = await wordsPOST(jsonRequest({ term: "你好", translation: "hello" }), params);
    expect(res.status).toBe(201);
    expect(mocks.createMany).toHaveBeenCalledOnce();
  });

  it("lets a saved account import and bulk-add", async () => {
    mocks.email = "learner@example.com";
    expect((await importPOST(jsonRequest({ text: "你好\thello" }), params)).status).toBe(200);
    expect((await wordsPOST(jsonRequest(twoWords), params)).status).toBe(201);
    expect(mocks.createMany).toHaveBeenCalledTimes(2);
  });
});
