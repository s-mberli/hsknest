"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Query navigation is a new session, even on the same App Router page. */
export function SessionBoundary({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname();
  return <Fragment key={`${pathname}?${params}`}>{children}</Fragment>;
}
