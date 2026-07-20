import { NextResponse } from "next/server";

import { logApiError, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getStripe } from "@/lib/stripe";
import { isSelfHosted } from "@/lib/subscription";

/**
 * Start a Stripe Checkout session for the hosted plan. The client sends
 * the user here after they tick the EU withdrawal-right acknowledgment;
 * we stamp billingConsentAt before redirecting.
 */
export async function POST(req: Request) {
  if (isSelfHosted()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  if (!rateLimit(`billing:${userId}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let interval = "monthly";
  try {
    const body = await req.json();
    if (body.interval === "yearly") {
      interval = "yearly";
    }
  } catch {
    // ignore missing/invalid body, default to monthly
  }

  const priceId =
    interval === "yearly"
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : (process.env.STRIPE_PRICE_ID_MONTHLY ?? process.env.STRIPE_PRICE_ID); // fallback for existing deployments

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!priceId) {
    return NextResponse.json(
      { error: "Billing is not configured for this interval" },
      { status: 503 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A guest has throwaway @guest.local credentials and no way to log back
    // in. Paying now would orphan the subscription on an unreachable account,
    // so require a real account (email + password) first — same userId, so
    // all their progress carries straight over.
    if (user.email.endsWith("@guest.local")) {
      return NextResponse.json(
        {
          error: "Create your account before subscribing.",
          code: "GUEST_MUST_UPGRADE",
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Reuse the Stripe customer across checkout attempts.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // The Upgrade button's consent checkbox is required client-side; the
    // timestamp is the durable record (EU withdrawal-right acknowledgment).
    await prisma.user.update({
      where: { id: userId },
      data: { billingConsentAt: new Date() },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/settings?billing=canceled`,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logApiError("/api/billing/checkout", error, userId);
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 500 }
    );
  }
}
