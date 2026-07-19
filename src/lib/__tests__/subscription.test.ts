import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isSelfHosted } from "@/lib/selfHosted";
import { hasAccess, trialDaysLeft } from "@/lib/subscription";

const NOW = new Date("2026-07-15T12:00:00Z");
const IN_5_DAYS = new Date("2026-07-20T12:00:00Z");
const YESTERDAY = new Date("2026-07-14T12:00:00Z");

describe("hasAccess (hosted mode, SELF_HOSTED=false)", () => {
  const original = process.env.SELF_HOSTED;
  beforeEach(() => {
    process.env.SELF_HOSTED = "false";
  });
  afterEach(() => {
    process.env.SELF_HOSTED = original;
  });

  it("grants access during an active trial", () => {
    expect(
      hasAccess({ subscriptionStatus: "trialing", trialEndsAt: IN_5_DAYS }, NOW)
    ).toBe(true);
  });

  it("denies access once the trial clock has passed", () => {
    expect(
      hasAccess({ subscriptionStatus: "trialing", trialEndsAt: YESTERDAY }, NOW)
    ).toBe(false);
  });

  it("treats a trialing user without a clock as in-trial (grandfathered)", () => {
    expect(
      hasAccess({ subscriptionStatus: "trialing", trialEndsAt: null }, NOW)
    ).toBe(true);
  });

  it("grants access to active subscribers regardless of trial clock", () => {
    expect(
      hasAccess({ subscriptionStatus: "active", trialEndsAt: YESTERDAY }, NOW)
    ).toBe(true);
  });

  it("denies canceled and past_due", () => {
    expect(
      hasAccess({ subscriptionStatus: "canceled", trialEndsAt: null }, NOW)
    ).toBe(false);
    expect(
      hasAccess({ subscriptionStatus: "past_due", trialEndsAt: IN_5_DAYS }, NOW)
    ).toBe(false);
  });

  it("counts whole trial days left, ceiling, floored at 0", () => {
    expect(
      trialDaysLeft(
        { subscriptionStatus: "trialing", trialEndsAt: IN_5_DAYS },
        NOW
      )
    ).toBe(5);
    expect(
      trialDaysLeft(
        { subscriptionStatus: "trialing", trialEndsAt: YESTERDAY },
        NOW
      )
    ).toBe(0);
    expect(
      trialDaysLeft({ subscriptionStatus: "active", trialEndsAt: null }, NOW)
    ).toBe(null);
  });
});

describe("hasAccess (self-hosted)", () => {
  const original = process.env.SELF_HOSTED;
  afterEach(() => {
    process.env.SELF_HOSTED = original;
  });

  it("always grants access when SELF_HOSTED=true", () => {
    process.env.SELF_HOSTED = "true";
    expect(
      hasAccess({ subscriptionStatus: "canceled", trialEndsAt: YESTERDAY }, NOW)
    ).toBe(true);
  });

  it("defaults to self-hosted when the env var is missing", () => {
    delete process.env.SELF_HOSTED;
    expect(
      hasAccess({ subscriptionStatus: "canceled", trialEndsAt: YESTERDAY }, NOW)
    ).toBe(true);
    expect(
      trialDaysLeft(
        { subscriptionStatus: "trialing", trialEndsAt: IN_5_DAYS },
        NOW
      )
    ).toBe(null);
  });
});

describe("isSelfHosted (case-insensitive)", () => {
  const original = process.env.SELF_HOSTED;
  afterEach(() => {
    process.env.SELF_HOSTED = original;
  });

  it("treats any casing of 'false' as hosted (paid) mode", () => {
    for (const v of ["false", "False", "FALSE", "  false  ", "fAlSe"]) {
      process.env.SELF_HOSTED = v;
      expect(isSelfHosted(), `for SELF_HOSTED=${JSON.stringify(v)}`).toBe(false);
    }
  });

  it("treats 'true', unset, and nonsense as self-hosted", () => {
    for (const v of ["true", "True", "", "no", "0", "1", " disabled "]) {
      process.env.SELF_HOSTED = v;
      // Only the exact (trimmed, case-insensitive) literal "false" flips to
      // hosted; every other value stays self-hosted so a typo can never
      // accidentally turn off billing on someone's own server.
      expect(isSelfHosted(), `for SELF_HOSTED=${JSON.stringify(v)}`).toBe(true);
    }
    delete process.env.SELF_HOSTED;
    expect(isSelfHosted()).toBe(true);
  });
});
