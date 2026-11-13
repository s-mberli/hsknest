/**
 * Delete stale guest accounts: created more than STALE_MS ago with no review
 * and no Reading Mode session since. Guests are throwaway by design
 * (Settings says so), so this only reclaims rows nobody can log back into
 * anyway. Run at container boot from
 * docker-entrypoint.sh; safe to run any time.
 *
 * STALE_MS MUST stay >= the NextAuth session `maxAge` in src/lib/auth.ts
 * (currently 30 days). Sessions are JWTs — a token stays cryptographically
 * valid for the full maxAge with no server-side revocation, so pruning
 * before it expires deletes a User row a live session still authenticates
 * as. That produced a real bug: every write for that session then threw a
 * raw Prisma error (P2025 / FK violation) instead of an ordinary 401.
 * getCurrentUserId() (src/lib/session.ts) now double-checks the row exists
 * as defense in depth, but this constant is the actual fix — it stops a
 * live token from ever outliving its account. This script can't import
 * authOptions directly (it runs via `tsx` outside the Next.js app, and
 * pulling in NextAuth/bcrypt here for one number isn't worth it), so the
 * 30-day figure below is a plain copy — if you change maxAge, change this too.
 */
import { PrismaClient } from "@prisma/client";

import { pruneStaleGuests } from "../src/lib/guestPrune";

const prisma = new PrismaClient();

const SESSION_MAX_AGE_DAYS = 30; // must match session.maxAge in src/lib/auth.ts
const SAFETY_MARGIN_DAYS = 5; // headroom so clock skew/slow cron can't reopen the window
const STALE_MS = (SESSION_MAX_AGE_DAYS + SAFETY_MARGIN_DAYS) * 24 * 60 * 60 * 1000;

async function main() {
  const cutoff = new Date(Date.now() - STALE_MS);
  const pruned = await pruneStaleGuests(prisma, cutoff);
  console.log(
    pruned === 0
      ? "→ No stale guest accounts."
      : `→ Pruned ${pruned} stale guest account(s).`
  );
}

main()
  .catch((err) => {
    // Pruning is housekeeping — never block the app from starting.
    console.error("Guest pruning failed:", err);
  })
  .finally(() => prisma.$disconnect());
