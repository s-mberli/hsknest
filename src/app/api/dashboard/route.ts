import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/session";
import { getDashboardStats } from "@/lib/stats";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getDashboardStats(userId);
  return NextResponse.json(stats);
}
