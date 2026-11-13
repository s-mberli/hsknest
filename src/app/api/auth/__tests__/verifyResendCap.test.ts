/**
 * Resend reports the global verification cap instead of claiming success,
 * and never invalidates a link the user already has unless a new email
 * actually went out.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const CREATED_AT = vi.hoisted(() => new Date("2026-11-13T02:00:00Z"));
const db = vi.hoisted(() => ({
  create: vi.fn(async () => ({ createdAt: CREATED_AT })),
  deleteMany: vi.fn(async () => ({ count: 0 })),
}));
const sendVerificationEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: () => true }));
vi.mock("@/lib/email", () => ({ sendVerificationEmail }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: async () => ({ email: "learner@example.com", emailVerified: null }) },
    verificationToken: { create: db.create, deleteMany: db.deleteMany },
  },
}));

import { POST } from "@/app/api/auth/verify/resend/route";

beforeEach(() => {
  db.create.mockClear();
  db.deleteMany.mockClear();
  sendVerificationEmail.mockReset();
});

function newTokenHash(): string {
  const calls = db.create.mock.calls as unknown as [{ data: { token: string } }][];
  return calls[0][0].data.token;
}

describe("POST /api/auth/verify/resend", () => {
  it("returns 429 at the daily cap and keeps the earlier link valid", async () => {
    sendVerificationEmail.mockResolvedValue({ success: false, capped: true });

    const res = await POST();

    expect(res.status).toBe(429);
    // Only the unsent new token is removed; nothing keyed on the email.
    expect(db.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { token: newTokenHash() } });
  });

  it("returns 500 when delivery fails and keeps the earlier link valid", async () => {
    sendVerificationEmail.mockResolvedValue({ success: false, error: new Error("down") });

    const res = await POST();

    expect(res.status).toBe(500);
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { token: newTokenHash() } });
    expect(db.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("retires only links created before the new one, after it is sent", async () => {
    sendVerificationEmail.mockResolvedValue({ success: true, data: null });

    const res = await POST();

    expect(res.status).toBe(200);
    // Strictly older: an overlapping resend's newer link is left alone.
    expect(db.deleteMany).toHaveBeenCalledWith({
      where: { email: "learner@example.com", createdAt: { lt: CREATED_AT } },
    });
  });
});
