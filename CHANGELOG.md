# Changelog

## 0.6.1

- Release 0.6.1: Weave SuperPrompt meta-prompting engine, operational memory tools, strict XML escaping, and CLI prompt commands.

## 0.6.0

- Added Weave SuperPrompt meta-prompting engine (`core/prompt.js`) with structured XML schema (`<weave_superprompt>`), request contract serialization, 5-pillar operational memory extraction, finite step budgeting (`<step>`), quantitative reward scoring (`<reward>`), and automated backtracking (`<backtrack>`).
- Added `weave prompt` CLI command with strict argument validation, option termination (`--`), decimal budget parsing, and support for `--mode`, `--budget`, `--state`, `--memory`, `--agent`, `--raw`, and `--cwd`.
- Added `prompt` tool to Weave MCP server (`mcp/server.js`) with runtime type checking and validation.
- Added `weave-prompt` skill (`skills/weave-prompt/SKILL.md`) for autonomous agent delegation and cross-session handoffs.
- Added 5-Pillar Operational Memory management (`weave memory save/load/list/show/delete`) and MCP tools.
- Hardened XML 1.0 character legality, stripping invalid control characters, NUL bytes, and normalizing lone surrogates.

## 0.5.1

- Fixed a `ReferenceError` in `hooks/pretooluse.js` that crashed on every Bash tool call, silently disabling terminal-output reduction in Claude Code (the outer try/catch swallowed the crash). Confirmed live with a real Codex CLI session on Windows.
- Fixed `hooks/pretooluse.js` and `hooks/preread.js` silently no-op'ing on BOM-prefixed JSON stdin; both now strip a leading BOM like `hooks/lifecycle.js` already did.
- Fixed a regression test in `tests/hook.test.js` that only proved the Codex env-var guard suppressed rewriting, not that the underlying crash was actually fixed; a reintroduced crash now fails the suite explicitly.
- Fixed `core/redact.js` never catching a bare JWT (no `Bearer `/`token=` prefix nearby) - e.g. a JWT sitting in an assertion diff or log line was persisted to `.weave/runs/*.raw.txt` unredacted. Added a pattern anchored on the standard JWT header prefix (`eyJ`).

## 0.5.0

See git history prior to this file's introduction.
