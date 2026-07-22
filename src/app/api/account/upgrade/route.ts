import { hash } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";

import { parseBody, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/email";
import { signupSchema } from "@/lib/validation";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Upgrade a guest account to a real one: set a chosen email + password on the
 * existing User row so every word, list, and review survives. Guest-only —
 * regular accounts change credentials elsewhere (future account settings).
 */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  if (!rateLimit(`upgrade:${userId}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many attempts — please try again later." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email.endsWith("@guest.local")) {
    return NextResponse.json(
      { error: "Only guest accounts can be upgraded." },
      { status: 403 }
    );
  }

  const parsed = await parseBody(req, signupSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { email, password, name } = parsed;
  const normalizedEmail = email.toLowerCase();
  if (normalizedEmail.endsWith("@guest.local")) {
    return NextResponse.json(
      { error: "Please use a real email address." },
      { status: 400 }
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

  const passwordHash = await hash(password, 12);
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: normalizedEmail,
        passwordHash,
        ...(name ? { name } : { name: null }),
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email is already registered. Please sign in instead." },
        { status: 409 }
      );
    }
    throw error;
  }

  // Fire-and-forget verification email — mirrors signup so upgraded users get
  // the same (soft, non-blocking) verify link instead of a dead-end banner.
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

  return NextResponse.json({ email: normalizedEmail });
}
