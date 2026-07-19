import { NextResponse } from "next/server";
import type { z } from "zod";

import { getCurrentUserId } from "@/lib/session";
import { requireAccess } from "@/lib/subscription";

/**
 * Shared request plumbing for API routes. Both helpers return a ready
 * NextResponse on failure so callers can bail with a single instanceof
 * check, keeping the response shapes identical across every route:
 *   401 { error: "Unauthorized" }
 *   402 { error: "Subscription required", code: "TRIAL_EXPIRED" }
 *   400 { error: "Invalid JSON" }
 *   400 { error: "Invalid input", details: <zod flatten> }
 */

/**
 * Structured server-side error log: one JSON line per error so a log
 * aggregator (or `docker logs | grep '"level":"error"'`) can parse it.
 * Never include request bodies or emails — userId only.
 */
export function logApiError(route: string, error: unknown, userId?: string) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    JSON.stringify({
      level: "error",
      time: new Date().toISOString(),
      route,
      userId: userId ?? null,
      message: err.message,
      stack: err.stack,
    })
  );
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Resolve the session user id, or a ready 401 response. */
export async function requireUser(): Promise<string | NextResponse> {
  const userId = await getCurrentUserId();
  return userId ?? unauthorized();
}

/**
 * Resolve + subscribe-gate in one call. Returns 401 on no session,
 * 402 on expired trial. Use this for paid/study-only routes (e.g.
 * /api/study/*). Routes that must stay open after trial expiry
 * (export, account, list/word management, dashboard, settings)
 * call `requireUser` directly — see `subscription.ts:requireAccess`
 * for the canonical boundary.
 *
 * The single-call form keeps the lazy developer on the secure path:
 * copy-pasting from any paywalled route already includes the gate,
 * with no separate `requireAccess` line to remember.
 */
export async function requirePaidUser(): Promise<string | NextResponse> {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const denied = await requireAccess(userId);
  if (denied) return denied;
  return userId;
}

/** Parse and validate a JSON body, or a ready 400 response. */
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S
): Promise<z.infer<S> | NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  return parsed.data;
}
