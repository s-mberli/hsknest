# Security Policy

## Supported versions

HSK Nest ships as a single rolling `main` branch (see [RELEASES.md](RELEASES.md)
for version history) — only the latest release is supported. Self-hosters
should track `main`/the latest Docker tag rather than pinning an old commit.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting:
[github.com/s-mberli/hsknest/security/advisories/new](https://github.com/s-mberli/hsknest/security/advisories/new)

If that's not available to you, email the maintainer at the address listed
on the [GitHub profile](https://github.com/s-mberli) with a description of
the issue, steps to reproduce, and (if applicable) a proof of concept.

You should expect an initial response within a few days. Since this is a
solo-maintained project, fix timelines depend on severity — critical
issues affecting self-hosted user data are the highest priority.

## Scope

In scope: the application code in this repository (auth, data handling,
API routes, the scheduler). Third-party dependency vulnerabilities are
tracked via Dependabot and patched on a best-effort basis — see open
alerts at [github.com/s-mberli/hsknest/security/dependabot](https://github.com/s-mberli/hsknest/security/dependabot).

Out of scope: the hosted hsknest.com infrastructure (report those directly
to the maintainer, not as a public advisory), and issues requiring physical
access to a self-hoster's own server.
