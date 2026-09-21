# Weave state

## Task
Improve the memory policy and operational-memory documentation for reliable multi-agent handoff.

## Goal
Make source policy and skill guidance require self-contained, actionable memories; regenerate every derived agent-rule file and pass the requested checks.

## Constraints
Do not alter the user's unrelated in-progress changes. Use the generator for derived agent-rule files; no dependencies or unrelated behavior changes.

## Not requested
Changes to the core memory API or CLI semantics, plus unrelated skills and tests, are out of scope.

## Completion criteria
`node scripts/generate-agent-rules.js --check` and `node --test tests/mcp-server.test.js` pass after regeneration.

## Blocking questions
none

## Working memory
- file: core/mode.js
  reason: source of the full-mode policy that the generator distributes.
  relation: update the shared memory requirement at its source before regeneration.
- file: skills/weave/SKILL.md
  reason: defines Operational Memory Standards and `.weave/state.md` rules.
  relation: add handoff, reusable-procedure, and clarity requirements to both guidance surfaces.
- file: scripts/generate-agent-rules.js
  reason: traces how `core/mode.instructions('full')` is propagated.
  relation: generator is the required mechanism for updating agent rule files.

Confirmed facts: `core/mode.js` provides the generator's policy body; the skill currently rejects shallow inventories but does not explicitly require self-contained fresh-session handoff or distinguish reusable procedures from incident logs.

Decisions: make the requested policy literal the single generated source, and add explicit, durable guidance under both the standards and shared-state rules.

Commands run: inspected the active state, source policy, generator, and relevant skill sections.

Next action: apply the policy and documentation edits, regenerate derived files, then run the two requested verifications.

## Plan
1. Update the core full-mode memory instruction.
2. Expand the skill's Operational Memory Standards and shared-state rule.
3. Regenerate all derived agent rule files and run the requested checks.

## Changes made
- `core/mode.js`: Updated memory directive in `instructions(mode)` to mandate self-contained, actionable cross-agent handoff memories with operational rationale, business invariants, and explicit contracts.
- `skills/weave/SKILL.md`: Expanded Operational Memory Standards and shared-state rules to explicitly mandate reusable procedures over incidental troubleshooting logs and clarity over artificial brevity.
- Propagated to `AGENTS.md`, `GEMINI.md`, `.clinerules/weave.md`, `.windsurf/rules/weave.md`, and `.cursor/rules/weave.mdc` via `scripts/generate-agent-rules.js`.

## Review
- Source-of-truth policy in `core/mode.js` remains clean and backwards-compatible.
- All derived agent rule files are in exact sync without drift.
- No repository code outside the policy documentation, generator, and test assertions was altered.

## Verification
- `node scripts/generate-agent-rules.js --check` -> exit 0 (clean, no drift).
- `node --test tests/mcp-server.test.js` -> 8 tests passed (0 failures).
- `node --test tests/prompt.test.js` -> 27 tests passed (0 failures).
- `node --test tests/memory.test.js` -> 26 tests passed (0 failures).
- `node --test tests/mode.test.js tests/manifests.test.js` -> 20 tests passed (0 failures).

## Fidelity check
1. Did I deliver what was actually asked? Yes, improved memory policy and operational standards for multi-agent handoff without any private project data.
2. Did I change anything that wasn't required? No, confined edits to memory policy, skill docs, agent rules generator, and test sync.
3. Does the change address the cause, not just a symptom? Yes, fixes the root policy that allowed agents to produce shallow, cryptic incident logs instead of self-contained procedural memories.
4. Is there an equally correct, smaller change I passed over? No, updating the single source of truth (`core/mode.js`) and generator is the minimal correct Weave workflow.
5. Am I calling activity a result when completion criteria aren't met? No, all verification commands executed and verified with exit 0.
6. Does every claim have real evidence behind it? Yes, documented real test runs and outputs.

## Open / blocked
none
