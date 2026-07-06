"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

/**
 * Hydrates the user's account theme into next-themes once on mount, so the
 * saved choice follows the account across devices. next-themes' localStorage
 * handles the instant/anonymous path; this only reconciles on login/load.
 */
export function ThemeSync({ theme }: { theme: string }) {
  const { setTheme } = useTheme();
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    if (theme === "light" || theme === "dark" || theme === "system") {
      setTheme(theme);
    }
  }, [theme, setTheme]);

  return null;
}
