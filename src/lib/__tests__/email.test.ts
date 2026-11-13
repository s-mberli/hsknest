/**
 * Email delivery contract: what each message sends through Resend, how
 * provider errors are reported, and the console fallback rules (allowed on
 * self-hosted instances, refused on the hosted one so live links never reach
 * an aggregated log stream).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

type EmailModule = typeof import("@/lib/email");

async function loadEmail(env: { resendKey?: string; selfHosted: boolean }): Promise<EmailModule> {
  vi.resetModules();
  vi.stubEnv("RESEND_API_KEY", env.resendKey ?? "");
  vi.stubEnv("SELF_HOSTED", env.selfHosted ? "true" : "false");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
  vi.stubEnv("VERIFICATION_EMAIL_DAILY_CAP", "");
  return import("@/lib/email");
}

beforeEach(() => {
  send.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("with Resend configured", () => {
  it("sends a password reset link to the address", async () => {
    send.mockResolvedValue({ data: { id: "m1" }, error: null });
    const email = await loadEmail({ resendKey: "re_test", selfHosted: false });

    const result = await email.sendPasswordResetEmail("a@example.com", "tok123");

    expect(result).toEqual({ success: true, data: { id: "m1" } });
    const msg = send.mock.calls[0][0];
    expect(msg.to).toBe("a@example.com");
    expect(msg.subject).toMatch(/reset/i);
    expect(msg.html).toContain("https://example.test/reset-password?token=tok123");
  });

  it("sends a verification link", async () => {
    send.mockResolvedValue({ data: { id: "m2" }, error: null });
    const email = await loadEmail({ resendKey: "re_test", selfHosted: false });

    const result = await email.sendVerificationEmail("b@example.com", "vtok");

    expect(result.success).toBe(true);
    expect(send.mock.calls[0][0].html).toContain("vtok");
  });

  it.each([
    ["trial_welcome", /welcome/i],
    ["trial_ending", /ends in 3 days/i],
    ["trial_ended", /ended/i],
  ] as const)("sends the %s trial email", async (kind, subject) => {
    send.mockResolvedValue({ data: { id: "t" }, error: null });
    const email = await loadEmail({ resendKey: "re_test", selfHosted: false });

    const result = await email.sendTrialEmail("c@example.com", kind, 3);

    expect(result.success).toBe(true);
    expect(send.mock.calls[0][0].subject).toMatch(subject);
  });

  it("sends the lifecycle emails to the given address", async () => {
    send.mockResolvedValue({ data: { id: "x" }, error: null });
    const email = await loadEmail({ resendKey: "re_test", selfHosted: false });

    await email.sendDeclineNudgeEmail("d@example.com");
    await email.sendCancellationSurveyEmail("d@example.com");
    await email.sendUpgradeConfirmationEmail("d@example.com");

    expect(send).toHaveBeenCalledTimes(3);
    for (const [msg] of send.mock.calls) expect(msg.to).toBe("d@example.com");
  });

  it("sends the daily reminder with study link and one-click unsubscribe", async () => {
    send.mockResolvedValue({ data: { id: "r" }, error: null });
    const email = await loadEmail({ resendKey: "re_test", selfHosted: false });
    const unsub = "https://example.test/api/unsubscribe?u=u1&t=tok";

    const result = await email.sendDailyReminderEmail("r@example.com", {
      dueCount: 12,
      streakDays: 4,
      unsubscribeUrl: unsub,
    });

    expect(result.success).toBe(true);
    const msg = send.mock.calls[0][0];
    expect(msg.subject).toBe("12 cards ready to review");
    expect(msg.html).toContain("Current streak: 4 days.");
    expect(msg.html).toContain("https://example.test/study");
    expect(msg.html).toContain(unsub);
    expect(msg.headers).toEqual({
      "List-Unsubscribe": `<${unsub}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("reports a provider error without throwing", async () => {
    send.mockResolvedValue({ data: null, error: { message: "rejected" } });
    const email = await loadEmail({ resendKey: "re_test", selfHosted: false });

    const results = await Promise.all([
      email.sendPasswordResetEmail("e@example.com", "t"),
      email.sendVerificationEmail("e@example.com", "t"),
      email.sendTrialEmail("e@example.com", "trial_welcome"),
      email.sendDeclineNudgeEmail("e@example.com"),
      email.sendCancellationSurveyEmail("e@example.com"),
      email.sendUpgradeConfirmationEmail("e@example.com"),
    ]);

    for (const r of results) expect(r.success).toBe(false);
  });

  it("reports a thrown provider failure without throwing", async () => {
    send.mockRejectedValue(new Error("network down"));
    const email = await loadEmail({ resendKey: "re_test", selfHosted: false });

    const results = await Promise.all([
      email.sendPasswordResetEmail("f@example.com", "t"),
      email.sendVerificationEmail("f@example.com", "t"),
      email.sendTrialEmail("f@example.com", "trial_ended"),
      email.sendDeclineNudgeEmail("f@example.com"),
      email.sendCancellationSurveyEmail("f@example.com"),
      email.sendUpgradeConfirmationEmail("f@example.com"),
    ]);

    for (const r of results) expect(r.success).toBe(false);
  });
});

describe("without Resend", () => {
  it("logs links to the console on a self-hosted instance", async () => {
    const email = await loadEmail({ selfHosted: true });

    const results = await Promise.all([
      email.sendPasswordResetEmail("g@example.com", "rtok"),
      email.sendVerificationEmail("g@example.com", "vtok"),
      email.sendTrialEmail("g@example.com", "trial_welcome"),
      email.sendDeclineNudgeEmail("g@example.com"),
      email.sendCancellationSurveyEmail("g@example.com"),
      email.sendUpgradeConfirmationEmail("g@example.com"),
    ]);

    for (const r of results) expect(r.success).toBe(true);
    const logged = vi.mocked(console.log).mock.calls.map(([line]) => String(line)).join("\n");
    expect(logged).toContain("reset-password?token=rtok");
    expect(logged).toContain("vtok");
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses to log reset and verification links on the hosted instance", async () => {
    const email = await loadEmail({ selfHosted: false });

    const reset = await email.sendPasswordResetEmail("h@example.com", "secret-reset");
    const verify = await email.sendVerificationEmail("h@example.com", "secret-verify");

    expect(reset.success).toBe(false);
    expect(verify.success).toBe(false);
    const logged = vi.mocked(console.log).mock.calls.map(([line]) => String(line)).join("\n");
    expect(logged).not.toContain("secret-reset");
    expect(logged).not.toContain("secret-verify");
  });
});

describe("verificationDailyCap", () => {
  it("uses a positive integer from the environment, else the default", async () => {
    const email = await loadEmail({ selfHosted: true });
    expect(email.verificationDailyCap()).toBe(200);
    vi.stubEnv("VERIFICATION_EMAIL_DAILY_CAP", "25");
    expect(email.verificationDailyCap()).toBe(25);
    vi.stubEnv("VERIFICATION_EMAIL_DAILY_CAP", "-3");
    expect(email.verificationDailyCap()).toBe(200);
  });
});
