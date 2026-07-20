"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SettingsTabId = "learning" | "interface" | "account" | "support";

const TABS: { id: SettingsTabId; label: string }[] = [
  { id: "learning", label: "Learning" },
  { id: "interface", label: "Interface" },
  { id: "account", label: "Account" },
  { id: "support", label: "Support" },
];

/**
 * Map every known /settings#hash deep-link to its tab. Unknown hashes fall
 * back to the default (learning). "#billing" is linked from TrialBanner and
 * transactional emails and must land on the Account tab.
 */
const HASH_TO_TAB: Record<string, SettingsTabId> = {
  learning: "learning",
  language: "learning",
  workload: "learning",
  scheduling: "learning",
  interface: "interface",
  appearance: "interface",
  account: "account",
  billing: "account",
  support: "support",
  feedback: "support",
};

interface SettingsTabsProps {
  panels: Record<SettingsTabId, React.ReactNode>;
}

/**
 * Client-side tab shell for the settings page. Groups the existing section
 * cards into four tabs; all panels stay mounted (hidden via CSS) so section
 * state and in-flight saves survive tab switches. Deep links: reads
 * `location.hash` on mount (e.g. /settings#billing → Account) and syncs the
 * selected tab back to the hash so refresh/back work.
 */
export function SettingsTabs({ panels }: SettingsTabsProps) {
  const [tab, setTab] = useState<SettingsTabId>("learning");

  // Resolve the initial tab from the hash on mount, and scroll the target
  // anchor (e.g. #billing card) into view once its panel is shown.
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "").toLowerCase();
    if (!raw) return;
    const target = HASH_TO_TAB[raw];
    if (target) {
      queueMicrotask(() => setTab(target));
      // Wait a frame so the panel is unhidden before scrolling to the anchor.
      requestAnimationFrame(() => {
        document.getElementById(raw)?.scrollIntoView({ block: "start" });
      });
    }
  }, []);

  function select(next: SettingsTabId) {
    setTab(next);
    // replaceState avoids polluting history with every tab click while still
    // making refresh land on the same tab.
    window.history.replaceState(null, "", `#${next}`);
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Settings sections"
        className="inline-flex max-w-full overflow-x-auto rounded-lg border p-0.5"
      >
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            role="tab"
            id={`settings-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`settings-panel-${t.id}`}
            variant={tab === t.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => select(t.id)}
            className={cn("h-8 shrink-0", tab !== t.id && "text-muted-foreground")}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`settings-panel-${t.id}`}
          aria-labelledby={`settings-tab-${t.id}`}
          hidden={tab !== t.id}
          className="space-y-6"
        >
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
