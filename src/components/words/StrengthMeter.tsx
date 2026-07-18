import { cn } from "@/lib/utils";
import { STRENGTH_META, type Strength } from "@/lib/strength";

/** Fill fraction + color per band — one glance says "how well do I know this". */
const METER: Record<Strength, { fill: number; className: string }> = {
  mastered: { fill: 1, className: "bg-success" },
  solid: { fill: 0.8, className: "bg-success/80" },
  growing: { fill: 0.5, className: "bg-primary" },
  shaky: { fill: 0.25, className: "bg-destructive" },
  known: { fill: 0.9, className: "bg-muted-foreground/60" },
  // Floor high enough to read as "empty strength", not a missing bar.
  new: { fill: 0.22, className: "bg-muted-foreground/50" },
};

/** Slim horizontal strength bar shown next to words anywhere progress exists. */
export function StrengthMeter({
  strength,
  className,
}: {
  strength: Strength;
  className?: string;
}) {
  const m = METER[strength];
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted align-middle",
        className
      )}
      role="img"
      aria-label={`Strength: ${STRENGTH_META[strength].label}`}
    >
      <span
        className={cn("block h-full rounded-full", m.className)}
        style={{ width: `${m.fill * 100}%` }}
      />
    </span>
  );
}
