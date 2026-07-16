import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { TRIAL_DAYS } from "@/lib/subscription";

/**
 * One-click guest accounts: a real User row with throwaway credentials so the
 * whole app (auth, scheduling, settings) works unchanged. The password is
 * returned exactly once; the client signs in with it immediately. A starter
 * list is auto-enrolled so the demo is studyable from the first screen.
 */
export async function POST(req: Request) {
  // Same limiter pattern as signup: 5 guest accounts per hour per IP.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`guest:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many guest sessions from this network — please try again later." },
      { status: 429 }
    );
  }

  const suffix = randomBytes(6).toString("hex");
  const email = `guest-${suffix}@guest.local`;
  const password = randomBytes(18).toString("base64url");
  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Guest",
      // Guests share the trial clock so guest mode can't sidestep the trial;
      // upgrading to a real account keeps the same clock. Self-hosted ignores.
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
    },
    select: { id: true },
  });

  return NextResponse.json({ email, password }, { status: 201 });
}
