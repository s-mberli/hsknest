/**
 * Sentry server-side config for Next.js 16. Initialize only if DSN is set;
 * self-hosters who don't set SENTRY_DSN won't send any data.
 */

import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
