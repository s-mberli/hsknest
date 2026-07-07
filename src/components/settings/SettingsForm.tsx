"use client";

import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Algorithm = "SM2" | "LEITNER";
type Theme = "light" | "dark" | "system";
type StudyTheme = "dark" | "follow";
type CardTextSize = "small" | "normal" | "large";
type FeedbackCategory = "bug" | "idea" | "other";

const FEEDBACK_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

const ALGORITHMS: { value: Algorithm; label: string; description: string }[] = [
  {
    value: "SM2",
    label: "Adaptive",
    description:
      "Adjusts each card's interval to your recall strength. Great long-term default.",
  },
  {
    value: "LEITNER",
    label: "Boxes",
    description:
      "Simple 5-box system with fixed intervals. Predictable and easy to reason about.",
  },
];

const DAILY_NEW_OPTIONS = [0, 5, 10, 20, 40];
const ASSUMED_CHECK_OPTIONS = [0, 1, 3, 5];
const INTERVAL_MODIFIER_OPTIONS = [0.8, 1.0, 1.5, 2.0]; // shown as %
const LAPSE_MODIFIER_OPTIONS = [0, 0.25, 0.5]; // shown as %
const MASTERY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "None" },
  { value: 180, label: "6mo" },
  { value: 365, label: "1yr" },
  { value: 730, label: "2yr" },
];

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
}

/**
 * Segmented pill control — same visual pattern as the dashboard SessionPicker
 * (`rounded-full bg-muted p-1` track with a raised active button). Plain
 * buttons with `aria-pressed`, no Radix radios.
 */
function Segmented<T extends string | number | null>({
  value,
  options,
  disabled,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-grid grid-flow-col auto-cols-fr gap-1 rounded-full bg-muted p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One settings row: label + one-line description on the left, control on the
 * right. Stacks (label above control) below `sm:`.
 */
function SettingRow({
  name,
  description,
  children,
}: {
  name: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium leading-none">{name}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsForm(props: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

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

  async function patch(body: Record<string, unknown>, revert: () => void) {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save that setting.");
      revert();
      return;
    }
    toast.success("Setting saved.");
    router.refresh();
  }

  const activeAlgo = ALGORITHMS.find((a) => a.value === algorithm);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily workload</CardTitle>
          <CardDescription>How much new material you take on each day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingRow
            name="New words per day"
            description="Brand-new words introduced daily. 0 pauses learning and just reviews."
          >
            <Segmented
              label="New words per day"
              value={dailyNewWords}
              disabled={saving}
              options={DAILY_NEW_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
              onChange={(next) => {
                const prev = dailyNewWords;
                setDailyNewWords(next);
                patch({ dailyNewWords: next }, () => setDailyNewWords(prev));
              }}
            />
          </SettingRow>
          <SettingRow
            name="Known-word checks per day"
            description="Words you set aside as known, re-checked daily in case you were wrong."
          >
            <Segmented
              label="Known-word checks per day"
              value={assumedCheckPerDay}
              disabled={saving}
              options={ASSUMED_CHECK_OPTIONS.map((n) => ({
                value: n,
                label: String(n),
              }))}
              onChange={(next) => {
                const prev = assumedCheckPerDay;
                setAssumedCheckPerDay(next);
                patch({ assumedCheckPerDay: next }, () =>
                  setAssumedCheckPerDay(prev)
                );
              }}
            />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
          <CardDescription>
            How upcoming reviews are timed. Progress carries over when you change these.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <SettingRow
              name="Algorithm"
              description="Cards you get right come back after longer gaps; missed cards return sooner."
            >
              <Segmented
                label="Algorithm"
                value={algorithm}
                disabled={saving}
                options={ALGORITHMS.map((a) => ({
                  value: a.value,
                  label: a.label,
                }))}
                onChange={(next) => {
                  const prev = algorithm;
                  setAlgorithm(next);
                  patch({ preferredAlgorithm: next }, () => setAlgorithm(prev));
                }}
              />
            </SettingRow>
            {activeAlgo && (
              <p className="text-xs text-muted-foreground">
                {activeAlgo.description}
              </p>
            )}
          </div>

          <SettingRow
            name="Interval multiplier"
            description="Scales the gap after a correct answer. Lower = more often; higher = spaced out."
          >
            <Segmented
              label="Interval multiplier"
              value={intervalModifier}
              disabled={saving}
              options={INTERVAL_MODIFIER_OPTIONS.map((n) => ({
                value: n,
                label: `${Math.round(n * 100)}%`,
              }))}
              onChange={(next) => {
                const prev = intervalModifier;
                setIntervalModifier(next);
                patch({ intervalModifier: next }, () =>
                  setIntervalModifier(prev)
                );
              }}
            />
          </SettingRow>

          <SettingRow
            name="After a slip-up"
            description="Keep some of a word's interval after you forget it. 0% resets fully."
          >
            <Segmented
              label="After a slip-up"
              value={lapseModifier}
              disabled={saving}
              options={LAPSE_MODIFIER_OPTIONS.map((n) => ({
                value: n,
                label: `${Math.round(n * 100)}%`,
              }))}
              onChange={(next) => {
                const prev = lapseModifier;
                setLapseModifier(next);
                patch({ lapseModifier: next }, () => setLapseModifier(prev));
              }}
            />
          </SettingRow>

          <SettingRow
            name="Retire mastered words"
            description="Once a word's interval passes this length, stop scheduling it."
          >
            <Segmented
              label="Retire mastered words"
              value={masteryThresholdDays}
              disabled={saving}
              options={MASTERY_OPTIONS}
              onChange={(next) => {
                const prev = masteryThresholdDays;
                setMasteryThresholdDays(next);
                patch({ masteryThresholdDays: next }, () =>
                  setMasteryThresholdDays(prev)
                );
              }}
            />
          </SettingRow>

          <SettingRow
            name="Randomize intervals"
            description="Adds a small ±5% wiggle so batches don't all come due on the same day."
          >
            <Switch
              checked={fuzzIntervals}
              disabled={saving}
              onCheckedChange={(checked) => {
                const prev = fuzzIntervals;
                setFuzzIntervals(checked);
                patch({ fuzzIntervals: checked }, () => setFuzzIntervals(prev));
              }}
              aria-label="Randomize intervals"
            />
          </SettingRow>
        </CardContent>
      </Card>

      <AppearanceSection
        initialTheme={props.theme}
        initialStudyTheme={props.studyTheme}
        initialCardTextSize={props.cardTextSize}
      />

      <DataAccountSection email={props.email} name={props.name} />

      <FeedbackSection />
    </div>
  );
}

/** In-app bug reports / ideas. Posts to /api/feedback (rate-limited server-side). */
function FeedbackSection() {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const tooShort = message.trim().length < 10;

  async function submit() {
    setSending(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        message: message.trim(),
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    });
    setSending(false);
    if (!res.ok) {
      toast.error("Could not send that — please try again.");
      return;
    }
    toast.success("Thanks — we got it.");
    setMessage("");
    setCategory("bug");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
        <CardDescription>
          Found a bug or have an idea? Send it straight to the maintainers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <SettingRow
          name="Type"
          description="What kind of feedback is this?"
        >
          <Segmented
            label="Feedback type"
            value={category}
            disabled={sending}
            options={FEEDBACK_OPTIONS}
            onChange={setCategory}
          />
        </SettingRow>

        <div className="space-y-2">
          <Textarea
            value={message}
            disabled={sending}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What happened, or what would you like to see? (at least 10 characters)"
            maxLength={2000}
            rows={4}
            aria-label="Feedback message"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={sending || tooShort}
              onClick={submit}
            >
              {sending ? "Sending…" : "Send feedback"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AppearanceSection({
  initialTheme,
  initialStudyTheme,
  initialCardTextSize,
}: {
  initialTheme: Theme;
  initialStudyTheme: StudyTheme;
  initialCardTextSize: CardTextSize;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studyTheme, setStudyTheme] = useState<StudyTheme>(initialStudyTheme);
  const [cardTextSize, setCardTextSize] =
    useState<CardTextSize>(initialCardTextSize);

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
      </CardContent>
    </Card>
  );
}

/** Export + destructive reset + account. Reset uses a two-step confirm. */
function DataAccountSection({
  email,
  name,
}: {
  email: string;
  name: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function reset() {
    setResetting(true);
    const res = await fetch("/api/account/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "progress" }),
    });
    setResetting(false);
    setConfirming(false);
    if (!res.ok) {
      toast.error("Could not reset your progress.");
      return;
    }
    toast.success("All progress has been reset.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data &amp; account</CardTitle>
        <CardDescription>Export, reset, and sign out.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <SettingRow
          name="Export data"
          description="Download every word and its progress as a CSV file."
        >
          <Button asChild variant="outline" size="sm">
            <a href="/api/account/export">Export CSV</a>
          </Button>
        </SettingRow>

        <SettingRow
          name="Reset progress"
          description="Wipe all progress and review history. This cannot be undone."
        >
          {confirming ? (
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={reset}
                disabled={resetting}
              >
                {resetting ? "Resetting…" : "Yes, reset everything"}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirming(true)}
            >
              Reset progress
            </Button>
          )}
        </SettingRow>

        {email.endsWith("@guest.local") && (
          <p className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm">
            You&apos;re on a guest account — it works fully, but there&apos;s no
            way to log back in if you sign out. Create a real account to keep
            your progress.
          </p>
        )}

        <SettingRow
          name="Signed in as"
          description={name ? `${email} · ${name}` : email}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </SettingRow>
      </CardContent>
    </Card>
  );
}
