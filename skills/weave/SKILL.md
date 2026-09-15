---
name: weave
description: Use for any coding task that benefits from connecting agents, project context, terminal output, git, tests, and prior decisions into one adaptive workflow. Turns a free-form request into a verifiable task (Goal/Constraints/Required/Validation), classifies it as simple or complex, and runs the matching flow. Reads and writes .weave/state.md so Codex and Claude Code can hand work back and forth. Also use when the user says "weave", "use weave", or asks to continue work tracked in .weave/.
---

# Weave

Weave is not another coding agent. Weave is a lightweight layer that connects
coding agents, project context, terminal tools, git, tests, and prior
decisions into one adaptive workflow.

Tagline: **Different tools. One workflow.**
Principle: **Preserve signal. Remove noise. Keep work connected.**

Follow the steps below in order. Do not skip step 1 or 2 — they are what
keep a "complex" task from turning into unnecessary multi-agent ceremony,
and what keep a "simple" task from being under-specified.

## 1. Frame the task

Rewrite the user's request as four short fields before touching any file.
If the user already gave enough detail, this takes one paragraph, not a
document.

- **Goal**: the verifiable outcome (what should be observably true when done).
- **Constraints**: technical, security, and scope limits (languages, files
  that must not change, backwards-compatibility, performance, licensing).
- **Required**: the changes actually needed — nothing speculative.
- **Validation**: the concrete check that proves it's done (a test, a
  command, a manual repro step).

If `.weave/state.md` already exists for this task, read it first (see
section 6) — another agent (Codex or Claude Code) may have already framed
the task, selected context, or left a pending blocker. Continue from there
instead of re-deriving it.

## 2. Classify: simple or complex

Ask: does this touch one concern in a small, well-understood surface, or
does it span multiple files/modules, require a design decision, or carry a
real risk of side effects?

**Simple** — a single-file or single-concern change, a well-scoped bug fix,
a small refactor, adding a test. Flow:

```
Context → Implementation → Verification
```

Do not invoke Planner, Reviewer, Security, or multiple agents for this.
Do the work directly.

**Complex** — spans multiple files/modules, changes a public interface,
touches shared state, or the right approach isn't obvious yet. Flow:

```
Context → Plan → Build → Review → Tests
```

These are functions performed in sequence, not personas. Don't invent
extended backstories or names for them — "Plan" is a short written plan,
"Review" is a pass over the diff, "Tests" is running/writing validation.

Add a **Security** pass only when the task has a real security surface:
authentication, authorization, credentials/secrets, private data, executing
commands, handling untrusted input, or adding a dependency/external call.
Otherwise skip it — don't add it by default.

### Subagents

Use the platform's native subagent/task-delegation feature only when all
three hold: the platform actually offers it in this session, the phases are
genuinely independent, and splitting them reduces work or improves
verification (e.g. Review running against the diff while Tests run
separately). Otherwise run every phase yourself in the current agent —
that is the default, not the fallback.

- Use the host's task or agent tool when it is available in the current
  session. Otherwise run every phase sequentially in the current agent.

## 3. Context Engine v0

Never dump the whole repository into context. Build a short, justified
context set using tools you already have:

- Project instructions: `AGENTS.md`, `CLAUDE.md`, or equivalent files that
  apply to the touched paths.
- `git status` and `git diff` (run through Weave's own filtering when the
  hook is active — see section 4) for what's already in flight.
- Files the user directly named.
- Targeted search with `rg`/`grep` for the symbol, error string, or
  behavior in question — not a full-repo scan.
- Direct callers of any function you're about to change (`rg` for the
  function name).
- Tests that already cover the touched code.
- Config needed to understand the runtime flow (e.g. the one env var or
  config key that changes behavior).

For every file you pull in, record one line:

```
- file: <path>
  reason: <why this file, specifically>
  relation: <how it relates to Goal/Required>
```

This list is what goes into `.weave/state.md`. If a file doesn't earn a
reason, don't include it.

Do not build embeddings, a vector index, a custom AST, a context database,
or a full-repo crawler. `rg`, `git`, and reading the named files is the
whole engine for v0.

## 4. Terminal Intelligence

Weave has its own terminal-output reduction engine (`core/`, `cli/weave.js`,
`hooks/`) and no external runtime dependency. A `PreToolUse` hook rewrites
eligible Bash calls through `weave exec`. The original command runs unchanged
inside a capturing Bash process. Background commands and commands longer than
4,000 characters are not wrapped.

Current profiles cover Git status/diff/log and common Git actions, searches,
tests, builds, linters, package managers, directory listings, Docker,
Kubernetes, Terraform, and logs. File-reading commands and explicit JSON
output are always verbatim. Unknown small output is also left untouched.

The same engine can be invoked directly:

```
node "<plugin-root>/cli/weave.js" doctor        # confirm the hook/config are wired up
node "<plugin-root>/cli/weave.js" mode [name]   # show or set off/lite/full/ultra
node "<plugin-root>/cli/weave.js" gain          # bytes received vs presented, this project's recorded runs
node "<plugin-root>/cli/weave.js" recall <id>   # full original output for a run that was filtered or failed
```

Every `weave exec` result — whether you triggered it directly or the hook
did — is reported in this shape:

```
Command: <exact command run>
Exit: <exit code>
Summary: <what happened, one or two lines>
Failures: <errors/failures with file:line, or "none">
Omitted: <lines cut for length, or "nothing omitted">
Recovery: <"weave recall <id>", or "nothing to recover" if nothing was omitted>
```

Never report success when the exit code is non-zero. Failed commands keep
their complete captured stdout and stderr. If a command couldn't run at all (blocked
by the host's own permission system, tool missing, etc.), say so plainly —
don't infer or fabricate a result.

Each captured stream is limited to 20 MB. Interactive and TTY-sensitive
programs should be run outside the wrapper.

If Weave's own tooling isn't available for some reason (hook not
installed, running outside a Weave-managed project), fall back to the
target tool's native quiet/short flags (`--oneline`, `--short`, `-q`) —
never install anything silently to work around it.

## 5. Minimalism policy (mandatory baseline)

The active mode is persisted per project in `.weave/mode`. Switch it with
`/weave off`, `/weave lite`, `/weave full`, or `/weave ultra`. `full` is the
default. Lifecycle hooks inject only the selected policy instead of repeating
the whole skill on every prompt.

These ten rules are the `full` baseline:

1. Understand the request and trace the flow it actually affects before editing.
2. Examine callers and integrations before fixing a bug — patch the shared cause, not just the symptom the report named.
3. Ask whether the functionality needs to exist at all before adding it.
4. Reuse what already exists in the repo instead of writing it again.
5. Prefer the standard library and native platform features over a new library.
6. Produce the smallest correct diff — no unrequested abstractions, no speculative flexibility.
7. Run a verification proportional to the risk — a one-line fix needs a quick check; a security- or data-affecting change needs a real one.
8. Never fabricate success when a command couldn't be run — report the blocker plainly (see section 4).
9. Trigger an extra review pass for anything touching security, auth, credentials, money, personal data, or data-loss risk — never simplify those away to shrink a diff.
10. Record only compact, useful context in `.weave/state.md` — not full logs, not speculation, not secrets.

Use the independent `weave-review`, `weave-audit`, `weave-debt`,
`weave-gain`, and `weave-help` skills when their narrower operation is asked
for. They report without silently changing code.

## 6. Shared state: `.weave/state.md`

Create `.weave/` only when this skill actually runs in a project — never
speculatively. Use a single file, `.weave/state.md`, so either agent can
read the other's work:

```markdown
# Weave state

## Task
<one-line description>

## Goal
...

## Constraints
...

## Context selected
- file: ...
  reason: ...
  relation: ...

## Plan
<only for complex tasks>

## Changes made
...

## Review
<findings from the Review pass, if complex>

## Verification
Command: ...
Exit: ...
Summary: ...
Failures: ...

## Open / blocked
<anything unresolved, or "none">
```

Rules:
- If the file exists, read it before starting — don't overwrite context
  another agent (Codex or Claude Code) left behind. Update the relevant
  sections instead of replacing the whole file.
- Never write secrets, tokens, credentials, full log dumps, or personal
  data into this file — it's meant to be readable and, in most projects,
  committable.
- Whether `.weave/state.md` is committed or gitignored is a per-project
  choice — see the README for the tradeoff. Don't decide this silently;
  if the project has no existing convention, ask or leave it untracked by
  default and say so.
