import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns the authenticated user's id, or null if not signed in — or if the
 * session is stale: the JWT (30-day maxAge, see auth.ts) is still valid but
 * the User row it points at is gone (e.g. a guest account pruned by
 * scripts/prune-guests.ts before the token expired). Without this check a
 * stale-but-valid session sails through every `requireUser()` call and the
 * first write throws an unhandled Prisma error instead of the ordinary 401
 * a logged-out request gets. See src/app/api/__tests__/staleSession.test.ts.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;

  const exists = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  return exists ? id : null;
}
