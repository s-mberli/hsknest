import { hash } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { logApiError, parseBody, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getStripe } from "@/lib/stripe";
import { isSelfHosted } from "@/lib/subscription";
import { sendVerificationEmail } from "@/lib/email";
import { guestCheckoutSchema } from "@/lib/validation";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  if (isSelfHosted()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  if (!rateLimit(`billing:${userId}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const parsed = await parseBody(req, guestCheckoutSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { email, password, name, interval } = parsed;
  const normalizedEmail = email.trim().toLowerCase();
  
  if (normalizedEmail.endsWith("@guest.local")) {
    return NextResponse.json(
      { error: "Please use a real email address." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true },
  });
  if (!user || !user.email.endsWith("@guest.local")) {
    return NextResponse.json(
      { error: "Only guest accounts can be upgraded." },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
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
    const passwordHash = await hash(password, 12);
    const tokenStr = randomBytes(32).toString("hex");

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: normalizedEmail,
          passwordHash,
          ...(name ? { name } : {}),
          billingConsentAt: new Date(),
        },
      });

      await tx.verificationToken.create({
        data: {
          email: normalizedEmail,
          token: hashToken(tokenStr),
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        },
      });
    });

    sendVerificationEmail(normalizedEmail, tokenStr).catch((err) => {
      console.error("Failed to send verification email:", err);
    });

    const stripe = getStripe();
    let customerId = user.stripeCustomerId;

    if (customerId) {
      await stripe.customers.update(customerId, { email: normalizedEmail });
    } else {
      const customer = await stripe.customers.create({
        email: normalizedEmail,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    logApiError("/api/billing/guest-checkout", error, userId);
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 500 }
    );
  }
}
