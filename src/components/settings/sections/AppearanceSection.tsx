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
  useEffect(() => setMounted(true), []);

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

  async function chooseStudyTheme(next: StudyTheme) {
    const prev = studyTheme;
    setStudyTheme(next);
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyTheme: next }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save that setting.");
      setStudyTheme(prev);
      return;
    }
    toast.success("Setting saved.");
  }

  async function chooseCardTextSize(next: CardTextSize) {
    const prev = cardTextSize;
    setCardTextSize(next);
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardTextSize: next }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save that setting.");
      setCardTextSize(prev);
      return;
    }
    toast.success("Setting saved.");
  }

  async function chooseShowReading(next: boolean) {
    const prev = showReading;
    setShowReading(next);
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showReading: next }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save that setting.");
      setShowReading(prev);
      return;
    }
    toast.success("Setting saved.");
  }

  async function chooseSoundEffects(next: boolean) {
    const prev = soundEffects;
    setSoundEffects(next);
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soundEffects: next }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save that setting.");
      setSoundEffects(prev);
      return;
    }
    toast.success("Setting saved.");
  }

  async function chooseAutoPlayPronunciation(next: boolean) {
    const prev = autoPlayPronunciation;
    setAutoPlayPronunciation(next);
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoPlayPronunciation: next }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save that setting.");
      setAutoPlayPronunciation(prev);
      return;
    }
    toast.success("Setting saved.");
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
            onChange={chooseStudyTheme}
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
            onChange={chooseCardTextSize}
          />
        </SettingRow>

        <SettingRow
          name="Show reading on cards"
          description="Off skips the reading hint so you recall pronunciation yourself; it still appears with the answer."
        >
          <Switch
            checked={showReading}
            disabled={saving}
            onCheckedChange={chooseShowReading}
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
            onCheckedChange={chooseSoundEffects}
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
            onCheckedChange={chooseAutoPlayPronunciation}
            aria-label="Auto-play pronunciation"
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
