# Weave

[![CI](https://github.com/GabrielKqw/weave/actions/workflows/ci.yml/badge.svg)](https://github.com/GabrielKqw/weave/actions/workflows/ci.yml)

Weave is a lightweight workflow and terminal-intelligence plugin for Claude Code and Codex. It combines two practical ideas in one self-contained project:

- keep implementation small, direct, and verifiable;
- reduce noisy terminal output without hiding failures.

It does not depend on Ponytail, RTK, an MCP server, a daemon, or a database. The implementation uses Node.js standard-library modules only.

## What it provides

| Capability | Claude Code | Codex |
| --- | --- | --- |
| Shared workflow skill | Yes | Yes |
| Task framing and context selection | Yes | Yes |
| Minimalism policy | Yes | Yes |
| Automatic Bash output filtering | Yes, through `PreToolUse` | No |
| Manual CLI | Yes | Yes |
| Local run history and recall | Yes | Yes |

The shared skill turns a request into four concrete fields: Goal, Constraints, Required, and Validation. It then selects a simple or complex workflow, reads only relevant context, records compact handoff state in `.weave/state.md`, and requires evidence before reporting success.

## Terminal intelligence

On Claude Code, the bundled hook sends eligible Bash commands through the Weave CLI:

```text
Claude Code Bash
      |
      v
PreToolUse hook
      |
      v
weave exec
      |
      +-- runs the original command in Bash
      +-- preserves the exit code
      +-- keeps failed-command output complete
      +-- filters successful repetitive output
      +-- stores redacted recovery data when needed
```

Current filters cover:

- `git status`: removes instructional boilerplate;
- `git diff`: removes index metadata while preserving patches;
- `git log`: condenses the default verbose format;
- `rg` and `grep`: groups matches by file;
- common test runners: keeps the final success summary;
- generic output: deduplicates repeated lines and truncates long middles conservatively.

Small output passes through unchanged. Any command that exits non-zero keeps its complete captured stdout and stderr. Each stream has a 20 MB capture limit.

## Requirements

- Node.js 18 or newer;
- Bash available on `PATH` for command execution;
- Claude Code or Codex for plugin use.

On Windows, Weave automatically uses Git Bash from the standard Git for Windows location. For a custom installation, set `WEAVE_BASH` to the full path of `bash.exe`.

## Install in Claude Code

Clone the repository, then register it at project scope:

```bash
git clone https://github.com/GabrielKqw/weave.git
cd weave
claude plugin marketplace add . --scope project
claude plugin install weave@weave --scope project
claude plugin details weave@weave
node bin/weave.js doctor
```

Project scope avoids changing the global Claude Code configuration. The plugin installation registers both the shared skill and the `PreToolUse` hook.

To remove it:

```bash
claude plugin uninstall weave@weave --scope project
claude plugin marketplace remove weave --scope project
```

## Install in Codex

From the cloned repository:

```bash
codex plugin marketplace add .
codex plugin add weave@weave
codex plugin list
```

Codex loads the shared skill from `skills/weave/SKILL.md`. Automatic Bash interception is not enabled because `PreToolUse` is a Claude Code hook. The CLI remains available manually.

## CLI

Run commands from a project directory so `.weave/runs/` belongs to that project.

```bash
node /path/to/weave/bin/weave.js doctor
node /path/to/weave/bin/weave.js exec -- "git status"
node /path/to/weave/bin/weave.js gain
node /path/to/weave/bin/weave.js recall <run-id>
```

`doctor` checks the runtime, manifests, hook registration, skill, and local storage.

`exec` runs a command and prints a stable report:

```text
Command: git status
Exit: 0
Summary: git status (boilerplate hints removed)
Failures: none
Omitted: 4 line(s)
Recovery: weave recall 4f12ab90cd34
```

`gain` compares captured stdout/stderr bytes with the complete formatted reports recorded for the current project. The token figure is an approximation based on four bytes per token; it is not a measurement of total context, session cost, or API spend.

`recall` prints the redacted full capture for a run that failed or had omitted lines.

## Storage and security

Run metadata is stored under `.weave/runs/` with a default retention of 200 runs or 14 days. Run IDs are restricted to 12 hexadecimal characters before any file is read or removed.

Recognizable credentials are redacted before command metadata or recovery output is persisted. Redaction is defense in depth, not a guarantee: secrets without a recognizable shape may remain visible. Do not print credentials to the terminal.

The hook preserves existing Bash tool input fields and fails open if it cannot parse or process a hook event. It skips background commands, already wrapped commands, and commands longer than 4,000 characters. Interactive or TTY-sensitive programs should be run outside the wrapper.

## Project structure

```text
.claude-plugin/             Claude Code manifest and marketplace
.codex-plugin/              Codex manifest
.agents/plugins/            Codex marketplace definition
bin/weave.js                CLI entry point
core/                       execution, filtering, redaction, quoting, storage
hooks/                      Claude Code hook adapter
skills/weave/SKILL.md       shared workflow skill
tests/                      Node.js test suite
```

## Development

No dependency installation is required.

```bash
npm test
npm run check
```

The same checks run on Linux and Windows for every push and pull request.

## Scope

Weave is intentionally small. It does not provide a Codex-to-Claude transport, cross-process orchestration, remote storage, an MCP server, or automatic global installation. Those features should only be added when a real workflow requires them.
