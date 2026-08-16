import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

/**
 * Returns the authenticated user's id, or null if not signed in — or if the
 * session is stale: the JWT (30-day maxAge, see auth.ts) is still valid but
 * the User row it points at is gone (e.g. a guest account pruned by
 * scripts/prune-guests.ts before the token expired) or the account password
 * changed after the token was issued. Without the row-existence check a
 * stale-but-valid session sails through every requireUser() call and the
 * first write throws an unhandled Prisma error instead of the ordinary 401
 * a logged-out request gets. See src/app/api/__tests__/staleSession.test.ts.
 *
 * One DB lookup serves both checks — existence AND passwordChangedAt — so
 * the jwt callback in auth.ts no longer runs a second findUnique per
 * request (see PERF-1 audit finding).
 */
export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const hasSecure = cookieStore.has("__Secure-next-auth.session-token");
  if (!hasSecure && !cookieStore.has("next-auth.session-token")) return null;

  // getToken wants a request-like object; server components have no
  // NextRequest, but next-auth's SessionStore only reads cookies + headers.
  const req = {
    cookies: { getAll: () => cookieStore.getAll() },
    headers: new Headers({ cookie: cookieStore.toString() }),
  } as unknown as NextRequest;

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: hasSecure,
  });
  const id = token?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, passwordChangedAt: true },
  });
  if (!user) return null;

  // Revoke tokens issued before a password reset — the rule the jwt callback
  // used to enforce, folded into this one lookup instead of a second query.
  const iat = typeof token.iat === "number" ? token.iat : 0;
  if (Math.floor(user.passwordChangedAt.getTime() / 1000) > iat) return null;

  return user.id;
}
