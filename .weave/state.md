# Weave state

## Task
Review and harden the five implemented audit fixes, then commit the requested files.

## Goal
Verify the packaging, MCP, CLI-help, skill, and test changes; close any input-validation gap; stage only the seven requested tracked files and create the specified conventional commit.

## Constraints
Do not stage `reddit-post.md`, `relatorio-teste-multiagente-weave.pdf`, or this state file. No dependencies, attribution trailers, or unrelated changes.

## Not requested
Changes to the core memory API or CLI memory semantics are out of scope unless needed to secure the MCP boundary.

## Completion criteria
`npm test`, `npm run check`, package dry-run inspection, clean diff check, requested files staged, and the requested commit exists.

## Blocking questions
none

## Working memory
- file: package.json
  reason: verify npm publication allowlist and commands.
  relation: audit finding 1 and final verification.
- file: mcp/server.js
  reason: trace MCP tool dispatch and request validation.
  relation: audit finding 2.
- file: core/memory.js
  reason: confirm MCP memory calls preserve established filesystem safeguards.
  relation: audit finding 2 security pass.
- file: cli/weave.js
  reason: verify help-command dispatch and exit code.
  relation: audit finding 3.
- file: tests/mcp-server.test.js
  reason: assess protocol and memory-tool regression coverage.
  relation: audit findings 2 and 5.
- file: tests/manifests.test.js
  reason: assess packaging and CLI-help regression coverage.
  relation: audit findings 1, 3, and 5.

Confirmed facts: the npm dry run includes `.agents`, `GEMINI.md`, and `AGENTS.md`; `git diff --check` passes. MCP memory operations reuse existing name and symlink protections, but the new boundary did not reject a malformed `cwd` for memory tools or malformed argument objects.

Decisions: harden the MCP boundary centrally, preserving the optional default `cwd` and existing core-memory API.

Commands run: inspected scoped diff and source/tests; `npm pack --dry-run`; `git diff --check`.

Next action: run required checks and package verification; review final diff and commit the requested files only.

## Plan
1. Add central MCP argument-object and optional-cwd validation and apply it to every filesystem tool.
2. Add protocol-level regression coverage for malformed arguments/cwd.
3. Run required checks and package verification; review final diff and commit the requested files only.

## Changes made
Added central MCP argument-object and filesystem-cwd validation, plus regression coverage. No core-memory API changed. Requested files committed as `c7ac7c7`.

## Review
MCP validation gap corrected: its schema is descriptive only, so malformed JSON-RPC `arguments` could reach the handlers; memory tools also accepted a non-string/empty supplied `cwd` as the server process directory.

## Verification
`npm test`: 135/135 passing. `npm run check`: passing, including doctor and generated-artifact checks. `npm pack --dry-run`: includes `.agents/plugins/marketplace.json`, `GEMINI.md`, and `AGENTS.md`. `git diff --check` and `git diff --cached --check`: passing.

## Fidelity check
1. Delivered requested audit fixes and a narrowly scoped MCP validation hardening: yes.
2. Unrequested changes: no; core memory and CLI semantics remain unchanged.
3. Root cause addressed: yes; MCP boundary now enforces its own runtime input contract.
4. Smaller equally correct change: no; two small shared validators cover all filesystem tools.
5. Completion criteria met: checks and staging verification passed; requested commit `c7ac7c7` exists.
6. Evidence: recorded command outputs above.

## Open / blocked
none
