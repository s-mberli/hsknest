import { clientAddress } from "@/lib/clientAddress";
import { isGuestEmail } from "@/lib/guest";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";

/** True when `userId` is an anonymous guest account. */
export async function isGuestUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return isGuestEmail(user?.email);
}

/**
 * Per-client-address budget shared by guest upgrade and guest checkout, the
 * two routes that give a guest a real address and send it a verification
 * email. Guests are free to create, so a per-guest limit alone lets one
 * client mail as many addresses as it can create guests. Skipped when no
 * trusted proxy supplies an address (see clientAddress); the global daily
 * verification cap in src/lib/email.ts still applies then.
 */
export const GUEST_SAVE_PER_SOURCE_PER_HOUR = 10;

export function guestSaveAllowed(req: Request): boolean {
  const source = clientAddress(req);
  return (
    !source ||
    rateLimit(`guest-save:${source}`, GUEST_SAVE_PER_SOURCE_PER_HOUR, 60 * 60 * 1000)
  );
}
