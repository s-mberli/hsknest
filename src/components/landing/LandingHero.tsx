"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { AuroraGlow } from "@/components/fx/AuroraGlow";
import { TryFreeButton } from "@/components/landing/TryFreeButton";
import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/lib/motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    }
  },
};

/**
 * Client-side landing hero: aurora glow backdrop + staggered entrance for the
 * badge/h1/subhead/CTAs. Static marketing copy lives here; the server
 * component (`page.tsx`) only handles the logged-in redirect.
 */
export function LandingHero() {
  const reducedMotion = usePrefersReducedMotion();

  // Remove blur filter for users preferring reduced motion
  const safeFadeUp = reducedMotion 
    ? { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } } 
    : fadeUp;

  return (
    <main className="relative flex min-h-[85svh] flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      {/* Dynamic Background Glow */}
      <div aria-hidden="true" className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
      <div aria-hidden="true">
        <AuroraGlow />
      </div>
      
      <div className="relative z-10 w-full max-w-3xl space-y-8">
        <motion.div
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.1 }}
          className="flex justify-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary shadow-sm backdrop-blur-md transition-colors hover:bg-primary/20">
            <span aria-hidden="true" className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            Open source · Self-hostable
          </span>
        </motion.div>

        <motion.h1
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.2 }}
          className="text-5xl font-extrabold tracking-tight sm:text-7xl"
        >
          All of HSK 1–9, ready <br className="hidden sm:block" />
          <span className="bg-gradient-to-br from-primary via-primary/80 to-primary/40 bg-clip-text text-transparent drop-shadow-sm">
            before you finish your coffee.
          </span>
        </motion.h1>

        <motion.p
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.3 }}
          className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
        >
          11,000+ words pre-loaded with real example sentences and audio,
          scheduled by FSRS — modern spaced-repetition science, minus the
          plugin archaeology. Swipe to grade, quiz yourself, match pairs.
          Free for 14 days, no card required.
        </motion.p>

        <motion.div
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row"
        >
          <TryFreeButton className="w-full sm:w-auto" />
          <Button asChild variant="outline" size="lg" className="h-14 w-full rounded-full border-primary/20 bg-background/50 px-8 text-base backdrop-blur-md transition-all hover:scale-105 hover:bg-accent sm:w-auto">
            <Link href="/login">Sign in</Link>
          </Button>
        </motion.div>

        <motion.p
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.5 }}
          className="text-sm text-muted-foreground"
        >
          No signup to try ·{" "}
          <a
            href="https://github.com/s-mberli/hsknest"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            or self-host it free, forever
          </a>
        </motion.p>
      </div>
    </main>
  );
}
