import { StrengthMeter } from "@/components/words/StrengthMeter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STRENGTH_META, wordStrength } from "@/lib/strength";

export interface WordRow {
  id: string;
  term: string;
  translation: string;
  phonetic: string | null;
  state: string | null;
  intervalDays: number | null;
  lapses: number | null;
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
    <span className="inline-flex items-center gap-2">
      <StrengthMeter strength={strength} />
      <span className="text-xs tabular-nums text-muted-foreground">
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
            <TableCell>{w.translation}</TableCell>
            <TableCell className="text-right">
              <StrengthCell word={w} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
