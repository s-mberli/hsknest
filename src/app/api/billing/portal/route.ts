import { NextResponse } from "next/server";

import { logApiError, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getStripe } from "@/lib/stripe";
import { isSelfHosted } from "@/lib/subscription";

/** Open the Stripe customer portal (cancel, update card, invoices). */
export async function POST() {
  if (isSelfHosted()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  if (!rateLimit(`billing:${userId}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account yet" },
        { status: 400 }
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logApiError("/api/billing/portal", error, userId);
    return NextResponse.json(
      { error: "Could not open billing portal" },
      { status: 500 }
    );
  }
}
