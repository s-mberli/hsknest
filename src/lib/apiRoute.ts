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
 *
 * Errors are also sent to Sentry if SENTRY_DSN is configured; self-hosters
 * who don't set the DSN will only see the JSON log output.
 */
export function logApiError(route: string, error: unknown, userId?: string) {
  const err = error instanceof Error ? error : new Error(String(error));

  // Structured JSON log (always emitted, for self-hosters and local dev)
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

  // Also send to Sentry if configured (no-op if SENTRY_DSN is unset)
  if (process.env.SENTRY_DSN) {
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(err, {
        tags: {
          route,
        },
        user: userId ? { id: userId } : undefined,
      });
    }).catch(() => {
      // Sentry capture failed; already logged to stdout, so we're fine.
    });
  }
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

/**
 * Like `parseBody`, but the body itself is optional — an empty request body
 * parses as `{}` instead of failing. `req.json()` throws on an empty body,
 * so routes where omitting the body is valid (e.g. "enroll the whole list")
 * can't use `parseBody` directly.
 */
export async function parseOptionalBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S
): Promise<z.infer<S> | NextResponse> {
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
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
