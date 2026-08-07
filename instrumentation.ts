/**
 * Next.js 16 instrumentation hook for Sentry. Captures uncaught errors from
 * the server, RSC rendering, and request-level exceptions. No-op when
 * SENTRY_DSN is unset — self-hosters are unaffected (the config files below
 * only call Sentry.init() when the DSN is present, so the SDK stays dormant
 * and captureRequestError becomes a no-op).
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Canonical Next.js error hook — Sentry's purpose-built handler attaches the
// request context (path, method, router/route type) and flushes the event on
// the long-running server. Fires for uncaught errors in route handlers, RSC
// rendering, and server actions.
export const onRequestError = Sentry.captureRequestError;
