import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { Segmented, SettingRow } from "./shared";

type Theme = "light" | "dark" | "system";
type StudyTheme = "dark" | "follow";
type CardTextSize = "small" | "normal" | "large";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const STUDY_THEME_OPTIONS: { value: StudyTheme; label: string }[] = [
  { value: "dark", label: "Dark focus" },
  { value: "follow", label: "Match app" },
];

const CARD_TEXT_SIZE_OPTIONS: { value: CardTextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
];

export function AppearanceSection({
  initialTheme,
  initialStudyTheme,
  initialCardTextSize,
  initialShowReading,
  initialSoundEffects,
  initialAutoPlayPronunciation,
}: {
  initialTheme: Theme;
  initialStudyTheme: StudyTheme;
  initialCardTextSize: CardTextSize;
  initialShowReading: boolean;
  initialSoundEffects: boolean;
  initialAutoPlayPronunciation: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studyTheme, setStudyTheme] = useState<StudyTheme>(initialStudyTheme);
  const [cardTextSize, setCardTextSize] =
    useState<CardTextSize>(initialCardTextSize);
  const [showReading, setShowReading] = useState(initialShowReading);
  const [soundEffects, setSoundEffects] = useState(initialSoundEffects);
  const [autoPlayPronunciation, setAutoPlayPronunciation] = useState(
    initialAutoPlayPronunciation
  );

  // Avoid hydration mismatch: only reflect the resolved theme after mount.
  useEffect(() => queueMicrotask(() => setMounted(true)), []);

  const current = (mounted ? (theme as Theme) : initialTheme) ?? "system";

  async function choose(next: Theme) {
    setTheme(next);
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save your theme.");
      return;
    }
    toast.success("Theme saved.");
  }

  async function patch<T>(field: string, value: T, revert: () => void) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        toast.error("Could not save that setting.");
        revert();
        return;
      }
      toast.success("Setting saved.");
    } catch {
      toast.error("Could not save — check your connection.");
      revert();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>How the app and study screen look.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <SettingRow
          name="App theme"
          description="System follows your device's light/dark setting."
        >
          <Segmented
            label="App theme"
            value={current}
            disabled={saving}
            options={THEME_OPTIONS}
            onChange={choose}
          />
        </SettingRow>

        <SettingRow
          name="Study screen"
          description="Dark focus keeps reviews low-glare; match app follows the theme above."
        >
          <Segmented
            label="Study screen"
            value={studyTheme}
            disabled={saving}
            options={STUDY_THEME_OPTIONS}
            onChange={(next) => {
              const prev = studyTheme;
              setStudyTheme(next);
              patch("studyTheme", next, () => setStudyTheme(prev));
            }}
          />
        </SettingRow>

        <SettingRow
          name="Card text size"
          description="How large the word and meaning appear on study cards."
        >
          <Segmented
            label="Card text size"
            value={cardTextSize}
            disabled={saving}
            options={CARD_TEXT_SIZE_OPTIONS}
            onChange={(next) => {
              const prev = cardTextSize;
              setCardTextSize(next);
              patch("cardTextSize", next, () => setCardTextSize(prev));
            }}
          />
        </SettingRow>

        <SettingRow
          name="Show reading on cards"
          description="Off skips the reading hint so you recall pronunciation yourself; it still appears with the answer."
        >
          <Switch
            checked={showReading}
            disabled={saving}
            onCheckedChange={(next) => {
              const prev = showReading;
              setShowReading(next);
              patch("showReading", next, () => setShowReading(prev));
            }}
            aria-label="Show reading on cards"
          />
        </SettingRow>

        <SettingRow
          name="Sound effects"
          description="Subtle blips on correct answers and combo streaks while studying."
        >
          <Switch
            checked={soundEffects}
            disabled={saving}
            onCheckedChange={(next) => {
              const prev = soundEffects;
              setSoundEffects(next);
              patch("soundEffects", next, () => setSoundEffects(prev));
            }}
            aria-label="Sound effects"
          />
        </SettingRow>

        <SettingRow
          name="Auto-play pronunciation"
          description="Speak the word aloud the moment you reveal its reading. Needs a voice for the language installed on your device."
        >
          <Switch
            checked={autoPlayPronunciation}
            disabled={saving}
            onCheckedChange={(next) => {
              const prev = autoPlayPronunciation;
              setAutoPlayPronunciation(next);
              patch("autoPlayPronunciation", next, () => setAutoPlayPronunciation(prev));
            }}
            aria-label="Auto-play pronunciation"
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
