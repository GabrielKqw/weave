---
name: weave-prompt
description: Generate structured Weave SuperPrompts using request contracts, 5-pillar operational memory, step budgeting, reflection, reward scoring (0.0-1.0), backtracking, and the 6-question fidelity gate. Emits clean Markdown text by default, or XML with --xml. Use when generating a portable task contract to hand off across agents, delegate to external LLMs/sessions, or when explicitly asked for a SuperPrompt.
---

# Weave SuperPrompt

A SuperPrompt compiles a task into a single self-contained, highly structured
prompt an agent can execute directly: what is being asked, what is already known
about the codebase, how to spend a bounded reasoning budget, and how to
prove the work is actually done. It emits clean, readable Markdown text by
default, or XML when `--xml` is specified. It is inspired by NeoVertex1/SuperPrompt's
meta-prompting discipline, specialized for Weave's own request contract, working
memory, and fidelity check (see the `weave` skill, sections 1, 3, and 6).

Generate one with:

```
node "<plugin-root>/cli/weave.js" prompt [options] [task...]
```

Flags:

- `--mode=<off|lite|full|ultra>` — which Weave policy governs the task
  (defaults to the project's persisted `.weave/mode`).
- `--budget=<n>` — total reasoning-step budget, an integer from 1 to 50
  (default 10).
- `--state` — ingest `.weave/state.md` (Goal, Constraints, Not requested,
  Completion criteria, and Working memory) into the prompt.
- `--memory=<name>` — ingest a saved snapshot from
  `.weave/memories/<name>.md` (see the `weave` skill's memory tooling).
- `--agent=<name>` — label the executing agent in the output.
- `--xml` — emit machine-parseable XML instead of the default clean Markdown text.
- `--cwd=<dir>` — resolve `.weave/` relative to a directory other than the
  current one.
- `--raw` — compact output whitespace for piping into another tool.

The same operation is available over MCP as the `prompt` tool
(`task`, `mode`, `budget`, `load_state`, `memory_name`, `agent`, `xml`, `raw`, `cwd`).

## The SuperPrompt sections

1. **`<interaction_protocol>`** — `<directives>`, `<response_style>`, and
   `<user_clarification>`. Directs the executing agent to communicate with
   the developer in clear, logical, human-readable Markdown prose (never
   inside raw XML tags), and explicitly commands the agent to pause and ask
   clarifying questions whenever requirements, constraints, or designs are
   ambiguous, contradictory, or in doubt.
2. **`<request_contract>`** — `<goal>`, `<constraints>`, `<invariants>`
   (the active mode's Weave policy text), `<anti_scope>`, and
   `<completion_criteria>`. This is the same contract the `weave` skill's
   section 1 asks you to write before touching a file — the SuperPrompt
   just serializes it.
3. **`<operational_memory>`** — the five Operational Memory Pillars from
   the `weave` skill's section 3, populated from `.weave/state.md`'s
   Working memory (with `--state`) or a saved snapshot (with `--memory`):
   `<execution_flow>`, `<business_rules>`, `<defect_root_cause>`,
   `<schema_contract>`, `<verification_gaps>`. Freeform notes are matched
   to a pillar by keyword — review the result and correct anything
   misclassified before relying on it.
4. **`<reasoning_engine total_budget="N">`** — the step protocol. Each
   `<step>` an agent produces while executing the SuperPrompt should carry
   `<budget remaining="N" total="N"/>`, `<action>`, `<hypothesis>`,
   `<evidence>`, `<reflection>`, and `<reward score="0.0-1.0"/>`. A low
   reward or evidence that contradicts the hypothesis calls for a
   `<backtrack>` — undo the step and revise the plan — instead of pushing
   forward on a wrong path. The budget is a hard ceiling: stop and report
   the remaining gap honestly rather than exceeding it or fabricating
   completion.
5. **`<fidelity_gate status="pending">`** — the same six questions as the
   `weave` skill's section 6, each as a numbered `<question>`. Answer them
   against the request contract before declaring the task done, and flip
   `status` only once every answer holds.
6. **`<output_format>`** — what the finished work must produce:
   `<presentation>` (clear Markdown, no raw XML), `<clarification_gate>`
   (proactive user questions on ambiguity), `<diff>`,
   `<verification_command>`, `<evidence>`, and `<state_update>` (the
   `.weave/state.md` sections to write back, when that file exists for
   the task).

## When to use this vs. the `weave` skill directly

For a task you're executing yourself in the current session, follow the
`weave` skill's steps directly — there's no need to round-trip through
XML you're about to read straight back. Reach for `weave-prompt` when you
need a portable, self-contained artifact: handing a task to a different
agent or session, queuing work for later, or when the user explicitly
asks for a SuperPrompt.
