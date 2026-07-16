import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Hosted-plan access control. The entire module is a no-op when the
 * deployment is self-hosted: SELF_HOSTED=true (the default shipped in
 * .env.example and docker-compose) means every account always has access
 * and no trial/billing UI ever appears. Only the managed instance sets
 * SELF_HOSTED=false.
 */

export const TRIAL_DAYS = 14;

/** True when this deployment is a self-hosted install (no billing at all). */
export function isSelfHosted(): boolean {
  // Opt-in billing: anything other than an explicit "false" means self-hosted,
  // so a missing env var can never paywall someone's own server.
  return process.env.SELF_HOSTED !== "false";
}

export interface SubscriptionFields {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
}

/** Pure access predicate — unit-testable, no I/O. */
export function hasAccess(
  user: SubscriptionFields,
  now: Date = new Date()
): boolean {
  if (isSelfHosted()) return true;
  if (user.subscriptionStatus === "active") return true;
  if (user.subscriptionStatus === "trialing") {
    // No trial clock set (legacy/grandfathered rows) counts as in-trial.
    return user.trialEndsAt === null || user.trialEndsAt > now;
  }
  return false;
}

/** Whole days of trial left, floored at 0. Null when not applicable. */
export function trialDaysLeft(
  user: SubscriptionFields,
  now: Date = new Date()
): number | null {
  if (isSelfHosted() || user.subscriptionStatus !== "trialing") return null;
  if (user.trialEndsAt === null) return null;
  const ms = user.trialEndsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export interface SubscriptionInfo {
  /** True → no billing UI at all (self-hosted install). */
  selfHosted: boolean;
  status: string;
  trialEndsAt: Date | null;
  daysLeft: number | null;
  access: boolean;
  hasStripeCustomer: boolean;
}

/** Everything a server component needs to render billing UI in one query. */
export async function getSubscriptionInfo(
  userId: string
): Promise<SubscriptionInfo> {
  if (isSelfHosted()) {
    return {
      selfHosted: true,
      status: "active",
      trialEndsAt: null,
      daysLeft: null,
      access: true,
      hasStripeCustomer: false,
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      stripeCustomerId: true,
    },
  });
  if (!user) {
    return {
      selfHosted: false,
      status: "canceled",
      trialEndsAt: null,
      daysLeft: null,
      access: false,
      hasStripeCustomer: false,
    };
  }
  return {
    selfHosted: false,
    status: user.subscriptionStatus,
    trialEndsAt: user.trialEndsAt,
    daysLeft: trialDaysLeft(user),
    access: hasAccess(user),
    hasStripeCustomer: user.stripeCustomerId !== null,
  };
}

/**
 * Route guard for study/review APIs: resolve the caller's subscription and
 * return a ready 402 response when the trial is over and no plan is active.
 * Export/account routes must NOT use this — data access survives expiry.
 */
export async function requireAccess(
  userId: string
): Promise<NextResponse | null> {
  if (isSelfHosted()) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true, trialEndsAt: true },
  });
  if (!user || hasAccess(user)) return null;
  return NextResponse.json(
    {
      error: "Subscription required",
      code: "TRIAL_EXPIRED",
    },
    { status: 402 }
  );
}
