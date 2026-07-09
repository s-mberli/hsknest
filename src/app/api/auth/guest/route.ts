import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";

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
    data: { email, passwordHash, name: "Guest" },
    select: { id: true },
  });

  // Auto-enroll a sensible starter list: prefer "Everyday Spanish Starter" or
  // "HSK 1 — Foundation" by name, falling back to the smallest seeded list.
  const seededLists = await prisma.wordList.findMany({
    where: { createdById: null, isPublic: true },
    select: { id: true, name: true, _count: { select: { words: true } } },
  });
  let starter = seededLists.find((l) => l.name === "Everyday Spanish Starter");
  if (!starter) {
    starter = seededLists.find((l) => l.name === "HSK 1 — Foundation");
  }
  if (!starter) {
    starter = seededLists
      .filter((l) => l._count.words > 0)
      .sort((a, b) => a._count.words - b._count.words)[0];
  }

  if (starter) {
    const words = await prisma.word.findMany({
      where: { wordListId: starter.id },
      select: { id: true },
    });
    const now = new Date();
    await prisma.userProgress.createMany({
      data: words.map((w) => ({ userId: user.id, wordId: w.id, dueAt: now })),
    });
  }

  return NextResponse.json({ email, password }, { status: 201 });
}
