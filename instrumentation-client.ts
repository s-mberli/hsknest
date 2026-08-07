/**
 * Sentry client-side config for browser errors + tracing. Initialize only if
 * DSN is set. Runs in the browser and captures client-side exceptions, session
 * replays, and distributed traces (browserTracingIntegration links the browser
 * span to the server span for the same request).
 */

import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // 10% of transactions traced. Raise toward 1.0 for full capture while
    // debugging; keep it low in steady-state prod to bound event volume.
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Only propagate trace headers to our own origin (same-origin /api/*),
    // never to third parties — avoids the browser CORS issues the Sentry docs
    // warn about.
    tracePropagationTargets: ["localhost", /^\//],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Instruments client-side navigations (App Router transitions) as spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
