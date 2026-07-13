"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AccountSection } from "@/components/settings/sections/AccountSection";
import { AppearanceSection } from "@/components/settings/sections/AppearanceSection";
import { FeedbackSection } from "@/components/settings/sections/FeedbackSection";
import { LanguageSection } from "@/components/settings/sections/LanguageSection";
import { SchedulingSection } from "@/components/settings/sections/SchedulingSection";
import { WorkloadSection } from "@/components/settings/sections/WorkloadSection";

type Algorithm = "SM2" | "LEITNER" | "FSRS";
type Theme = "light" | "dark" | "system";
type StudyTheme = "dark" | "follow";
type CardTextSize = "small" | "normal" | "large";

interface SettingsFormProps {
  email: string;
  name: string | null;
  preferredAlgorithm: Algorithm;
  dailyNewWords: number;
  assumedCheckPerDay: number;
  intervalModifier: number;
  lapseModifier: number;
  masteryThresholdDays: number | null;
  fuzzIntervals: boolean;
  theme: Theme;
  studyTheme: StudyTheme;
  cardTextSize: CardTextSize;
  showReading: boolean;
  soundEffects: boolean;
  autoPlayPronunciation: boolean;
  desiredRetention: number;
  targetLanguageId: string;
  languages: { id: string; name: string }[];
}

export function SettingsForm(props: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [targetLanguageId, setTargetLanguageId] = useState<string>(props.targetLanguageId);

  const [algorithm, setAlgorithm] = useState<Algorithm>(
    props.preferredAlgorithm
  );
  const [dailyNewWords, setDailyNewWords] = useState(props.dailyNewWords);
  const [assumedCheckPerDay, setAssumedCheckPerDay] = useState(
    props.assumedCheckPerDay
  );
  const [intervalModifier, setIntervalModifier] = useState(
    props.intervalModifier
  );
  const [lapseModifier, setLapseModifier] = useState(props.lapseModifier);
  const [masteryThresholdDays, setMasteryThresholdDays] = useState<
    number | null
  >(props.masteryThresholdDays);
  const [fuzzIntervals, setFuzzIntervals] = useState(props.fuzzIntervals);
  const [desiredRetention, setDesiredRetention] = useState(props.desiredRetention);

  async function patch(body: Record<string, unknown>, revert: () => void) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Could not save that setting.");
        revert();
        return;
      }
      toast.success("Setting saved.");
      router.refresh();
    } catch {
      toast.error("Could not save — check your connection.");
      revert();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <LanguageSection
        targetLanguageId={targetLanguageId}
        languages={props.languages}
        saving={saving}
        onTargetLanguageChange={(next) => {
          const prev = targetLanguageId;
          setTargetLanguageId(next);
          patch({ targetLanguageId: next }, () => setTargetLanguageId(prev));
        }}
      />

      <WorkloadSection
        dailyNewWords={dailyNewWords}
        assumedCheckPerDay={assumedCheckPerDay}
        saving={saving}
        onDailyNewWordsChange={(next) => {
          const prev = dailyNewWords;
          setDailyNewWords(next);
          patch({ dailyNewWords: next }, () => setDailyNewWords(prev));
        }}
        onAssumedCheckPerDayChange={(next) => {
          const prev = assumedCheckPerDay;
          setAssumedCheckPerDay(next);
          patch({ assumedCheckPerDay: next }, () =>
            setAssumedCheckPerDay(prev)
          );
        }}
      />

      <SchedulingSection
        algorithm={algorithm}
        desiredRetention={desiredRetention}
        intervalModifier={intervalModifier}
        lapseModifier={lapseModifier}
        masteryThresholdDays={masteryThresholdDays}
        fuzzIntervals={fuzzIntervals}
        saving={saving}
        onAlgorithmChange={(next) => {
          const prev = algorithm;
          setAlgorithm(next);
          patch({ preferredAlgorithm: next }, () => setAlgorithm(prev));
        }}
        onDesiredRetentionChange={(next) => {
          const prev = desiredRetention;
          setDesiredRetention(next);
          patch({ desiredRetention: next }, () => setDesiredRetention(prev));
        }}
        onIntervalModifierChange={(next) => {
          const prev = intervalModifier;
          setIntervalModifier(next);
          patch({ intervalModifier: next }, () => setIntervalModifier(prev));
        }}
        onLapseModifierChange={(next) => {
          const prev = lapseModifier;
          setLapseModifier(next);
          patch({ lapseModifier: next }, () => setLapseModifier(prev));
        }}
        onMasteryThresholdDaysChange={(next) => {
          const prev = masteryThresholdDays;
          setMasteryThresholdDays(next);
          patch({ masteryThresholdDays: next }, () =>
            setMasteryThresholdDays(prev)
          );
        }}
        onFuzzIntervalsChange={(next) => {
          const prev = fuzzIntervals;
          setFuzzIntervals(next);
          patch({ fuzzIntervals: next }, () => setFuzzIntervals(prev));
        }}
      />

      <AppearanceSection
        initialTheme={props.theme}
        initialStudyTheme={props.studyTheme}
        initialCardTextSize={props.cardTextSize}
        initialShowReading={props.showReading}
        initialSoundEffects={props.soundEffects}
        initialAutoPlayPronunciation={props.autoPlayPronunciation}
      />

      <AccountSection email={props.email} name={props.name} />

      <FeedbackSection />
    </div>
  );
}
