"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, Globe2, GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OnboardingFormProps {
  languages: { id: string; name: string; code: string }[];
  /** Seeded HSK level decks in level order — powers the level step. */
  hskLists: { id: string; name: string }[];
}

/** "HSK 3 — Intermediate" → { level: "HSK 3", detail: "Intermediate" }. */
function splitListName(name: string): { level: string; detail: string } {
  const [level, detail] = name.split(" — ");
  return { level, detail: detail ?? "" };
}

export function OnboardingForm({ languages, hskLists }: OnboardingFormProps) {
  const router = useRouter();
  // With a single launch language there's nothing to choose — preselect it
  // and skip straight to the level step (language stays switchable in
  // Settings). The picker grid returns when more languages re-open at signup.
  const singleLanguage = languages.length === 1;
  const [selected, setSelected] = useState<string | null>(
    singleLanguage ? languages[0].id : null
  );
  const [step, setStep] = useState<"language" | "level">(
    singleLanguage && languages[0].code === "zh" && hskLists.length > 0
      ? "level"
      : "language"
  );
  const [listId, setListId] = useState<string | null>(hskLists[0]?.id ?? null);
  const [saving, setSaving] = useState(false);

  const selectedLanguage = languages.find((l) => l.id === selected);
  const hasLevelStep =
    selectedLanguage?.code === "zh" && hskLists.length > 0;

  async function finish() {
    if (!selected) return;
    setSaving(true);
    try {
      // Enroll the chosen level deck FIRST, so the study queue starts with the
      // words the user picked. The settings PATCH below auto-enrolls the HSK 1
      // "Foundation" starter deck only when the user has zero progress in the
      // language — enrolling here first makes that guard skip, so the chosen
      // level isn't clobbered. Non-fatal: the dashboard still guides deck-less
      // users to /lists, and a language without a level step falls back to the
      // settings starter auto-enroll.
      if (hasLevelStep && listId) {
        await fetch(`/api/lists/${listId}/enroll`, { method: "POST" }).catch(
          () => null
        );
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguageId: selected }),
      });
      if (!res.ok) throw new Error();

      router.push("/study");
      router.refresh();
    } catch {
      toast.error("Could not save your choices. Please try again.");
      setSaving(false);
    }
  }

  function onPrimary() {
    if (step === "language" && hasLevelStep) {
      setStep("level");
      return;
    }
    void finish();
  }

  const isLevelStep = step === "level";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-lg"
    >
      <div className="relative group">
        {/* Animated backdrop glow */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/30 to-blue-500/30 opacity-30 blur-xl transition-opacity duration-500 group-hover:opacity-50" />

        <Card className="relative overflow-hidden rounded-3xl border border-primary/10 bg-background/60 shadow-2xl backdrop-blur-xl">
          {/* Subtle top glare effect */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <CardHeader className="text-center pb-8 pt-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
              className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner ring-1 ring-primary/20"
            >
              {isLevelStep ? (
                <GraduationCap className="size-8 text-primary" />
              ) : (
                <Globe2 className="size-8 text-primary" />
              )}
            </motion.div>
            <CardTitle className="text-3xl font-extrabold tracking-tight">
              {isLevelStep
                ? "Where are you starting?"
                : "Which language do you want to master?"}
            </CardTitle>
            <CardDescription className="text-base mt-3 px-4 leading-relaxed">
              {isLevelStep
                ? "Not sure? HSK 1 is the safe start. You can switch anytime."
                : "You can switch languages anytime in Settings."}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-10">
            {isLevelStep ? (
              <div className="mb-10 grid grid-cols-2 gap-3">
                {hskLists.map((list, i) => {
                  const { level, detail } = splitListName(list.name);
                  const isSelected = listId === list.id;
                  return (
                    <motion.button
                      key={list.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.04 }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setListId(list.id)}
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-2xl border p-4 text-sm font-semibold transition-all duration-300",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                          : "border-border/50 bg-card/40 text-foreground hover:border-primary/40 hover:bg-card/80 hover:shadow-lg"
                      )}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="level-checkmark"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
                        >
                          <Check className="size-3.5 stroke-[3]" />
                        </motion.div>
                      )}
                      <span className="relative z-10">{level}</span>
                      {detail && (
                        <span className="relative z-10 mt-0.5 text-xs font-normal text-muted-foreground">
                          {detail}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-10">
                {languages.map((l, i) => {
                  const isSelected = selected === l.id;
                  return (
                    <motion.button
                      key={l.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelected(l.id)}
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-2xl border p-5 text-sm font-semibold transition-all duration-300",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)] ring-1 ring-primary"
                          : "border-border/50 bg-card/40 text-foreground hover:border-primary/40 hover:bg-card/80 hover:shadow-lg"
                      )}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="checkmark"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
                        >
                          <Check className="size-3.5 stroke-[3]" />
                        </motion.div>
                      )}
                      <span className="relative z-10">{l.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                size="lg"
                className={cn(
                  "h-14 w-full rounded-full text-base font-bold shadow-xl transition-all duration-300",
                  selected ? "hover:scale-[1.02] hover:shadow-[0_0_2rem_-0.5rem_#3b82f6]" : "opacity-80"
                )}
                disabled={!selected || saving || (isLevelStep && !listId)}
                onClick={onPrimary}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="size-5 rounded-full border-2 border-primary-foreground border-t-transparent"
                    />
                    Saving...
                  </span>
                ) : isLevelStep || !hasLevelStep ? (
                  "Start studying"
                ) : (
                  "Continue"
                )}
              </Button>
              {isLevelStep && !singleLanguage && (
                <button
                  type="button"
                  onClick={() => setStep("language")}
                  className="mx-auto mt-4 block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Back
                </button>
              )}
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
