import { hash } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { signupSchema } from "@/lib/validation";
import { sendVerificationEmail } from "@/lib/email";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  // 5 signups per hour per IP. x-forwarded-for's first hop is the client when
  // behind a trusted proxy; fall back to "unknown" when the header is absent.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many signups from this network — please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;
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
    data: { email: normalizedEmail, passwordHash, name },
    select: { id: true },
  });

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
