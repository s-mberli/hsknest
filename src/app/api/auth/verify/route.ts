import { createHash } from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTokenSchema } from "@/lib/validation";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Email verification (soft, non-blocking): sets User.emailVerified when the
 * token is valid. Never gates login/study — guests can't verify and hard
 * gating would break the one-click demo.
 */
export async function GET(request: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`verify:${ip}`, 20, 60 * 1000)) {
    return NextResponse.redirect(new URL("/login?verify=error", base));
  }

  const { searchParams } = new URL(request.url);
  const parsed = verifyTokenSchema.safeParse({
    token: searchParams.get("token"),
  });
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login?verify=error", base));
  }

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });

  if (!record || record.expires < new Date()) {
    if (record) {
      await prisma.verificationToken.delete({ where: { id: record.id } });
    }
    return NextResponse.redirect(new URL("/login?verify=error", base));
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.email },
      data: { emailVerified: new Date() },
    }),
    // Single-use: clear all outstanding verification tokens for this email.
    prisma.verificationToken.deleteMany({ where: { email: record.email } }),
  ]);

  return NextResponse.redirect(new URL("/login?verify=success", base));
}
