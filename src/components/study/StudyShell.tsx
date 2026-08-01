import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StudyShellProps {
  studyTheme: "dark" | "follow";
  children: ReactNode;
}

/**
 * Full-screen distraction-free container shared by every study/practice
 * screen. "dark" forces focus mode; "follow" inherits next-themes' class on
 * <html>. Purely presentational — each screen's session state machine,
 * fetch shape, and layout beneath this stay their own.
 */
export function StudyShell({ studyTheme, children }: StudyShellProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background text-foreground",
        studyTheme === "dark" && "dark"
      )}
    >
      {children}
    </div>
  );
}
