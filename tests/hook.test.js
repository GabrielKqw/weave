'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const execCore = require('../core/exec');

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'pretooluse.js');

function runHook(inputObj, env = {}) {
  const input = typeof inputObj === 'string' ? inputObj : JSON.stringify(inputObj);
  const cleanEnv = { ...process.env };
  for (const key of Object.keys(cleanEnv)) {
    if (key.startsWith('CODEX_') || key.startsWith('ANTIGRAVITY_')) delete cleanEnv[key];
  }
  delete cleanEnv.OPENAI_CLI_MODEL;
  return spawnSync('node', [HOOK_PATH], { input, encoding: 'utf8', env: { ...cleanEnv, ...env } });
}

test('hook JSON protocol: rewrites an eligible Bash command with the expected shape', () => {
  const result = runHook({
    session_id: 'abc123',
    cwd: 'C:\\Users\\user\\Desktop\\Projects\\Weave',
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
  assert.ok(cmd.includes("--cwd 'C:\\Users\\user\\Desktop\\Projects\\Weave'"));
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

test('hook rewrites ordinary Claude Bash input without a swallowed ReferenceError', () => {
  const result = runHook({
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'git status' },
  });
  assert.equal(result.status, 0);
  assert.notEqual(result.stdout, '', 'ordinary Claude input must produce a rewrite, not silently fail open');
  const out = JSON.parse(result.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
  assert.equal(
    out.hookSpecificOutput.updatedInput.command,
    execCore.buildWrappedCommand('git status', path.join(__dirname, '..', 'cli', 'weave.js'))
  );
});

test('hook does not rewrite commands inside Codex', () => {
  const result = runHook(
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' } },
    { CODEX_SESSION_ID: 'codex-session' }
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('hook does not rewrite commands under Codex CLI variants (managed package root, npm model env)', () => {
  const managedResult = runHook(
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' } },
    { CODEX_MANAGED_PACKAGE_ROOT: 'C:\\codex\\pkg' }
  );
  assert.equal(managedResult.status, 0);
  assert.equal(managedResult.stdout, '');

  const modelResult = runHook(
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' } },
    { OPENAI_CLI_MODEL: 'gpt-5.4-codex' }
  );
  assert.equal(modelResult.status, 0);
  assert.equal(modelResult.stdout, '');
});

test('hook ignores non-PreToolUse events', () => {
  const result = runHook({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'git status' } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('hook does not double-wrap a command Weave already rewrote', () => {
  const already = execCore.buildWrappedCommand('git status', 'C:\\weave\\cli\\weave.js');
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
    tool_input: { command: 'cat "C:\\Users\\user\\Desktop\\Projects\\Weave\\README.md"' },
  });
  const out = JSON.parse(result.stdout);
  const cmd = out.hookSpecificOutput.updatedInput.command;
  assert.ok(cmd.includes('C:\\Users\\user\\Desktop\\Projects\\Weave\\README.md'));
});

test('hook Antigravity protocol: rewrites an eligible run_command with overwrite payload', () => {
  const result = runHook({
    conversationId: 'conv-123',
    workspacePaths: ['C:\\Users\\user\\Desktop\\Projects\\Weave'],
    toolCall: {
      name: 'run_command',
      args: { CommandLine: 'git status', Cwd: 'C:\\Users\\user\\Desktop\\Projects\\Weave' },
    },
  });
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.decision, 'allow');
  assert.ok(out.overwrite);
  assert.ok(out.overwrite.CommandLine.includes('weave.js'));
  assert.ok(out.overwrite.CommandLine.includes('exec'));
  if (out.overwrite.CommandLine.includes('--b64')) {
    const match = out.overwrite.CommandLine.match(/--b64\s+([A-Za-z0-9+/=]+)/);
    assert.ok(match);
    assert.equal(Buffer.from(match[1], 'base64').toString('utf8'), 'git status');
  } else {
    assert.ok(out.overwrite.CommandLine.includes('git status'));
  }
});

test('hook Antigravity protocol: does not rewrite an already wrapped command', () => {
  const already = '$env:WEAVE_WRAPPED="1"; node "C:\\weave\\cli\\weave.js" exec -- git status';
  const result = runHook({
    toolCall: {
      name: 'run_command',
      args: { CommandLine: already },
    },
  });
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.decision, 'allow');
  assert.equal(out.overwrite, undefined);
});

