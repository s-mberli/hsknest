import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { auditFailures, AUDIT_EXCEPTION } from "../src/lib/auditPolicy";

const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["audit", "--json"], {
  encoding: "utf8", shell: process.platform === "win32", maxBuffer: 10 * 1024 * 1024,
});
try {
  if (result.error || ![0, 1].includes(result.status ?? -1)) throw new Error("npm audit could not run");
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const failures = auditFailures(JSON.parse(result.stdout), lock.packages);
  if (failures.length) throw new Error(`Unexcepted high/critical dependencies: ${failures.join(", ")}`);
  console.log(`Audit passed. Only the documented development exception is allowed until ${AUDIT_EXCEPTION.expires}.`);
} catch (error) {
  console.error(error);
  if (result.stderr) console.error(result.stderr);
  process.exitCode = 1;
}
