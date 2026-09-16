# Weave state

## Task
Give Weave a real request-contract/plan/reread-detection discipline (not just terminal-noise reduction), and keep Claude Code + Codex CLI compatible on Windows.

## Goal
Closed. Both are shipped, tested, and validated with real evidence (not just claims).

## Constraints
No new runtime dependency. No daemon/db/telemetry. Never weaken failure integrity or secret redaction to shrink a diff.

## Completion criteria
`npm test` and `npm run check` pass; every fix has a regression test; security-relevant fixes (redaction) verified against a real reproduction, not just a unit test.

## Changes made
See `CHANGELOG.md` for the user-facing summary and `git log` for full detail. Since 0.5.0: fixed a `ReferenceError` that silently disabled terminal-output reduction for every Bash call (a5832dd), fixed BOM-prefixed stdin being silently ignored in two hooks and tightened the regression test that missed it (dcfa79a, found via an independent review), fixed `core/redact.js` never catching a bare JWT with no keyword prefix (b6559f6, found via a live SaaS-shaped simulation: login test failure output put a real signed JWT in an assertion diff, unredacted in `.weave/runs/`).

## Verification
`npm test`: 97/97. `npm run check`: all green. Live end-to-end checks: real Codex CLI session on Windows (git status via PowerShell, unmangled), a 13-scenario production-simulation battery in a throwaway project (failure integrity, exit-code propagation, recovery, BOM), and a SaaS-shaped demo (auth/JWT/products) that is what surfaced the redaction gap.

## Fidelity check
1. Delivered what was asked - yes, each fix traces to a real, reproduced defect, not a hypothetical one.
2. Changed anything not required - no; version bump to 0.5.1 and this CHANGELOG follow the project's own existing precedent (see `f06162f`) for exactly this situation (real fixes shipped, pinned version left stale).
3. Addresses the cause, not a symptom - yes for all four fixes (root variable name, missing BOM strip, an assertion that couldn't distinguish crash from correct skip, a redaction pattern gap).
4. Evidence behind every claim - yes: exact byte counts, exact commit hashes, a real reproduction for each bug before calling it fixed.

## Open / blocked
None. Working tree clean, `main` and `origin/main` in sync as of `b6559f6` plus this version/changelog update.
