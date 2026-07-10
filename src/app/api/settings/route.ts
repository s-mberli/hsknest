import { NextResponse } from "next/server";

import { parseBody, requireUser, unauthorized } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { settingsSchema } from "@/lib/validation";

export async function GET() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferredAlgorithm: true,
      name: true,
      email: true,
      dailyNewWords: true,
      assumedCheckPerDay: true,
      intervalModifier: true,
      lapseModifier: true,
      masteryThresholdDays: true,
      fuzzIntervals: true,
      theme: true,
      studyTheme: true,
      cardTextSize: true,
      showReading: true,
      soundEffects: true,
      desiredRetention: true,
      targetLanguageId: true,
    },
  });
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const parsed = await parseBody(req, settingsSchema);
  if (parsed instanceof NextResponse) return parsed;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: parsed,
    select: {
      preferredAlgorithm: true,
      name: true,
      email: true,
      dailyNewWords: true,
      assumedCheckPerDay: true,
      intervalModifier: true,
      lapseModifier: true,
      masteryThresholdDays: true,
      fuzzIntervals: true,
      theme: true,
      studyTheme: true,
      cardTextSize: true,
      showReading: true,
      soundEffects: true,
      desiredRetention: true,
      targetLanguageId: true,
    },
  });

  return NextResponse.json(updated);
}
