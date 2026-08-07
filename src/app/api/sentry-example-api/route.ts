/**
 * Sentry verification only — throws on purpose so a server-side error can be
 * confirmed in the Sentry dashboard. Not linked from the app; visit directly.
 * Safe to delete once Sentry is confirmed working (see /sentry-example-page).
 */
export async function GET() {
  throw new Error("Sentry Example API Route Error");
}
