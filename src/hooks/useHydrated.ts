"use client";

import { useSyncExternalStore } from "react";

/**
 * False during SSR and the first client render, true once mounted.
 *
 * Use it to disable a `type="submit"` button until the React handler is
 * actually attached. Before hydration a submit button inside a `<form>` still
 * triggers the browser's NATIVE submission — and since our auth forms have no
 * `action` and their inputs deliberately carry no `name` (a native GET would
 * otherwise put credentials in the URL), that submission is a bare GET to the
 * current page: it silently reloads and discards whatever the user typed.
 *
 * On a slow connection that is a real, if brief, dead zone. It also made the
 * e2e suite flaky in a way that looked like a login bug: Playwright's click()
 * waits for the element to be visible/enabled/stable, but not for hydration,
 * so under CI load it could out-run React and the page would just bounce back
 * to /login with no error anywhere.
 */
// Never changes, so the store never notifies — the server/client snapshot
// split is doing all the work. Hoisted so the subscribe identity is stable.
const noopSubscribe = () => () => {};

export function useHydrated(): boolean {
  // useSyncExternalStore is the idiomatic hydration probe: React uses the
  // server snapshot (false) for SSR and the initial hydrating render, then
  // the client snapshot (true) afterwards. Preferred over setState-in-effect,
  // which trips react-hooks' cascading-render rule.
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
