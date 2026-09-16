#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readlog = require('../core/readlog');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '');
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
  if (!['Read', 'Grep', 'Glob'].includes(input.tool_name)) return;

  const cwd = input.cwd || process.cwd();
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== 'object' || Array.isArray(toolInput)) return;

  let result;
  let additionalContext;
  if (input.tool_name === 'Read') {
    if (typeof toolInput.file_path !== 'string') return;
    const content = fs.readFileSync(path.resolve(cwd, toolInput.file_path));
    result = readlog.checkAndRecordRead(cwd, toolInput.file_path, content, 'Read');
    additionalContext = result.repeated
      ? `You already read this file at ${result.previousAt}; its content is unchanged. Reuse what you found unless you have a specific new question.`
      : '';
  } else {
    result = readlog.checkAndRecordSearch(cwd, input.tool_name, toolInput);
    additionalContext = result.repeated
      ? `You already ran this exact search at ${result.previousAt}. Reuse what you found unless you have a specific new question.`
      : '';
  }

  if (!result.repeated) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      additionalContext,
    },
  }));
}

try {
  main();
} catch {
}
process.exit(0);
