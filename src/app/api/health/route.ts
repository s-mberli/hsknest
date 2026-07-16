import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/** Uptime-monitor endpoint: 200 + DB round-trip, no auth, no caching. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
