"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { AuroraGlow } from "@/components/fx/AuroraGlow";
import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/lib/motion";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Client-side landing hero: aurora glow backdrop + staggered entrance for the
 * badge/h1/subhead/CTAs. Static marketing copy lives here; the server
 * component (`page.tsx`) only handles the logged-in redirect.
 */
export function LandingHero() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <AuroraGlow />
      <div className="relative z-10 max-w-md space-y-6">
        <motion.span
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={fadeUp}
          transition={{ delay: 0 * 0.08 }}
          className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
        >
          Open source · self-hostable
        </motion.span>
        <motion.h1
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={fadeUp}
          transition={{ delay: 1 * 0.08 }}
          className="text-4xl font-bold tracking-tight sm:text-5xl"
        >
          Remember more, review less.
        </motion.h1>
        <motion.p
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={fadeUp}
          transition={{ delay: 2 * 0.08 }}
          className="text-lg text-muted-foreground"
        >
          A spaced-repetition study app for any language. Swipe through cards,
          and a research-backed schedule brings each word back at just the
          right moment.
        </motion.p>
        <motion.div
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={fadeUp}
          transition={{ delay: 3 * 0.08 }}
          className="flex flex-col gap-3 sm:flex-row sm:justify-center"
        >
          <Button asChild size="lg">
            <Link href="/signup">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
