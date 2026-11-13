/**
 * Guest-account constants, safe to import from client components. Server-only
 * guest checks live in src/lib/guestAccess.ts.
 */

/** Anonymous one-click accounts created by POST /api/auth/guest. */
export const GUEST_EMAIL_SUFFIX = "@guest.local";

export function isGuestEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(GUEST_EMAIL_SUFFIX);
}

/**
 * Guests are anonymous and free to create, so bulk writes (CSV import and
 * multi-word add) need a saved account. Single-word add stays open.
 */
export const GUEST_IMPORT_BLOCKED_MESSAGE = "Save your account first to import words";

/** A guest younger than this is still in their first visit, not returning. */
export const RETURNING_GUEST_MIN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether "Start studying" should first offer a returning guest the chance to
 * save their account. True only when words really are due for review and the
 * guest account is at least a day old, so the prompt never claims reviews that
 * do not exist. The prompt is dismissible and never blocks Study.
 */
export function shouldPromptReturningGuest({
  isGuest,
  createdAt,
  due,
  now = new Date(),
}: {
  isGuest: boolean;
  createdAt?: Date | string | null;
  due: number;
  now?: Date;
}): boolean {
  if (!isGuest || !createdAt || due <= 0) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now.getTime() - created >= RETURNING_GUEST_MIN_AGE_MS;
}
