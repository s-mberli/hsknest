import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Segmented, SettingRow } from "./shared";

const DAILY_NEW_OPTIONS = [0, 5, 10, 20, 40];
const ASSUMED_CHECK_OPTIONS = [0, 1, 3, 5];

interface WorkloadSectionProps {
  dailyNewWords: number;
  assumedCheckPerDay: number;
  saving: boolean;
  onDailyNewWordsChange: (next: number) => void;
  onAssumedCheckPerDayChange: (next: number) => void;
}

export function WorkloadSection({
  dailyNewWords,
  assumedCheckPerDay,
  saving,
  onDailyNewWordsChange,
  onAssumedCheckPerDayChange,
}: WorkloadSectionProps) {
  return (
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
            onChange={onDailyNewWordsChange}
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
            onChange={onAssumedCheckPerDayChange}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
