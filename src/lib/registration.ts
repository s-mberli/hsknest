import { isSelfHosted } from "@/lib/selfHosted";
import { prisma } from "@/lib/prisma";

/**
 * Self-hosted signup gate: the first account claims the instance, then
 * registration closes automatically — the standard pattern for single-tenant
 * self-hosted apps (Immich, Gitea, Forgejo, Ghost all do this). Hosted mode
 * is unaffected; every check here is a no-op when SELF_HOSTED=false.
 *
 * ALLOW_REGISTRATION=true reopens both signup and guest mode on a
 * self-hosted instance (e.g. "my partner wants an account too"). Unlike
 * SELF_HOSTED's fail-open default, this flag fails *closed*: an unset or
 * malformed value keeps registration closed, since the unsafe state here
 * requires an explicit opt-in, not a missing one.
 */
export function isRegistrationOverride(): boolean {
  return process.env.ALLOW_REGISTRATION?.toLowerCase().trim() === "true";
}

/** True if a new account may sign up right now. */
export async function isRegistrationOpen(): Promise<boolean> {
  if (!isSelfHosted() || isRegistrationOverride()) return true;
  const userCount = await prisma.user.count();
  return userCount === 0;
}

/**
 * Guest mode is a conversion funnel for the hosted marketing site — it makes
 * no sense once someone has already deployed their own container. Disabled
 * on self-hosted instances unless explicitly reopened.
 */
export function isGuestModeEnabled(): boolean {
  return !isSelfHosted() || isRegistrationOverride();
}
