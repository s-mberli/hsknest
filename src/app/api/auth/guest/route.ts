import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { isGuestModeEnabled } from "@/lib/registration";
import { getCurrentUserId } from "@/lib/session";
import { TRIAL_DAYS } from "@/lib/subscription";

/**
 * One-click guest accounts: a real User row with throwaway credentials so the
 * whole app (auth, scheduling, settings) works unchanged. The password is
 * returned exactly once; the client signs in with it immediately. A starter
 * list is auto-enrolled so the demo is studyable from the first screen.
 */
export async function POST(req: Request) {
  // Guest mode is a hosted-only conversion funnel; a self-hosted instance
  // has no funnel to convert into, so it's disabled by default there.
  if (!isGuestModeEnabled()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  // Someone with a valid session (a guest coming back via /pricing or
  // /login) keeps it: issuing a new guest would replace their cookie and
  // strand the old guest's progress. getCurrentUserId also rejects revoked
  // sessions, which a client-side session check cannot see.
  if (await getCurrentUserId()) {
    return NextResponse.json({ existing: true });
  }

  // Per-source limit, only when a trusted proxy supplies the client address
  // (same rule as login in src/lib/auth.ts). Mobile carriers put many phones
  // behind one address, so the ceiling sits well above one person's use.
  // Without the header there is no per-source bucket at all: a shared
  // "unknown" key would cap the whole site at the per-source number.
  const source =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "";
  // The global cap bounds abuse when the per-source header is rotated or
  // absent, and stays far above a realistic launch-day burst.
  if (
    (source && !rateLimit(`guest:${source}`, 30, 60 * 60 * 1000)) ||
    !rateLimit("guest:global", 10000, 60 * 60 * 1000)
  ) {
    return NextResponse.json(
      { error: "Too many guest sessions from this network — please try again later." },
      { status: 429 }
    );
  }

  const suffix = randomBytes(6).toString("hex");
  const email = `guest-${suffix}@guest.local`;
  const password = randomBytes(18).toString("base64url");
  // The password is 144 random bits, so a slow hash adds no protection here,
  // only CPU per visitor. Upgrading re-hashes the real password at cost 12.
  const passwordHash = await hash(password, 4);

  await prisma.user.create({
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

  // Ensure a stable guestId cookie exists for analytics attribution
  const cookieStore = await cookies();
  let guestId = cookieStore.get("guestId")?.value;
  if (!guestId) {
    guestId = randomBytes(16).toString("hex");
    cookieStore.set("guestId", guestId, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false, // Accessible to client-side analytics
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return NextResponse.json({ email, password }, { status: 201 });
}
