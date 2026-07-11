/**
 * Tiny hand-written delimited-text parser for word imports. No CSV dependency:
 * handles tab/comma delimiters, double-quoted fields (with escaped "" quotes
 * and embedded delimiters/newlines), and ragged rows. Callers map columns to
 * word fields and dedupe by term.
 */

export type ColumnRole = "term" | "translation" | "phonetic" | "meanings" | "ignore";

export interface ParsedWord {
  term: string;
  translation: string;
  phonetic: string | null;
  /** Individual senses (split on ";") when a "meanings" column is mapped. */
  meanings: string[] | null;
}

export interface ParseOptions {
  /** "auto" sniffs tab vs comma from the first non-empty line. */
  delimiter?: "auto" | "tab" | "comma";
  /**
   * Column roles by index. Defaults to [term, translation, phonetic]. Extra
   * columns beyond the map are ignored.
   */
  columns?: ColumnRole[];
}

export interface ParseResult {
  words: ParsedWord[];
  /** Rows dropped because they were blank, missing a term, or a duplicate term. */
  skipped: number;
  /** Breakdown of `skipped`, for a human-readable import summary. */
  skippedNoTerm: number;
  skippedDuplicate: number;
}

const DEFAULT_COLUMNS: ColumnRole[] = ["term", "translation", "phonetic"];

/** Pick a delimiter, sniffing tab-first when set to "auto". */
function resolveDelimiter(text: string, mode: "auto" | "tab" | "comma"): string {
  if (mode === "tab") return "\t";
  if (mode === "comma") return ",";
  const firstLine = text.split(/\r\n|\r|\n/).find((l) => l.trim().length > 0);
  if (firstLine && firstLine.includes("\t")) return "\t";
  return ",";
}

/**
 * Split a whole document into rows of fields, honoring double-quoted fields.
 * A quote inside a quoted field is escaped by doubling it ("").
 */
function tokenize(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      // Consume \r\n as a single break.
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // Flush the final field/row (no trailing newline).
  row.push(field);
  rows.push(row);
  return rows;
}

export function parseDelimited(
  text: string,
  options: ParseOptions = {}
): ParseResult {
  const delimiter = resolveDelimiter(text, options.delimiter ?? "auto");
  const columns = options.columns ?? DEFAULT_COLUMNS;

  const termIdx = columns.indexOf("term");
  const translationIdx = columns.indexOf("translation");
  const phoneticIdx = columns.indexOf("phonetic");
  const meaningsIdx = columns.indexOf("meanings");

  const rows = tokenize(text, delimiter);
  const words: ParsedWord[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let skippedNoTerm = 0;
  let skippedDuplicate = 0;

  for (const cells of rows) {
    const term =
      termIdx >= 0 ? (cells[termIdx] ?? "").trim() : "";
    // Skip entirely-blank rows silently; count rows with content but no term.
    const rowHasContent = cells.some((c) => c.trim().length > 0);
    if (!rowHasContent) continue;

    if (!term) {
      skipped += 1;
      skippedNoTerm += 1;
      continue;
    }

    const key = term.toLowerCase();
    if (seen.has(key)) {
      skipped += 1;
      skippedDuplicate += 1;
      continue;
    }
    seen.add(key);

    let translation =
      translationIdx >= 0 ? (cells[translationIdx] ?? "").trim() : "";
    const phoneticRaw =
      phoneticIdx >= 0 ? (cells[phoneticIdx] ?? "").trim() : "";
    const meaningsRaw =
      meaningsIdx >= 0 ? (cells[meaningsIdx] ?? "").trim() : "";
    const meanings =
      meaningsRaw.length > 0
        ? meaningsRaw
            .split(";")
            .map((m) => m.trim())
            .filter((m) => m.length > 0)
        : null;
    // A meanings column can stand in for a missing translation.
    if (!translation && meanings) translation = meanings.slice(0, 3).join("; ");

    words.push({
      term,
      translation,
      phonetic: phoneticRaw.length > 0 ? phoneticRaw : null,
      meanings,
    });
  }

  return { words, skipped, skippedNoTerm, skippedDuplicate };
}
