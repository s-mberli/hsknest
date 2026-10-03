import { describe, expect, it } from "vitest";
import { auditFailures, AUDIT_EXCEPTION } from "@/lib/auditPolicy";

const NOW = new Date("2026-10-03T00:00:00Z");
const packages = { "node_modules/braces": { version: "3.0.3", dev: true } };
const report = {
  auditReportVersion: 2,
  vulnerabilities: { braces: { severity: "high", nodes: ["node_modules/braces"],
    via: [{ url: AUDIT_EXCEPTION.advisory, severity: "high" }] } },
  metadata: { vulnerabilities: { total: 1 } },
};
describe("dependency audit gate", () => {
  it("allows only the current development advisory", () => {
    expect(auditFailures(report, packages, NOW)).toEqual([]);
  });
  it("blocks expired exceptions and production paths", () => {
    expect(auditFailures(report, packages, new Date("2026-10-18"))).toEqual(["braces"]);
    expect(auditFailures(report, { "node_modules/braces": { version: "3.0.3", dev: false } }, NOW)).toEqual(["braces"]);
  });
  it("blocks other advisories and changed versions", () => {
    const other = structuredClone(report);
    other.vulnerabilities.braces.via[0].url = "https://github.com/advisories/OTHER";
    expect(auditFailures(other, packages, NOW)).toEqual(["braces"]);
    expect(auditFailures(report, { "node_modules/braces": { version: "3.0.4", dev: true } }, NOW)).toEqual(["braces"]);
  });
  it("rejects registry errors rather than passing", () => {
    expect(() => auditFailures({ error: "registry unavailable" }, packages, NOW)).toThrow();
  });
  it("blocks a critical escalation and other transitive sources", () => {
    const critical = structuredClone(report);
    critical.vulnerabilities.braces.severity = "critical";
    expect(auditFailures(critical, packages, NOW)).toEqual(["braces"]);
    const expanded = { ...report, vulnerabilities: { ...report.vulnerabilities,
      micromatch: { severity: "high", nodes: ["node_modules/micromatch"], via: ["braces", "other"] },
    } };
    expect(auditFailures(expanded, { ...packages, "node_modules/micromatch": { version: "4.0.8", dev: true } }, NOW)).toEqual(["micromatch"]);
  });
});
