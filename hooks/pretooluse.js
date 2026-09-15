#!/usr/bin/env node
'use strict';

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
  if (!raw) return;

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  if (input.hook_event_name !== 'PreToolUse') return;
  if (input.tool_name !== 'Bash') return;

  const execCore = require('../core/exec');
  if (!execCore.shouldWrap(input.tool_input || {})) return;

  const weaveJsPath = path.join(__dirname, '..', 'cli', 'weave.js');
  const wrapped = execCore.buildWrappedCommand(input.tool_input.command, weaveJsPath, input.cwd);

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
}
process.exit(0);
