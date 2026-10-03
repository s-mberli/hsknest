# Dependency Audit Exception

- Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- Affected package: braces <=3.0.3; installed version 3.0.3.
- Path: eslint-config-next@16.3.8 -> @next/eslint-plugin-next@16.3.8 ->
  fast-glob@3.3.1 -> micromatch@4.0.8 -> braces@3.0.3.
- Owner: s-mberli. Expires: 2026-10-17, UTC.
- Rationale: no patched upstream version is available. This path is
  development-only and receives repository-controlled glob patterns during
  linting, not learner input. Downgrading Next's ESLint configuration to 14
  is not a compatible remediation for Next 16.
- Enforcement: scripts/security-audit.ts rejects every other high/critical
  advisory, production installation, changed package version/path, expired
  exception, and malformed or failed audit response.
- Follow-up: remove the exception after an upstream fix or revisit before expiry.
