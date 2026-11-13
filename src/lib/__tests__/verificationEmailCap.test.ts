/**
 * One process-wide daily cap on verification emails, so signup, guest
 * upgrade, guest checkout and resend together can't drain the email
 * provider's quota or mail strangers in bulk.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/selfHosted", () => ({ isSelfHosted: () => true }));

import { _resetRateLimits } from "@/lib/rateLimit";
import { sendVerificationEmail, verificationDailyCap } from "@/lib/email";

beforeEach(() => {
  _resetRateLimits();
  // Self-hosted without RESEND_API_KEY: links go to the console fallback.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("verification email daily cap", () => {
  it("defaults to 200 and reads VERIFICATION_EMAIL_DAILY_CAP", () => {
    expect(verificationDailyCap()).toBe(200);
    vi.stubEnv("VERIFICATION_EMAIL_DAILY_CAP", "3");
    expect(verificationDailyCap()).toBe(3);
    vi.stubEnv("VERIFICATION_EMAIL_DAILY_CAP", "nonsense");
    expect(verificationDailyCap()).toBe(200);
  });

  it("stops sending once the cap is reached, across recipients", async () => {
    vi.stubEnv("VERIFICATION_EMAIL_DAILY_CAP", "2");
    expect((await sendVerificationEmail("a@example.com", "t1")).success).toBe(true);
    expect((await sendVerificationEmail("b@example.com", "t2")).success).toBe(true);
    const third = await sendVerificationEmail("c@example.com", "t3");
    expect(third).toMatchObject({ success: false, capped: true });
    // The capped send never reaches the delivery path.
    expect(console.log).toHaveBeenCalledTimes(2);
  });
});
