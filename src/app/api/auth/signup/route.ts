import { hash } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { parseBody } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { signupSchema } from "@/lib/validation";
import { sendVerificationEmail } from "@/lib/email";
import { TRIAL_DAYS } from "@/lib/subscription";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  // 5 signups per hour per IP. x-forwarded-for's first hop is the client when
  // behind a trusted proxy; fall back to "unknown" when the header is absent.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Global fallback cap on top of per-IP: X-Forwarded-For can be spoofed if
  // the container is ever reached without the trusted proxy in front, so
  // bound total signup volume too (generous vs. any real launch spike).
  if (
    !rateLimit(`signup:${ip}`, 500, 60 * 60 * 1000) ||
    !rateLimit("signup:global", 10000, 60 * 60 * 1000)
  ) {
    return NextResponse.json(
      { error: "Too many signups from this network — please try again later." },
      { status: 429 }
    );
  }

  const parsed = await parseBody(req, signupSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { email, password, name } = parsed;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
    },
    select: { id: true },
  }).catch((err) => {
    // Race condition between findUnique and create: two concurrent signups
    // with the same email can both pass the uniqueness check. Prisma throws
    // P2002 on the second create — map to 409 instead of 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return null;
    }
    throw err;
  });
  if (!user) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  // Fire-and-forget verification email — never block signup on email delivery.
  // (Not sent for guest accounts, which are created via /api/auth/guest.)
  const token = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      email: normalizedEmail,
      token: hashToken(token),
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });
  sendVerificationEmail(normalizedEmail, token).catch((err) => {
    console.error("Failed to send verification email:", err);
  });

  return NextResponse.json({ userId: user.id }, { status: 201 });
}
