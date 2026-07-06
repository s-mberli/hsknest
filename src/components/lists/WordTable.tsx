import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface WordRow {
  id: string;
  term: string;
  translation: string;
  phonetic: string | null;
  state: string | null;
}

const STATE_LABELS: Record<string, string> = {
  NEW: "New",
  LEARNING: "Learning",
  REVIEW: "Learned",
  LAPSED: "Relearning",
  MASTERED: "Mastered",
  ASSUMED: "Known",
};

export function WordTable({ words }: { words: WordRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Term</TableHead>
          <TableHead>Reading</TableHead>
          <TableHead>Meaning</TableHead>
          <TableHead className="text-right">Status</TableHead>
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
              {w.state ? (
                <span className="text-xs text-muted-foreground">
                  {STATE_LABELS[w.state] ?? w.state}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/60">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
