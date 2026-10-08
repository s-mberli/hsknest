"use client";

import { getSession, signIn } from "next-auth/react";

export type CredentialsSignInResult =
  | { ok: true }
  | { ok: false; reason: "credentials" | "session" | "network" };

function isCsrfRedirect(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.pathname === "/api/auth/signin" && parsed.searchParams.get("csrf") === "true";
  } catch {
    return false;
  }
}

/** Sign in, retrying only NextAuth's explicit CSRF redirect response once. */
export async function signInWithCredentials(
  email: string,
  password: string
): Promise<CredentialsSignInResult> {
  try {
    let result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) return { ok: false, reason: "credentials" };

    if (isCsrfRedirect(result?.url)) {
      result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) return { ok: false, reason: "credentials" };
      if (isCsrfRedirect(result?.url)) return { ok: false, reason: "session" };
    }
    if (!result?.ok) return { ok: false, reason: "credentials" };

    const session = await getSession();
    return session?.user?.id
      ? { ok: true }
      : { ok: false, reason: "session" };
  } catch {
    // Keep transport and session endpoint failures inside the form flow.
    return { ok: false, reason: "network" };
  }
}
