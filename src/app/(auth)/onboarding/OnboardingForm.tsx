"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, Globe2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OnboardingFormProps {
  languages: { id: string; name: string; code: string }[];
}

export function OnboardingForm({ languages }: OnboardingFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguageId: selected }),
      });
      if (!res.ok) throw new Error();
      
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Could not save language. Please try again.");
      setSaving(false);
    }
  }

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
              <Globe2 className="size-8 text-primary" />
            </motion.div>
            <CardTitle className="text-3xl font-extrabold tracking-tight">
              Which language do you want to master?
            </CardTitle>
            <CardDescription className="text-base mt-3 px-4 leading-relaxed">
              Choose your target language to start building your custom flashcard deck. You can always switch languages anytime in settings.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-10">
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
                disabled={!selected || saving}
                onClick={onSubmit}
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
                ) : (
                  "Start building flashcards"
                )}
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
