#!/usr/bin/env node
'use strict';

const fs = require('fs');
const mode = require('../core/mode');

function output(event, text) {
  if (process.env.PLUGIN_DATA) {
    process.stdout.write(JSON.stringify({
      systemMessage: text.split('\n')[0],
      hookSpecificOutput: { hookEventName: event, additionalContext: text },
    }));
  } else if (event === 'SessionStart') {
    process.stdout.write(text);
  } else {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
  }
}

function main() {
  const raw = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '');
  const input = raw ? JSON.parse(raw) : {};

  // Antigravity (Google / Gemini) PreInvocation support
  if (input.invocationNum !== undefined || (input.conversationId && !input.hook_event_name)) {
    const cwd = (Array.isArray(input.workspacePaths) && input.workspacePaths[0]) || process.cwd();
    const text = mode.instructions(mode.readMode(cwd));
    process.stdout.write(JSON.stringify({
      injectSteps: [
        { ephemeralMessage: text }
      ]
    }));
    return;
  }

  const event = input.hook_event_name;
  if (!['SessionStart', 'SubagentStart', 'UserPromptSubmit'].includes(event)) return;
  const cwd = input.cwd || process.cwd();

  if (event === 'UserPromptSubmit') {
    const next = mode.requestedMode(input.prompt);
    if (!next) return;
    try {
      mode.writeMode(cwd, next);
    } catch (e) {
      process.stderr.write(`weave: failed to change mode to ${next}: ${e.message}\n`);
      return;
    }
    output(event, mode.instructions(next));
    return;
  }

  output(event, mode.instructions(mode.readMode(cwd)));
}

try { main(); } catch {}
