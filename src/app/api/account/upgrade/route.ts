import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { parseBody, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { signupSchema } from "@/lib/validation";

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
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: normalizedEmail,
      passwordHash,
      ...(name ? { name } : { name: null }),
    },
  });

  return NextResponse.json({ email: normalizedEmail });
}
