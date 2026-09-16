'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'preread.js');

function tmpCwd(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-preread-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

function runHook(input) {
  return spawnSync(process.execPath, [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
  });
}

function preTool(cwd, toolName, toolInput) {
  return { cwd, hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: toolInput };
}

function allowedReminder(result) {
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'allow');
  assert.match(output.hookSpecificOutput.additionalContext, /^You already /);
}

test('Read is silent first, reminds on unchanged reread, and is silent after change without git', (t) => {
  const cwd = tmpCwd(t);
  const filePath = path.join(cwd, 'notes.txt');
  fs.writeFileSync(filePath, 'first');
  assert.equal(fs.existsSync(path.join(cwd, '.git')), false);

  const input = preTool(cwd, 'Read', { file_path: filePath });
  assert.equal(runHook(input).stdout, '');
  allowedReminder(runHook(input));
  fs.writeFileSync(filePath, 'changed');
  assert.equal(runHook(input).stdout, '');
});

test('Grep and Glob only remind for the same exact search', (t) => {
  const cwd = tmpCwd(t);
  for (const [tool, first, different] of [
    ['Grep', { pattern: 'needle', path: 'src' }, { pattern: 'other', path: 'src' }],
    ['Glob', { pattern: '**/*.js' }, { pattern: '**/*.json' }],
  ]) {
    assert.equal(runHook(preTool(cwd, tool, first)).stdout, '');
    allowedReminder(runHook(preTool(cwd, tool, first)));
    assert.equal(runHook(preTool(cwd, tool, different)).stdout, '');
  }
});

test('fails open with empty stdout for malformed, irrelevant, or invalid input', (t) => {
  const cwd = tmpCwd(t);
  for (const input of [
    '{ broken',
    { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'x' } },
    preTool(cwd, 'Edit', { file_path: 'x' }),
    preTool(cwd, 'Read', { file_path: path.join(cwd, 'missing.txt') }),
  ]) {
    const result = runHook(input);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  }
});

test('hooks manifest adds the preread matcher without changing the Bash entry', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const bash = manifest.hooks.PreToolUse.find((entry) => entry.matcher === '^Bash$');
  const preread = manifest.hooks.PreToolUse.find((entry) => entry.matcher === 'Read|Grep|Glob');
  assert.equal(bash.hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/hooks/pretooluse.js"');
  assert.equal(preread.hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/hooks/preread.js"');
  assert.equal(preread.hooks[0].args, undefined);
});
