/**
 * Warms the dev server's per-route Turbopack compile before any test runs.
 *
 * In dev mode Next compiles each route on first request — pages AND API route
 * handlers alike. Heavy client routes (notably /dashboard — framer-motion,
 * charts, many components) can take ~25–30s to compile the first time, then
 * serve in <150ms. A test that is the first to hit such a route races that
 * cold compile and flakes (ERR_ABORTED / navigation timeout). Pre-fetching
 * every route here pays that cost once, up front, so the tests themselves
 * only ever see warm, fast responses.
 *
 * The NextAuth routes under /api/auth/* are included for the same reason:
 * they're compiled lazily too, and every test's first sign-in calls several
 * of them (csrf, providers, callback/credentials, session) via the client
 * signIn() helper. Without warming them, whichever test happens to run first
 * against a freshly-spawned server races that cold compile instead — the
 * symptom is a client-side signIn() reporting an error even though the
 * request would have succeeded a few hundred ms later, and which test trips
 * it varies run to run since it's whoever gets there first.
 *
 * No-op cost against a production build or an already-warm reused server:
 * each fetch just returns quickly.
 */
const ROUTES = [
  "/login",
  "/signup",
  "/dashboard", // the slow one — 307→/login unauthenticated, but still compiles
  "/onboarding",
  "/study",
  "/study/quiz",
  "/study/match",
  "/study/pronounce",
  "/study/sentences",
  "/study/ninja",
  "/lists",
  "/words",
  "/pricing",
];

/** GET-only NextAuth routes — safe to warm with a plain fetch. */
const AUTH_ROUTES = ["/api/auth/csrf", "/api/auth/providers", "/api/auth/session"];

export default async function globalSetup() {
  const base = "http://localhost:3000";
  // Redirects (307 → /login) are fine; we only need each route to compile.
  await Promise.all(
    [...ROUTES, ...AUTH_ROUTES].map((path) =>
      fetch(base + path, { redirect: "manual" }).catch(() => {
        // A route that errors here still compiled; tests will surface real
        // failures. Warmup is best-effort.
      })
    )
  );
  // /api/auth/callback/credentials only accepts POST, and NextAuth's own
  // CSRF check 403s a request whose token doesn't match its own cookie — so
  // this can't reuse the csrf fetch above (different response, no cookie
  // jar here). It doesn't need to succeed, just to force Turbopack to
  // compile the handler; a 403 still means the route handler ran.
  await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "csrfToken=warmup&email=warmup&password=warmup",
  }).catch(() => {});
}
