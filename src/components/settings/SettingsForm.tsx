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
import { SettingsTabs } from "@/components/settings/SettingsTabs";

type Theme = "light" | "dark" | "system";
type StudyTheme = "dark" | "follow";
type CardTextSize = "small" | "normal" | "large";

interface SettingsFormProps {
  email: string;
  name: string | null;
  dailyNewWords: number;
  assumedCheckPerDay: number;
  theme: Theme;
  studyTheme: StudyTheme;
  cardTextSize: CardTextSize;
  showReading: boolean;
  soundEffects: boolean;
  autoPlayPronunciation: boolean;
  desiredRetention: number;
  targetLanguageId: string;
  languages: { id: string; name: string }[];
  /** Billing card (hosted deployments only) — shown on the Account tab. */
  billing?: React.ReactNode;
}

export function SettingsForm(props: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [targetLanguageId, setTargetLanguageId] = useState<string>(props.targetLanguageId);

  const [dailyNewWords, setDailyNewWords] = useState(props.dailyNewWords);
  const [assumedCheckPerDay, setAssumedCheckPerDay] = useState(
    props.assumedCheckPerDay
  );
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

  const learning = (
    <>
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
        desiredRetention={desiredRetention}
        saving={saving}
        onDesiredRetentionChange={(next) => {
          const prev = desiredRetention;
          setDesiredRetention(next);
          patch({ desiredRetention: next }, () => setDesiredRetention(prev));
        }}
      />
    </>
  );

  return (
    <SettingsTabs
      panels={{
        learning,
        interface: (
          <AppearanceSection
            initialTheme={props.theme}
            initialStudyTheme={props.studyTheme}
            initialCardTextSize={props.cardTextSize}
            initialShowReading={props.showReading}
            initialSoundEffects={props.soundEffects}
            initialAutoPlayPronunciation={props.autoPlayPronunciation}
          />
        ),
        account: (
          <>
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
            <AccountSection email={props.email} name={props.name} />
            {props.billing}
          </>
        ),
        support: <FeedbackSection />,
      }}
    />
  );
}
