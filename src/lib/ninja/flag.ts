/**
 * Feature flag for Hanzi Ninja. Fail-closed (opposite of isSelfHosted's
 * fail-open default) — this is a young, twitch-input mode still short of
 * the shipped-mode bar (device matrix, docs), so an unset or malformed env
 * var must never turn it on by accident. Only the exact literal "true"
 * enables it.
 *
 * NEXT_PUBLIC_ prefixed so the same function serves both the client
 * (DashboardHero's entry) and the server page gate.
 */
export function ninjaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_NINJA?.toLowerCase().trim() === "true";
}
