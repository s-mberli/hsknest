/**
 * Sentry server-side config for Next.js 16. Initialize only if DSN is set
 * AND we're in production; self-hosters who don't set SENTRY_DSN won't send
 * any data, and `npm run dev` / local test runs never report either, even
 * with a DSN left in .env — avoids polluting the project with dev-machine
 * noise (Playwright/HeadlessChrome test runs, local debugging sessions).
 */

import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
