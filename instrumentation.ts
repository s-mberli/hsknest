/**
 * Next.js 16 instrumentation hook for Sentry. Captures uncaught errors from
 * the server, RSC rendering, and request-level exceptions. No-op when
 * SENTRY_DSN is unset — self-hosters are unaffected.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Optional: capture errors from failed requests. Called by Next.js when a
 * request throws an unhandled error.
 */
export async function onRequestError(
  error: Error
) {
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(error, {
    tags: {
      runtime: "edge-request",
    },
  });
}
