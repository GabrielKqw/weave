---
name: weave
description: Use for any coding task that benefits from a request contract, a short pre-edit plan, working memory across a session, and a fidelity check before declaring done - connecting agents, project context, terminal output, tests, git, and prior decisions into one adaptive workflow. Turns a free-form request into a verifiable contract (Goal/Constraints/Required/Not requested/Completion criteria), classifies it as simple or complex, and runs the matching flow. Reads and writes .weave/state.md so Codex and Claude Code can hand work back and forth. Also use when the user says "weave", "use weave", or asks to continue work tracked in .weave/.
---

# Weave

Weave is not another coding agent. Weave is a lightweight layer that connects
coding agents, project context, terminal tools, git, tests, and prior
decisions into one adaptive workflow.

Tagline: **Different tools. One workflow.**
Principle: **Preserve signal. Remove noise. Keep work connected.**

Git is one possible source of context (status, diff, log, blame) — never
the center of this skill. Everything below applies the same way whether
or not the current directory is a git repository.

The cycle Weave drives is:

```
UNDERSTAND -> PLAN -> READ WHAT'S NEEDED -> DECIDE -> IMPLEMENT THE MINIMUM -> VALIDATE
```

Follow the steps below in order. Do not skip step 1 or 2 — they are what
keep a "complex" task from turning into unnecessary multi-agent ceremony,
what keep a "simple" task from being under-specified, and what stop
activity (files opened, searches run, code written) from being mistaken
for progress toward the actual request.

## 1. Request contract

Rewrite the user's request as explicit fields before touching any file.
If the user already gave enough detail, this takes one paragraph, not a
document. This contract is what the Fidelity check (section 6) compares
the finished work against — write it before you have a reason to defend
a particular approach, not after.

- **Goal**: the verifiable outcome (what should be observably true when done).
- **Constraints**: technical, security, and scope limits (languages, files
  that must not change, backwards-compatibility, performance, licensing).
- **Required**: the changes actually needed — nothing speculative.
- **Not requested**: adjacent things the request does *not* ask for —
  say them explicitly so a later change doesn't drift into them because
  they were merely "nearby."
- **Completion criteria**: the concrete check that proves it's done (a
  test, a command, a manual repro step) — this is the Validation step,
  named for what it actually verifies.
- **Blocking questions**: only what genuinely cannot be decided without
  the user, because the answer would materially change the result. An
  ambiguity that doesn't change the outcome gets a stated, reasonable
  assumption instead of a question — don't invent a requirement either
  way; write down what you assumed and why.

If `.weave/state.md` already exists for this task, read it first (see
section 7) — another agent (Codex or Claude Code) may have already framed
the task, built working memory, or left a pending blocker. Continue from
there instead of re-deriving it; update the contract only if new evidence
actually changes it.

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
Do the work directly. Keep the request contract as the one paragraph
section 1 describes and hold it in your own reasoning — do not create
`.weave/state.md` for a simple task just to externalize that paragraph.
Only write the file if the task turns out to need a handoff to another
agent, grows past "simple" mid-task, or the user asked for it tracked.
A `.weave/state.md` that adds a read, a directory, and a write without
changing what gets built is the process getting in its own way.

**Complex** — spans multiple files/modules, changes a public interface,
touches shared state, or the right approach isn't obvious yet. Flow:

```
Context → Plan → Build → Review → Tests
```

These are functions performed in sequence, not personas. Don't invent
extended backstories or names for them — "Plan" is a short written plan,
"Review" is a pass over the diff, "Tests" is running/writing validation.

Write the plan in `.weave/state.md` before the first edit. It holds only:
the cause or hypothesis being investigated, the parts it affects, the
minimal execution sequence, and the final validation. New evidence can
change the plan — update it in place when that happens. It should not be
rebuilt from scratch each time you learn something; if you're rewriting
the whole plan repeatedly instead of adjusting one part of it, that's a
sign the investigation, not the plan, needs another pass.

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

Never dump the whole repository into context. Start from the request's
actual entry points (the file/function the user named, the error's
location, the command that fails) and follow real dependencies outward —
expand to another file only when a concrete caller, import, or reference
leads there. A full-repo scan is not a default starting move.

Build a short, justified context set using tools you already have:

- Project instructions: `AGENTS.md`, `CLAUDE.md`, or equivalent files that
  apply to the touched paths.
- Files the user directly named.
- Targeted search with `rg`/`grep` for the symbol, error string, or
  behavior in question — not a full-repo scan.
- Direct callers of any function you're about to change (`rg` for the
  function name).
- Tests that already cover the touched code.
- Config needed to understand the runtime flow (e.g. the one env var or
  config key that changes behavior).
- `git status`/`git diff` (run through Weave's own filtering when the
  hook is active — see section 4) *only* when the task needs to know
  what's already in flight — it's a source of context, not a required
  step, and everything above works the same with no `.git` present at all.

Every search and every read answers one concrete question. Before
repeating a read or a search, check: did this content change? is there a
genuinely new question? was the prior read incomplete for what you need
now? If none of those hold, reuse what you already found instead of
re-deriving it — see Working memory below. This is a reminder, not a
lock: a read that's actually needed (the file changed, a new question
came up) always proceeds normally.

For every file you pull in, record one line in `.weave/state.md`'s
Working memory:

```
- file: <path>
  reason: <why this file, specifically>
  relation: <how it relates to Goal/Required>
```

If a file doesn't earn a reason, don't include it.

### Working memory

`.weave/state.md`'s Working memory section (see section 7) is where
findings live during the task, so they don't have to be rediscovered:

- files read, and why each one earned a read
- facts confirmed (not restated from a guess — actually verified)
- decisions taken, and what made them the right call
- hypotheses considered and discarded, and why
- commands run and their relevant result (not full logs)
- the next concrete action

Update it as you go, not as a wrap-up at the end — it's only useful if
it's current when the next read-or-reread decision comes up.

#### Operational Memory Standards

Working memory records *engineering knowledge*, not an inventory. Never
write a shallow census — a file count, a line count, a table/column
frequency tally, or a bare list of filenames with no explanation of what
they do or why they matter ("there are 168 files", "table PRODNFI
appears 116 times"). A census can always be regenerated with `find` or
`grep`; it isn't worth a line in memory. What's worth recording is what a
search can't hand back on its own: what the code actually does, why it
breaks, and what's still unverified.

**Self-Contained Cross-Agent Handoff.** Every memory must explain both the
*why* and the *how* with enough context for another agent in a fresh session
to continue without prior chat history or re-asking the user. State the
operational rationale, relevant flow, decisions or invariants, and the next
action or verification condition when they matter; do not rely on cryptic
shorthand or unstated context.

**Reusable Procedures vs. Incidental Troubleshooting.** When recording a
workflow, setup step, or testing practice, preserve the reusable procedure:
the ordered steps, inputs or preconditions, expected outcome, and applicable
contract. Do not save ephemeral debugging logs, raw incident output, or
one-off symptoms unless they establish a durable root cause or reusable
failure mode.

**Clarity Over Artificial Brevity.** Remove noise by omitting shallow
inventories and raw logs, not by cutting essential explanation, design
rationale, or step-by-step guidance. Keep memories concise only when their
meaning and execution context remain complete.

Every entry you save — here or via `weave memory save` (see section 7)
— must fit one of the five Operational Memory Pillars:

1. **Execution Flow & Trace** — the real call path from trigger to
   effect: UI action or entry point → handler → business logic →
   persistence or external service call. Name the functions/files in
   the path, not just the endpoints.
2. **Business Rules & Invariants** — validation rules, constraints, and
   domain-specific transformations the code enforces, stated as rules
   ("X must be non-negative before Y runs"), not as a description of
   the file that happens to contain them.
3. **Failure Modes, Defect Root Causes & Error Codes** — the exact
   mechanism behind a bug (not just its symptom), specific error codes
   encountered (e.g. SEFAZ 1001), and the edge case that triggers each
   one.
4. **Integration Contracts & Schema Mappings** — how tables/entities/
   services connect: keys, required fields, schema constraints, and the
   assumptions each side of an integration makes about the other.
5. **Test & Verification Gaps** — what's actually been verified (with
   how), what remains untested, and the concrete repro steps for
   anything still open.

If a fact doesn't fit one of these five pillars, it likely isn't worth
recording — prefer re-deriving it with a targeted search over saving
noise.

When Weave's own reread-detection hook is active in Claude Code
(`hooks/preread.js`, matching the `Read`/`Grep`/`Glob` tools), a repeated
read or search on content that hasn't changed surfaces a short reminder
automatically. Treat that reminder as confirmation to pull the answer
from Working memory instead of re-deriving it, not as a request to argue
past it — and if it fires on a read you know is legitimately new
information, that's fine, it never blocks the read.

Do not build embeddings, a vector index, a custom AST, a context
database, or a full-repo crawler. `rg`, targeted reads, and the working
memory above are the whole engine for v0.

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
node "<plugin-root>/cli/weave.js" doctor        # static sanity check of the installation (files, config, permissions) - not an end-to-end lifecycle test
node "<plugin-root>/cli/weave.js" mode [name]   # show or set off/lite/full/ultra
node "<plugin-root>/cli/weave.js" gain          # bytes received vs presented, this project's recorded runs
node "<plugin-root>/cli/weave.js" recall <id>   # full original output for a run that was filtered or failed
```

When a reduced report would actually be smaller than the original output,
the `weave exec` result — whether you triggered it directly or the hook
did — is reported in this shape (otherwise Weave passes the original
stdout/stderr through verbatim, with no envelope):

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

Before writing any new code, check in order — stop at the first "yes":

1. Does this actually need to exist? (a real requirement, not a guess at future need)
2. Does the project already have something equivalent?
3. Does the standard library solve it?
4. Does the platform solve it natively?
5. Does an already-installed dependency solve it?
6. Can the fix land at the shared point every caller already goes
   through, instead of at each call site?
7. Could code be removed here instead of added?

Do not create: an abstraction with a single implementation; configuration
for a value that never varies; a generic system for one concrete case;
files "for later"; a wrapper that only renames a call; documentation that
promises behavior that isn't implemented yet; or a test that repeats
existing coverage without exercising a genuinely different risk.

Use the independent `weave-review`, `weave-audit`, `weave-debt`,
`weave-gain`, and `weave-help` skills when their narrower operation is asked
for. They report without silently changing code.

## 6. Fidelity check

Before declaring the task done, answer these against the Request
contract from section 1 — in `.weave/state.md`'s Fidelity check section,
not just silently in your head:

1. Did I deliver what was actually asked?
2. Did I change anything that wasn't required?
3. Does the change address the cause, not just a symptom?
4. Is there an equally correct, smaller change I passed over?
5. Am I calling activity — files opened, commands run, lines written —
   a result, when the Completion criteria aren't actually met?
6. Does every claim I'm about to make have real evidence behind it (a
   command's actual output, a test that actually ran) rather than an
   assumption that it would work?

A technically valid change that solves a different problem than the one
in the Request contract is not done. Go back to section 1 and reconcile
the gap before reporting completion — don't report success and let the
mismatch surface later.

## 7. Shared state: `.weave/state.md`

Create `.weave/` only when the task actually calls for it (see section
2 — most simple tasks don't) — never speculatively, and never as a
default action for every request this skill handles. Use a single file,
`.weave/state.md`, so either agent can read the other's work:

```markdown
# Weave state

## Task
<one-line description>

## Goal
...

## Constraints
...

## Not requested
<adjacent things explicitly out of scope, or "none noted">

## Completion criteria
...

## Blocking questions
<only questions that would materially change the result, or "none">

## Working memory
- file: ...
  reason: ...
  relation: ...

Confirmed facts: ...
Decisions: ...
Discarded hypotheses: ...
Commands run: ...
Next action: ...

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

## Fidelity check
<answers to section 6's questions, or "not yet run">

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
- Working memory and any `weave memory save` entry must follow the
  Operational Memory Standards defined in section 3. They must be
  self-contained and actionable for a fresh cross-agent handoff: explain the
  why and how, including reusable procedures, ordered steps, and applicable
  contracts where relevant, so the next agent need not reconstruct prior
  chat context or re-ask the user. Remove shallow censuses (file counts, line
  counts, table/column frequency tallies, bare filename lists) and raw
  incident logs, but retain essential explanations, design rationale, and
  step-by-step guidance. Record execution flow, business rules and
  invariants, failure modes/root causes/error codes, integration contracts
  and schema mappings, and test/verification gaps instead.
- Whether `.weave/state.md` is committed or gitignored is a per-project
  choice — see the README for the tradeoff. Don't decide this silently;
  if the project has no existing convention, ask or leave it untracked by
  default and say so.
