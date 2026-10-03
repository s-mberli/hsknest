import { z } from "zod";

const severity = z.enum(["info", "low", "moderate", "high", "critical"]);
const advisory = z.object({ url: z.string(), severity });
const reportSchema = z.object({
  auditReportVersion: z.literal(2),
  vulnerabilities: z.record(z.string(), z.object({
    severity,
    via: z.array(z.union([z.string(), advisory])),
    nodes: z.array(z.string()).min(1),
  })),
  metadata: z.object({ vulnerabilities: z.object({ total: z.number() }) }),
});

// Development-only, unpatched ESLint glob chain; re-review by this date.
export const AUDIT_EXCEPTION = {
  advisory: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  expires: "2026-10-17T00:00:00Z",
  owner: "s-mberli",
  versions: {
    "node_modules/braces": "3.0.3",
    "node_modules/micromatch": "4.0.8",
    "node_modules/fast-glob": "3.3.1",
    "node_modules/@next/eslint-plugin-next": "16.3.8",
    "node_modules/eslint-config-next": "16.3.8",
  } as Record<string, string>,
};

export function auditFailures(
  input: unknown,
  packages: Record<string, { version?: string; dev?: boolean }>,
  now = new Date()
): string[] {
  const report = reportSchema.parse(input);
  function excepted(name: string, visited = new Set<string>()): boolean {
    if (now >= new Date(AUDIT_EXCEPTION.expires) || visited.has(name)) return false;
    const item = report.vulnerabilities[name];
    if (!item || item.via.length === 0 || item.severity === "critical") return false;
    const next = new Set(visited).add(name);
    return item.nodes.every((node) => packages[node]?.dev === true &&
      packages[node]?.version === AUDIT_EXCEPTION.versions[node]) &&
      item.via.every((via) => typeof via === "string" ? excepted(via, next) :
        via.url === AUDIT_EXCEPTION.advisory && via.severity === "high");
  }
  return Object.entries(report.vulnerabilities)
    .filter(([name, item]) => ["high", "critical"].includes(item.severity) && !excepted(name))
    .map(([name]) => name);
}
