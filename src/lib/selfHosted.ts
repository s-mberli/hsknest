/**
 * Pure helper for the SELF_HOSTED deployment flag.
 *
 * Lives in its own module (no imports) so standalone scripts — outside the
 * Next.js server context — can import it without pulling in `next/server`
 * or Prisma. Re-exported from `subscription.ts` for call sites that already
 * import from there.
 *
 * Semantics: anything other than an explicit (case-insensitive, trimmed)
 * "false" means self-hosted. A missing or malformed env var can never paywall
 * someone's own server — operators only needling to flip *to* hosted mode
 * set the exact literal "false", and typos loudly stay self-hosted instead
 * of silently turning off revenue.
 *
 * Valid values (case-insensitive, whitespace-trimmed):
 *   "false" → hosted (paid) instance
 *   "true" / unset / anything else → self-hosted (no billing, no paywall)
 */
export function isSelfHosted(): boolean {
  const v = process.env.SELF_HOSTED?.toLowerCase().trim();
  return v !== "false";
}