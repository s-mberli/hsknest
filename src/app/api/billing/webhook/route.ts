import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { logApiError } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { isSelfHosted } from "@/lib/subscription";

/**
 * Stripe webhook: the single source of truth for subscription state.
 * Signature-verified against the raw body; no auth session (Stripe calls
 * this server-to-server).
 */
export async function POST(req: Request) {
  if (isSelfHosted()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    logApiError("/api/billing/webhook:verify", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (userId && session.mode === "subscription") {
          // updateMany: a deleted account must not 500-loop Stripe retries.
          await prisma.user.updateMany({
            where: { id: userId },
            data: {
              subscriptionStatus: "active",
              stripeCustomerId:
                typeof session.customer === "string"
                  ? session.customer
                  : undefined,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        // Map Stripe's status vocabulary onto ours. "canceled at period
        // end" still reports active until the period actually ends.
        const status =
          sub.status === "active" || sub.status === "trialing"
            ? "active"
            : sub.status === "past_due" || sub.status === "unpaid"
              ? "past_due"
              : "canceled";
        if (userId) {
          await prisma.user.updateMany({
            where: { id: userId },
            data: { subscriptionStatus: status },
          });
        } else if (typeof sub.customer === "string") {
          await prisma.user.updateMany({
            where: { stripeCustomerId: sub.customer },
            data: { subscriptionStatus: status },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await prisma.user.updateMany({
            where: { id: userId },
            data: { subscriptionStatus: "canceled" },
          });
        } else if (typeof sub.customer === "string") {
          await prisma.user.updateMany({
            where: { stripeCustomerId: sub.customer },
            data: { subscriptionStatus: "canceled" },
          });
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (error) {
    logApiError(`/api/billing/webhook:${event.type}`, error);
    // 500 → Stripe retries with backoff, which is what we want for a
    // transient DB failure.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
