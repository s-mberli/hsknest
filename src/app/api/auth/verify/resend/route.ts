import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getCurrentUserId } from "@/lib/session";
import { sendVerificationEmail } from "@/lib/email";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const token = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { email: user.email } }),
    prisma.verificationToken.create({
      data: {
        email: user.email,
        token: hashToken(token),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  await sendVerificationEmail(user.email, token);

  return NextResponse.json({ message: "Verification email sent." });
}
