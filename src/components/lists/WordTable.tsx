import { StrengthMeter } from "@/components/words/StrengthMeter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseMeanings, primaryGloss } from "@/lib/meanings";
import { STRENGTH_META, wordStrength } from "@/lib/strength";

export interface WordRow {
  id: string;
  term: string;
  translation: string;
  metadata?: unknown;
  phonetic: string | null;
  state: string | null;
  intervalDays: number | null;
  lapses: number | null;
}

/** Meaning cell shared by both list tables: primary gloss + "+N" tooltip badge. */
export function MeaningCell({ word }: { word: WordRow }) {
  const meanings = parseMeanings(word);
  const gloss = primaryGloss(word);
  if (meanings.length <= 1) return <>{gloss}</>;
  const extraCount = meanings.length - 1;
  const tooltip = meanings.map((m) => m.gloss).join("\n");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{gloss}</span>
      <span
        title={tooltip}
        className="inline-flex shrink-0 items-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
      >
        +{extraCount}
      </span>
    </span>
  );
}

/** Strength cell shared by both list tables: meter + band + interval days. */
export function StrengthCell({ word }: { word: WordRow }) {
  if (!word.state) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  const strength = wordStrength({
    state: word.state,
    intervalDays: word.intervalDays ?? 0,
    lapses: word.lapses ?? 0,
  });
  const days = Math.round(word.intervalDays ?? 0);
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <StrengthMeter strength={strength} />
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {STRENGTH_META[strength].label}
        {days > 0 ? ` · ${days}d` : ""}
      </span>
    </span>
  );
}

export function WordTable({ words }: { words: WordRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Term</TableHead>
          <TableHead>Reading</TableHead>
          <TableHead>Meaning</TableHead>
          <TableHead className="text-right">Strength</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {words.map((w) => (
          <TableRow key={w.id}>
            <TableCell className="text-base font-medium">{w.term}</TableCell>
            <TableCell className="text-muted-foreground">
              {w.phonetic ?? "—"}
            </TableCell>
            <TableCell>
              <MeaningCell word={w} />
            </TableCell>
            <TableCell className="text-right">
              <StrengthCell word={w} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
