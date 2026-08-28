import { cn } from "@/lib/utils";

/**
 * Shared visual anatomy for "show a word's info" surfaces in Reading Mode.
 * Before this, KeywordChip's popover, ReaderView's selectedToken sheet, and
 * its hoverToken tooltip each hand-rolled the same term/pinyin/HSK-badge/
 * meanings layout with a different radius and shadow — this centralizes
 * that shared anatomy (and the app's Single-Shadow Rule + paper-grain
 * texture) so the three placements stay visually consistent going forward.
 * Placement-specific behavior (positioning, backdrop, actions) stays with
 * each caller; this component only owns the card's own look and content.
 */
export type WordInfoPlacement = "popover" | "sheet" | "tooltip";

interface WordInfoCardProps {
  term: string;
  pinyin?: string | null;
  level?: number | null;
  meanings: string[];
  placement: WordInfoPlacement;
  /** e.g. an "In deck ✓" pill, rendered next to the HSK badge. */
  statusBadge?: React.ReactNode;
  /** e.g. an "Add to vocabulary" button or a lookup-count nudge line. */
  footer?: React.ReactNode;
  /** Positioning classes supplied by the caller (absolute/fixed + placement). */
  className?: string;
  /** Bottom-sheet drag-handle bar — only meaningful for placement="sheet". */
  showHandle?: boolean;
  role?: string;
  "aria-modal"?: boolean;
  "aria-label"?: string;
}

const SHAPE: Record<WordInfoPlacement, string> = {
  popover: "rounded-lg p-3 w-56",
  sheet: "rounded-2xl px-4 pt-3 pb-4",
  tooltip: "rounded-xl px-3 py-2 max-w-xs inline-block",
};

const TERM_SIZE: Record<WordInfoPlacement, string> = {
  popover: "text-lg",
  sheet: "text-2xl",
  tooltip: "text-lg",
};

const MEANING_SIZE: Record<WordInfoPlacement, string> = {
  popover: "text-xs",
  sheet: "text-sm",
  tooltip: "text-xs",
};

const MEANING_GAP: Record<WordInfoPlacement, string> = {
  popover: "",
  sheet: "mb-3",
  tooltip: "",
};

export function WordInfoCard({
  term,
  pinyin,
  level,
  meanings,
  placement,
  statusBadge,
  footer,
  className,
  showHandle,
  role,
  "aria-modal": ariaModal,
  "aria-label": ariaLabel,
}: WordInfoCardProps) {
  return (
    <div
      role={role}
      aria-modal={ariaModal}
      aria-label={ariaLabel}
      className={cn(
        "relative overflow-hidden border bg-card shadow-card",
        SHAPE[placement],
        className
      )}
    >
      {/* Paper-grain: ties every word-info surface to the Study/Reading/Ninja family (DESIGN.md). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,var(--foreground)_1.5px,transparent_0)] [background-size:16px_16px]"
      />
      {showHandle && <div className="relative mx-auto mb-2 h-1 w-8 rounded-full bg-muted" />}
      <div className="relative flex items-baseline gap-2 mb-1">
        <span className={cn("font-bold", TERM_SIZE[placement])}>{term}</span>
        {pinyin && <span className="text-xs text-muted-foreground">{pinyin}</span>}
        {level && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
            HSK {level}
          </span>
        )}
        {statusBadge}
      </div>
      <div className={cn("relative", MEANING_GAP[placement])}>
        {meanings.length > 0 ? (
          <div className="space-y-0.5">
            {meanings.map((m, i) => (
              <p key={i} className={cn(MEANING_SIZE[placement], "text-muted-foreground")}>{m}</p>
            ))}
          </div>
        ) : (
          <p className={cn(MEANING_SIZE[placement], "text-muted-foreground italic")}>No dictionary entry</p>
        )}
      </div>
      {footer && <div className="relative mt-2">{footer}</div>}
    </div>
  );
}
