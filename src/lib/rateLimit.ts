/**
 * Tiny in-memory fixed-window rate limiter. Pure and unit-testable.
 *
 * State lives in a per-process Map — fine for a single-instance VPS. If you
 * ever scale out to multiple instances, swap this for a shared store (Redis)
 * so limits are enforced across the fleet.
 */

interface Window {
  count: number;
  resetAt: number; // epoch ms when this window expires
}

const buckets = new Map<string, Window>();

/**
 * Returns `true` if the call is allowed, `false` if `key` has exhausted its
 * `limit` within the current `windowMs` window. Each allowed call increments
 * the counter; the window resets lazily once it has elapsed.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) return false;

  existing.count += 1;
  return true;
}

/** Drop windows that have already expired. Called periodically below. */
export function sweepRateLimits(now: number = Date.now()): void {
  for (const [key, win] of buckets) {
    if (now >= win.resetAt) buckets.delete(key);
  }
}

// Periodic sweep so the Map doesn't grow unbounded from one-off keys. Unref so
// it never keeps the process alive on its own. Guarded for edge/test runtimes
// where setInterval may be absent or undesirable.
if (typeof setInterval === "function") {
  const timer = setInterval(() => sweepRateLimits(), 10 * 60 * 1000);
  (timer as { unref?: () => void }).unref?.();
}

/** Test-only: clear all windows so cases don't leak into each other. */
export function _resetRateLimits(): void {
  buckets.clear();
}
