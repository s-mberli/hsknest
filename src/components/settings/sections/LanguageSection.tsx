"use client";

import { SectionLabel } from "@/components/ui/section-label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Languages } from "lucide-react";

interface LanguageSectionProps {
  targetLanguageId: string;
  languages: { id: string; name: string }[];
  saving: boolean;
  onTargetLanguageChange: (id: string) => void;
}

export function LanguageSection({
  targetLanguageId,
  languages,
  saving,
  onTargetLanguageChange,
}: LanguageSectionProps) {
  return (
    <section>
      <SectionLabel>Language</SectionLabel>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <label
                htmlFor="target-language-select"
                className="flex items-center gap-2 text-sm font-medium cursor-pointer"
              >
                <Languages className="size-4 text-muted-foreground" />
                Target Language
              </label>
              <p className="max-w-[280px] text-xs text-muted-foreground sm:max-w-md">
                The app focuses on one language at a time to optimize your study. Switch your active target language here; your study progress and word lists for other languages are preserved.
              </p>
            </div>
            <div className="w-[180px]">
              <Select
                id="target-language-select"
                value={targetLanguageId}
                onChange={(e) => onTargetLanguageChange(e.target.value)}
                disabled={saving}
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
