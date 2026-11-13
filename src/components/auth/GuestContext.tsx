"use client";

import { createContext, useContext } from "react";

/**
 * Whether the signed-in user is a guest account, decided on the server by the
 * (app) layout. Reading it from here instead of `useSession()` means the first
 * client render already knows the answer — no flash of the wrong UI while the
 * session fetch is in flight.
 */
const GuestContext = createContext(false);

export function GuestProvider({
  isGuest,
  children,
}: {
  isGuest: boolean;
  children: React.ReactNode;
}) {
  return <GuestContext.Provider value={isGuest}>{children}</GuestContext.Provider>;
}

export function useIsGuest(): boolean {
  return useContext(GuestContext);
}
