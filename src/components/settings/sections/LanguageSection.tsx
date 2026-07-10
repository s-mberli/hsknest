"use client";

import { SectionLabel } from "@/components/ui/section-label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Languages } from "lucide-react";

interface LanguageSectionProps {
  targetLanguageId: string | null;
  languages: { id: string; name: string }[];
  saving: boolean;
  onTargetLanguageChange: (id: string | null) => void;
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
              <span className="flex items-center gap-2 text-sm font-medium">
                <Languages className="size-4 text-muted-foreground" />
                Target Language
              </span>
              <p className="max-w-[280px] text-xs text-muted-foreground sm:max-w-md">
                Only show words and lists for this language across the app.
              </p>
            </div>
            <div className="w-[180px]">
              <Select
                value={targetLanguageId ?? "all"}
                onChange={(e) => onTargetLanguageChange(e.target.value === "all" ? null : e.target.value)}
                disabled={saving}
              >
                <option value="all">All Languages</option>
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
