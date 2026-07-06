import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

/** Returns the authenticated user's id, or null if not signed in. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
