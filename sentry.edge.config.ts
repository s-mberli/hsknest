/**
 * Sentry edge-runtime config (for Middleware and edge functions).
 * Initialize only if DSN is set AND we're in production — see
 * sentry.server.config.ts for why the environment check matters.
 */

import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
