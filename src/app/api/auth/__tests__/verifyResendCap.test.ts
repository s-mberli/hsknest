/** Resend reports the global verification cap instead of claiming success. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: () => true }));
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn(async () => ({ success: false, capped: true })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: async () => ({ email: "learner@example.com", emailVerified: null }) },
    verificationToken: { deleteMany: () => ({}), create: () => ({}) },
    $transaction: async () => [],
  },
}));

import { POST } from "@/app/api/auth/verify/resend/route";

describe("POST /api/auth/verify/resend", () => {
  it("returns 429 when the daily verification cap is reached", async () => {
    const res = await POST();
    expect(res.status).toBe(429);
  });
});
