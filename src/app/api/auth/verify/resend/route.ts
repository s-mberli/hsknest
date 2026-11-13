import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";

import { logApiError, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/email";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  if (!rateLimit(`verify-resend:${userId}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ message: "Already verified." });
  }

  try {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    // Create the new link first and retire older links only once the email
    // has gone out. If the daily cap or the provider skips delivery, the link
    // the user already received keeps working.
    const created = await prisma.verificationToken.create({
      data: {
        email: user.email,
        token: tokenHash,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      select: { createdAt: true },
    });
    const sent = await sendVerificationEmail(user.email, token);
    if (!sent.success) {
      await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
      if ("capped" in sent && sent.capped) {
        return NextResponse.json(
          { error: "Too many verification emails right now. Please try again later." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Could not send verification email" },
        { status: 500 }
      );
    }
    // Retire only links created before this one. Two overlapping resends
    // (two open tabs) must not delete each other's link; the newest survives.
    await prisma.verificationToken.deleteMany({
      where: { email: user.email, createdAt: { lt: created.createdAt } },
    });

    return NextResponse.json({ message: "Verification email sent." });
  } catch (error) {
    logApiError("/api/auth/verify/resend", error, userId);
    return NextResponse.json(
      { error: "Could not send verification email" },
      { status: 500 }
    );
  }
}
