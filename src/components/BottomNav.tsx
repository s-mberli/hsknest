"use client";

import { BookOpen, Home, Layers, ListChecks, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// No "Study" tab: Home is the launcher (its Start button + practice games),
// so a study destination would be a redundant door that can dead-end.
const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/reading", label: "Read", icon: BookOpen },
  { href: "/lists", label: "Lists", icon: Layers },
  { href: "/words", label: "Words", icon: ListChecks },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  // Study (and its game modes) run full-screen with no chrome. Reading's
  // actual reading surface gets the same treatment — it needs at least as
  // much sustained, uninterrupted attention as a study session, and the
  // bottom nav plus the persistent audio bar were together eating ~24% of a
  // mobile viewport's height (DESIGN.md's Focus Mode Rule).
  if (pathname === "/study" || pathname.startsWith("/study/")) return null;
  if (pathname.startsWith("/reading/") && pathname.endsWith("/read")) return null;

  return (
    <nav className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
