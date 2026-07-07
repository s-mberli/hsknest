/**
 * Shared helpers for the diagnostics scripts. READ-ONLY: nothing here writes
 * to the database.
 *
 * Sets DATABASE_URL (if unset) to an absolute file: URL pointing at
 * <repoRoot>/prisma/dev.db, so scripts work no matter where they are invoked
 * from and despite the space in the repo directory name.
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
// scripts -> recall-diagnostics-toolkit -> skills -> .claude -> repo root
export const repoRoot = path.resolve(scriptsDir, "..", "..", "..", "..");

if (!process.env.DATABASE_URL) {
  const dbPath = path.join(repoRoot, "prisma", "dev.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${dbPath}`;
}

/** Mirrors startOfLocalDay in src/lib/utils.ts (midnight, local server time). */
export function startOfLocalDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toISOString().replace("T", " ").slice(0, 16);
}

/** Minimal fixed-width table printer (no deps). */
export function printTable(headers: string[], rows: (string | number)[][]) {
  const all = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, i) =>
    Math.max(...all.map((r) => (r[i] ?? "").toString().length))
  );
  const line = (r: string[]) =>
    r.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) console.log(line(r.map(String)));
}
