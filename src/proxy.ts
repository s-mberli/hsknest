import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

const SECURE_COOKIE = "__Secure-next-auth.session-token";
const PLAIN_COOKIE = "next-auth.session-token";

/**
 * Clear stale JWT session cookies that can't be decrypted — e.g. after a
 * container recreation that changed the auto-generated NEXTAUTH_SECRET.
 * Without this, NextAuth logs JWT_SESSION_ERROR on every request and the
 * user sees confusing behavior until they manually clear cookies.
 *
 * Renamed from `middleware.ts` per the Next.js 16 Proxy migration — see
 * node_modules/next/dist/docs/.../file-conventions/proxy.md. Proxy defaults
 * to the Node.js runtime (not Edge) as of 16.0.0, so calling `prisma` here
 * is safe.
 */
export async function proxy(req: NextRequest) {
  const hasSecure = req.cookies.has(SECURE_COOKIE);
  const hasPlain = req.cookies.has(PLAIN_COOKIE);
  if (!hasSecure && !hasPlain) return NextResponse.next();

  // Mirror NextAuth's own secureCookie heuristic: whichever cookie name is
  // actually present on the request is the one it would have set.
  let token = null;
  try {
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: hasSecure,
    });
  } catch {
    // NEXTAUTH_SECRET unset/empty at request time, or any other decode
    // failure NextAuth's default decode() didn't already swallow — treat
    // as "no valid session" rather than crashing every route this runs on.
    token = null;
  }
  if (token) return NextResponse.next();

  // Cookie(s) present but undecryptable → clear both possible names (a user
  // migrating from HTTP to HTTPS behind a reverse proxy can have both) and
  // send them somewhere useful. If the data volume was reset, there are now
  // zero users — /login would be a dead end, so send them to /signup instead.
  let destination = "/login";
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) destination = "/signup";
  } catch {
    // DB unreachable — /login is still the safer default.
  }

  const res = NextResponse.redirect(new URL(destination, req.url));
  res.cookies.delete(SECURE_COOKIE);
  res.cookies.delete(PLAIN_COOKIE);
  return res;
}

export const config = {
  // Skip API routes, static/image assets, common public metadata files, and
  // the auth pages themselves (avoid redirect loops on /login etc.).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|icon.png|login|signup|forgot-password|reset-password).*)",
  ],
};
