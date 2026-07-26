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

import { Segmented, SettingRow } from "./shared";

const DESIRED_RETENTION_OPTIONS = [
  { value: 0.8, label: "Relaxed (80%)" },
  { value: 0.85, label: "Balanced (85%)" },
  { value: 0.9, label: "Standard (90%)" },
  { value: 0.95, label: "Intense (95%)" },
];

interface SchedulingSectionProps {
  desiredRetention: number;
  saving: boolean;
  onDesiredRetentionChange: (next: number) => void;
}

export function SchedulingSection({
  desiredRetention,
  saving,
  onDesiredRetentionChange,
}: SchedulingSectionProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Scheduling</CardTitle>
            <CardDescription>
              How aggressively HSK Nest spaces your reviews. Higher retention
              means more frequent reviews but stronger recall.
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
        <SettingRow
          name="Desired retention"
          description="Target probability of recalling a card. Higher means more frequent reviews."
        >
          <Segmented
            label="Desired retention"
            value={desiredRetention}
            disabled={saving}
            options={DESIRED_RETENTION_OPTIONS}
            onChange={onDesiredRetentionChange}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
