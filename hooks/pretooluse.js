#!/usr/bin/env node
'use strict';

const path = require('path');

function hasCodexEnv() {
  if (process.env.OPENAI_CLI_MODEL) return true;
  return Object.keys(process.env).some((key) => key.startsWith('CODEX_'));
}

function readStdin() {
  try {
    return require('fs').readFileSync(0, 'utf8').replace(/^\uFEFF/, '');
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

  if (hasCodexEnv() || process.env.ANTIGRAVITY_SESSION_ID) {
    return;
  }
  if (input.toolCall?.name === 'run_command' || input.tool_name === 'run_command') return;
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
