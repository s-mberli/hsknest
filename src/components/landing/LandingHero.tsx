"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { FlipCard } from "@/components/landing/FlipCard";
import { TryFreeButton } from "@/components/landing/TryFreeButton";
import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/lib/motion";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

/**
 * Client-side landing hero: quiet wash, solid accent type, product shot in
 * the first viewport. Static marketing copy lives here; the server
 * component (`page.tsx`) only handles the logged-in redirect.
 */
export function LandingHero() {
  const reducedMotion = usePrefersReducedMotion();

  const safeFadeUp = reducedMotion
    ? { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }
    : fadeUp;

  return (
    <main className="relative flex min-h-0 flex-1 items-start overflow-hidden px-6 py-12 sm:min-h-[85svh] sm:items-center sm:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,var(--foreground)_1.5px,transparent_0)] [background-size:20px_20px]"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 text-center lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:text-left">
        <div className="space-y-7">
          <motion.div
            initial={reducedMotion ? undefined : "hidden"}
            animate={reducedMotion ? undefined : "visible"}
            variants={safeFadeUp}
            transition={{ delay: 0.05 }}
            className="flex justify-center lg:justify-start"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              Mandarin vocabulary practice
            </span>
          </motion.div>

          <motion.h1
            initial={reducedMotion ? undefined : "hidden"}
            animate={reducedMotion ? undefined : "visible"}
            variants={safeFadeUp}
            transition={{ delay: 0.1 }}
            className="text-4xl font-extrabold tracking-tight sm:text-6xl"
          >
            HSK Nest
          </motion.h1>

          <motion.p
            initial={reducedMotion ? undefined : "hidden"}
            animate={reducedMotion ? undefined : "visible"}
            variants={safeFadeUp}
            transition={{ delay: 0.12 }}
            className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl"
          >
            Daily Chinese vocabulary practice, ready when you are.
          </motion.p>

          <motion.div
            initial={reducedMotion ? undefined : "hidden"}
            animate={reducedMotion ? undefined : "visible"}
            variants={safeFadeUp}
            transition={{ delay: 0.15 }}
            className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0"
          >
            <p>
              Preloaded HSK 3.0 vocabulary and short daily Study sessions for
              building a Mandarin habit without assembling your own decks.
            </p>
            <ul className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6 lg:justify-start">
              <li className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" /> 3,000 example sentences &amp; Mandarin pronunciation audio
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" /> Spaced repetition scheduling
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" /> Gesture-first swipe UX
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={reducedMotion ? undefined : "hidden"}
            animate={reducedMotion ? undefined : "visible"}
            variants={safeFadeUp}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row lg:justify-start"
          >
            <TryFreeButton className="w-full sm:w-auto">Try without signing up</TryFreeButton>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-14 w-full rounded-full border-primary/20 bg-background/50 px-8 text-base sm:w-auto"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={reducedMotion ? undefined : "hidden"}
            animate={reducedMotion ? undefined : "visible"}
            variants={safeFadeUp}
            transition={{ delay: 0.23 }}
            className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border bg-card/80 p-4 text-left shadow-sm sm:hidden"
            aria-label="Mandarin vocabulary demo"
          >
            <span className="text-5xl font-bold leading-none text-primary">是</span>
            <div>
              <p className="text-lg font-semibold">shì</p>
              <p className="text-sm text-muted-foreground">to be; is; yes</p>
              <p className="mt-1 text-xs text-muted-foreground">这是我的书。 · This is my book.</p>
            </div>
          </motion.div>

          <motion.p
            initial={reducedMotion ? undefined : "hidden"}
            animate={reducedMotion ? undefined : "visible"}
            variants={safeFadeUp}
            transition={{ delay: 0.25 }}
            className="text-sm text-muted-foreground"
          >
            14-day hosted trial · €10/month ·{" "}
            <a
              href="https://github.com/s-mberli/hsknest"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              self-host free, forever
            </a>
          </motion.p>
        </div>

        <motion.div
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.3 }}
          className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none"
        >
          <div className="mx-auto max-w-sm lg:max-w-md">
            <FlipCard />
          </div>
        </motion.div>
      </div>
    </main>
  );
}
