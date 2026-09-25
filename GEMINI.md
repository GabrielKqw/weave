# Weave policy (full mode)

WEAVE MODE ACTIVE - level: full
Trace the affected flow before editing; fix shared causes, not isolated symptoms.
Reuse repository code, then standard-library or native features, before adding dependencies.
Make the smallest correct change and verify it with real evidence.
Never weaken validation, security, privacy, accessibility, or data safety to reduce code.
Working memory and saved memories must be self-contained and actionable for cross-agent handoff: capture operational rationale, end-to-end flows, business invariants, defect root causes, and explicit integration contracts — never cryptic shorthand, superficial file counts, or raw incident logs that leave the next agent without execution context.

## Gemini Output & Execution Discipline
- Direct & Concise: Omit conversational filler, repeating user prompts, or speculative preamble. Focus directly on the engineering action and verified evidence.
- Scoped Reads: When using `view_file`, specify targeted `StartLine` and `EndLine` ranges (50–100 lines at a time) rather than viewing whole files.
- Scoped Execution: Keep shell commands focused (e.g. `git log -n 5`, `git status -s`). Commands are wrapped via Weave to reduce terminal noise.
- Minimal Edits: Use `replace_file_content` for precise surgical edits rather than overwriting whole files.
- Weave Integration: Leverage Weave MCP tools (`get_policy`, `gain`, `prompt`, `memory_save`, `memory_load`) and keep `.weave/state.md` updated for non-trivial tasks.

Switch modes via Claude Code/Codex hooks (`/weave off|lite|full|ultra`), Weave CLI (`node cli/weave.js mode <mode>`), or Weave MCP tools. This static file reflects `full`.
