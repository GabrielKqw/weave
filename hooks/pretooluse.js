#!/usr/bin/env node
'use strict';

// Thin Claude Code PreToolUse adapter. This file contains NO filtering
// logic of its own — it only reads the hook's stdin JSON, asks the shared
// Weave core whether/how to rewrite the command, and writes back the
// hookSpecificOutput JSON Claude Code expects. All actual behavior lives in
// ../core/exec.js so Codex (or any future adapter) can reuse the same core
// without duplicating rules.
//
// Fails open by design: any error here — bad JSON, missing fields, an
// exception — falls through to `process.exit(0)` with no stdout, which
// Claude Code treats as "no decision, run the original command unchanged."

const path = require('path');

function readStdin() {
  try {
    return require('fs').readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const raw = readStdin();
  if (!raw) return; // nothing to do, fail open

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return; // malformed input, fail open
  }

  if (input.hook_event_name !== 'PreToolUse') return;
  if (input.tool_name !== 'Bash') return; // never touches Read/Grep/Glob/etc.

  const execCore = require('../core/exec');
  if (!execCore.shouldWrap(input.tool_input || {})) return;

  const weaveJsPath = path.join(__dirname, '..', 'bin', 'weave.js');
  const wrapped = execCore.buildWrappedCommand(input.tool_input.command, weaveJsPath);

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: { ...input.tool_input, command: wrapped },
    },
  };
  process.stdout.write(JSON.stringify(output));
}

try {
  main();
} catch {
  // Fail open: no output, exit 0, original command proceeds untouched.
}
process.exit(0);
