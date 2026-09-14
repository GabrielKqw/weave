'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const execCore = require('../core/exec');

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'pretooluse.js');

function runHook(inputObj) {
  const input = typeof inputObj === 'string' ? inputObj : JSON.stringify(inputObj);
  return spawnSync('node', [HOOK_PATH], { input, encoding: 'utf8' });
}

test('hook JSON protocol: rewrites an eligible Bash command with the expected shape', () => {
  const result = runHook({
    session_id: 'abc123',
    cwd: 'C:\\Users\\Admin\\Desktop\\Projetos\\Weave',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'git status', timeout: 120000, run_in_background: false },
    tool_use_id: 'toolu_01ABC',
  });
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
  const cmd = out.hookSpecificOutput.updatedInput.command;
  assert.ok(cmd.startsWith(execCore.SENTINEL));
  assert.ok(cmd.includes('weave.js'));
  assert.ok(cmd.includes('exec --'));
  assert.ok(cmd.includes("--cwd 'C:\\Users\\Admin\\Desktop\\Projetos\\Weave'"));
  assert.ok(cmd.includes("'git status'"));
  assert.equal(out.hookSpecificOutput.updatedInput.timeout, 120000);
  assert.equal(out.hookSpecificOutput.updatedInput.run_in_background, false);
});

test('hook never touches non-Bash tools (e.g. Read, Grep, Glob)', () => {
  for (const toolName of ['Read', 'Grep', 'Glob', 'Edit']) {
    const result = runHook({ hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: { file_path: 'x.txt' } });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '', `expected no output for tool_name ${toolName}`);
  }
});

test('hook ignores non-PreToolUse events', () => {
  const result = runHook({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'git status' } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('hook does not double-wrap a command Weave already rewrote', () => {
  const already = execCore.buildWrappedCommand('git status', 'C:\\weave\\bin\\weave.js');
  const result = runHook({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: already } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '', 'hook must not rewrite an already-wrapped command');
});

test('hook skips backgrounded commands', () => {
  const result = runHook({
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'npm run dev', run_in_background: true },
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('hook fails open on malformed JSON input', () => {
  const result = runHook('{ this is not valid json');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('hook fails open on empty stdin', () => {
  const result = runHook('');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('hook preserves a Windows path embedded in the original command', () => {
  const result = runHook({
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'cat "C:\\Users\\Admin\\Desktop\\Projetos\\Weave\\README.md"' },
  });
  const out = JSON.parse(result.stdout);
  const cmd = out.hookSpecificOutput.updatedInput.command;
  assert.ok(cmd.includes('C:\\Users\\Admin\\Desktop\\Projetos\\Weave\\README.md'));
});
