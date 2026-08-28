import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { getDashboardStats } from "@/lib/stats";
import { rateLimit } from "@/lib/rateLimit";

export async function GET() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  // Rate-limit expensive dashboard aggregation: 60 per user per hour
  if (!rateLimit(`dashboard:${userId}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Dashboard rate limited — try again in a moment" },
      { status: 429 }
    );
  }

  const stats = await getDashboardStats(userId);
  return NextResponse.json(stats);
}
