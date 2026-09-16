# Changelog

## 0.5.1

- Fixed a `ReferenceError` in `hooks/pretooluse.js` that crashed on every Bash tool call, silently disabling terminal-output reduction in Claude Code (the outer try/catch swallowed the crash). Confirmed live with a real Codex CLI session on Windows.
- Fixed `hooks/pretooluse.js` and `hooks/preread.js` silently no-op'ing on BOM-prefixed JSON stdin; both now strip a leading BOM like `hooks/lifecycle.js` already did.
- Fixed a regression test in `tests/hook.test.js` that only proved the Codex env-var guard suppressed rewriting, not that the underlying crash was actually fixed; a reintroduced crash now fails the suite explicitly.
- Fixed `core/redact.js` never catching a bare JWT (no `Bearer `/`token=` prefix nearby) - e.g. a JWT sitting in an assertion diff or log line was persisted to `.weave/runs/*.raw.txt` unredacted. Added a pattern anchored on the standard JWT header prefix (`eyJ`).

## 0.5.0

See git history prior to this file's introduction.
