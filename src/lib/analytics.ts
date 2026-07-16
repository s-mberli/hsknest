/**
 * Launch-funnel events for Umami (cookieless, loads only when the env vars
 * are set — see layout.tsx). Everything is a silent no-op when the script
 * isn't present, so self-hosted installs ship zero analytics.
 *
 * Event names are part of the launch metrics contract in
 * docs/marketing/metrics.md — rename only in lockstep with that doc.
 */

declare global {
  interface Window {
    umami?: { track: (event: string) => void };
  }
}

export type FunnelEvent =
  | "guest_session_start"
  | "first_review_complete"
  | "guest_upgrade_complete";

export function trackEvent(event: FunnelEvent): void {
  try {
    window.umami?.track(event);
  } catch {
    // Analytics must never break the app.
  }
}

/** Fire an event at most once per browser (per event name). */
export function trackEventOnce(event: FunnelEvent): void {
  try {
    const key = `hsknest-evt-${event}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    trackEvent(event);
  } catch {
    trackEvent(event);
  }
}
