"use client";

import { getSession } from "next-auth/react";

/**
 * Call right after a successful `signIn("credentials", { redirect: false })`,
 * before navigating to a session-gated route (server components that call
 * getCurrentUserId() and redirect to /login when it's null).
 *
 * NextAuth's redirect:false credentials flow resolves as soon as the
 * callback response is received, but there's a known race — worse under
 * load — where a follow-up navigation can outrun the session cookie
 * actually being visible to the next request, bouncing the user straight
 * back to /login right after they signed in successfully (see
 * nextauthjs/next-auth#1264, #8897). Forcing one round trip through
 * next-auth's own session endpoint here resolves the race: by the time this
 * resolves, the cookie is confirmed readable server-side.
 */
export async function confirmSession(): Promise<void> {
  await getSession();
}
