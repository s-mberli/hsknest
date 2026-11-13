/**
 * Upgrade and guest checkout both give a guest a real address and send it a
 * verification email. Guests are free to create, so besides the per-guest
 * limit they share one per-client-address bucket; without a trusted address
 * header that bucket is skipped (the global daily email cap still applies).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/subscription", () => ({ isSelfHosted: () => false }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    // A non-guest, so a request that gets past the limits stops at the guard.
    user: { findUnique: vi.fn(async () => ({ email: "learner@example.com" })) },
  },
}));

import { rateLimit } from "@/lib/rateLimit";
import { GUEST_SAVE_PER_SOURCE_PER_HOUR } from "@/lib/guestAccess";
import { POST as upgradePOST } from "@/app/api/account/upgrade/route";
import { POST as guestCheckoutPOST } from "@/app/api/billing/guest-checkout/route";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ email: "someone@example.com", password: "a-long-password-1", interval: "monthly" }),
  });
}

const keys = () => vi.mocked(rateLimit).mock.calls.map(([key]) => key);

beforeEach(() => {
  vi.mocked(rateLimit).mockReset();
  // Per-guest buckets pass; the per-address bucket is exhausted.
  vi.mocked(rateLimit).mockImplementation((key: string) => !key.startsWith("guest-save:"));
});

describe.each([
  { name: "upgrade", call: upgradePOST },
  { name: "guest-checkout", call: guestCheckoutPOST },
])("POST $name per-address limit", ({ call }) => {
  it("limits by client address on top of the per-guest bucket", async () => {
    const res = await call(request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith(
      "guest-save:203.0.113.7",
      GUEST_SAVE_PER_SOURCE_PER_HOUR,
      60 * 60 * 1000
    );
  });

  it("falls back to x-real-ip", async () => {
    const res = await call(request({ "x-real-ip": "198.51.100.4" }));
    expect(res.status).toBe(429);
    expect(keys()).toContain("guest-save:198.51.100.4");
  });

  it("skips the per-address bucket without a client address", async () => {
    const res = await call(request());
    // Reaches the guest-only guard instead of being rate limited.
    expect(res.status).toBe(403);
    expect(keys().some((k) => k.startsWith("guest-save:"))).toBe(false);
  });
});

it("upgrade and guest checkout share one per-address bucket", async () => {
  await upgradePOST(request({ "x-forwarded-for": "203.0.113.7" }));
  await guestCheckoutPOST(request({ "x-forwarded-for": "203.0.113.7" }));
  const saveKeys = keys().filter((k) => k.startsWith("guest-save:"));
  expect(saveKeys).toEqual(["guest-save:203.0.113.7", "guest-save:203.0.113.7"]);
});
