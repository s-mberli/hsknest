/**
 * Warms the dev server's per-route Turbopack compile before any test runs.
 *
 * In dev mode Next compiles each route on first request. Heavy client routes
 * (notably /dashboard — framer-motion, charts, many components) can take
 * ~25–30s to compile the first time, then serve in <150ms. A test that is the
 * first to hit such a route races that cold compile and flakes (ERR_ABORTED /
 * navigation timeout). Pre-fetching every route here pays that cost once,
 * up front, so the tests themselves only ever see warm, fast responses.
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
  "/lists",
  "/words",
  "/pricing",
];

export default async function globalSetup() {
  const base = "http://localhost:3000";
  // Redirects (307 → /login) are fine; we only need each route to compile.
  await Promise.all(
    ROUTES.map((path) =>
      fetch(base + path, { redirect: "manual" }).catch(() => {
        // A route that errors here still compiled; tests will surface real
        // failures. Warmup is best-effort.
      })
    )
  );
}
