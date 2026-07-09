import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { getDashboardStats } from "@/lib/stats";

export async function GET() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const stats = await getDashboardStats(userId);
  return NextResponse.json(stats);
}
