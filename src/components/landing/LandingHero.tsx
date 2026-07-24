"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

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
    <main className="relative flex min-h-[85svh] flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20 text-center sm:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_60%)]"
      />

      <div className="relative z-10 w-full max-w-3xl space-y-7">
        <motion.div
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.05 }}
          className="flex justify-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            Open source · Self-hostable
          </span>
        </motion.div>

        <motion.h1
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.1 }}
          className="text-5xl font-extrabold tracking-tight sm:text-7xl"
        >
          All 11,000 words of HSK 1–9. <br className="hidden sm:block" />
          <span className="text-primary">Pre-loaded and ready to swipe.</span>
        </motion.h1>

        <motion.div
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.15 }}
          className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          <ul className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span> 11,000+ pre-loaded words & 3,000 example sentences
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span> Powered by modern FSRS science
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span> Gesture-first swipe UX
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row"
        >
          <TryFreeButton className="w-full sm:w-auto" />
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-14 w-full rounded-full border-primary/20 bg-background/50 px-8 text-base sm:w-auto"
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </motion.div>

        <motion.p
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.25 }}
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

        <motion.div
          initial={reducedMotion ? undefined : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          variants={safeFadeUp}
          transition={{ delay: 0.3 }}
          className="mx-auto w-full max-w-2xl pt-4"
        >
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <div
              aria-hidden="true"
              className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2"
            >
              <span className="size-2 rounded-full bg-border" />
              <span className="size-2 rounded-full bg-border" />
              <span className="size-2 rounded-full bg-border" />
            </div>
            <Image
              src="/screenshots/study.png"
              alt="Studying a flashcard with pinyin, meaning, and an example sentence"
              width={1280}
              height={800}
              className="h-auto w-full"
              priority
            />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            11,000+ words · HSK 1–9 · 3,000 sentences · FSRS
          </p>
        </motion.div>
      </div>
    </main>
  );
}
