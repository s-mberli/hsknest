import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

// Re-exported for historical import sites; the pure helper lives in its own
// module so standalone scripts (no Next.js server context) can import it too.
export { isSelfHosted } from "@/lib/selfHosted";
import { isSelfHosted } from "@/lib/selfHosted";

/**
 * Hosted-plan access control. The entire module is a no-op when the
 * deployment is self-hosted: SELF_HOSTED=true (the default shipped in
 * .env.example and docker-compose) means every account always has access
 * and no trial/billing UI ever appears. Only the managed instance sets
 * SELF_HOSTED=false.
 */

export const TRIAL_DAYS = 14;

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
  if (user.subscriptionStatus === "active" || user.subscriptionStatus === "past_due") return true;
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
 * Pull the caller's subscription straight from Stripe and update our DB — a
 * fallback for the webhook so returning from Checkout reflects the new status
 * immediately even if the webhook is delayed or misconfigured. Best-effort:
 * the webhook stays the source of truth for later changes (cancel, past_due).
 * No-op when self-hosted or the user has no Stripe customer / subscription.
 */
export async function syncSubscriptionFromStripe(userId: string): Promise<void> {
  if (isSelfHosted()) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) return;
  try {
    const subs = await getStripe().subscriptions.list({
      customer: user.stripeCustomerId,
      status: "all",
      limit: 3,
    });
    if (subs.data.length === 0) return;
    const statuses = subs.data.map((s) => s.status);
    const status = statuses.some((s) => s === "active" || s === "trialing")
      ? "active"
      : statuses.some((s) => s === "past_due" || s === "unpaid")
        ? "past_due"
        : "canceled";
    await prisma.user.updateMany({
      where: { id: userId },
      data: { subscriptionStatus: status },
    });
  } catch {
    // Sync is best-effort; never block the page render on a Stripe hiccup.
  }
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
