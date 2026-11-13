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
