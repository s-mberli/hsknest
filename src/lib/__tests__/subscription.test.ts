import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
