import { HelpCircle } from "lucide-react";
import { useState } from "react";

import { HowItWorksModal } from "@/components/HowItWorksModal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { Segmented, SettingRow } from "./shared";

type Algorithm = "SM2" | "LEITNER" | "FSRS";

const ALGORITHMS: { value: Algorithm; label: string; description: string }[] = [
  {
    value: "FSRS",
    label: "FSRS",
    description:
      "Modern Free Spaced Repetition Scheduler. Optimizes reviews for a target retention rate — the recommended default.",
  },
  {
    value: "SM2",
    label: "Adaptive",
    description:
      "Classic SuperMemo-2. Adjusts each card's interval to your recall strength.",
  },
  {
    value: "LEITNER",
    label: "Boxes",
    description:
      "Simple 5-box system with fixed intervals. Predictable and easy to reason about.",
  },
];

const INTERVAL_MODIFIER_OPTIONS = [0.8, 1.0, 1.5, 2.0]; // shown as %
const LAPSE_MODIFIER_OPTIONS = [0, 0.25, 0.5]; // shown as %
const MASTERY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "None" },
  { value: 180, label: "6mo" },
  { value: 365, label: "1yr" },
  { value: 730, label: "2yr" },
];
const DESIRED_RETENTION_OPTIONS = [0.8, 0.85, 0.9, 0.95];

interface SchedulingSectionProps {
  algorithm: Algorithm;
  desiredRetention: number;
  intervalModifier: number;
  lapseModifier: number;
  masteryThresholdDays: number | null;
  fuzzIntervals: boolean;
  saving: boolean;
  onAlgorithmChange: (next: Algorithm) => void;
  onDesiredRetentionChange: (next: number) => void;
  onIntervalModifierChange: (next: number) => void;
  onLapseModifierChange: (next: number) => void;
  onMasteryThresholdDaysChange: (next: number | null) => void;
  onFuzzIntervalsChange: (next: boolean) => void;
}

export function SchedulingSection({
  algorithm,
  desiredRetention,
  intervalModifier,
  lapseModifier,
  masteryThresholdDays,
  fuzzIntervals,
  saving,
  onAlgorithmChange,
  onDesiredRetentionChange,
  onIntervalModifierChange,
  onLapseModifierChange,
  onMasteryThresholdDaysChange,
  onFuzzIntervalsChange,
}: SchedulingSectionProps) {
  const activeAlgo = ALGORITHMS.find((a) => a.value === algorithm);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Scheduling</CardTitle>
            <CardDescription>
              How upcoming reviews are timed. Progress carries over when you change these.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setShowHelp(true)}
          >
            <HelpCircle className="size-4" />
            How it works
          </Button>
        </div>
      </CardHeader>
      <HowItWorksModal open={showHelp} onClose={() => setShowHelp(false)} />
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
              onChange={onAlgorithmChange}
            />
          </SettingRow>
          {activeAlgo && (
            <p className="text-xs text-muted-foreground">
              {activeAlgo.description}
            </p>
          )}
        </div>

        {algorithm === "FSRS" && (
          <SettingRow
            name="Desired retention"
            description="Target probability of recalling a card. Higher means more frequent reviews."
          >
            <Segmented
              label="Desired retention"
              value={desiredRetention}
              disabled={saving}
              options={DESIRED_RETENTION_OPTIONS.map((n) => ({
                value: n,
                label: `${Math.round(n * 100)}%`,
              }))}
              onChange={onDesiredRetentionChange}
            />
          </SettingRow>
        )}

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
            onChange={onIntervalModifierChange}
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
            onChange={onLapseModifierChange}
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
            onChange={onMasteryThresholdDaysChange}
          />
        </SettingRow>

        <SettingRow
          name="Randomize intervals"
          description="Adds a small ±5% wiggle so batches don't all come due on the same day."
        >
          <Switch
            checked={fuzzIntervals}
            disabled={saving}
            onCheckedChange={onFuzzIntervalsChange}
            aria-label="Randomize intervals"
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
