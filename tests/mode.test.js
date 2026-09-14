'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const mode = require('../core/mode');

const HOOK = path.join(__dirname, '..', 'hooks', 'lifecycle.js');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-mode-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function runHook(input) {
  return spawnSync(process.execPath, [HOOK], { input: JSON.stringify(input), encoding: 'utf8' });
}

test('mode defaults to full and validates persisted values', (t) => {
  const dir = tempDir(t);
  assert.equal(mode.readMode(dir), 'full');
  mode.writeMode(dir, 'ultra');
  assert.equal(mode.readMode(dir), 'ultra');
  assert.throws(() => mode.writeMode(dir, 'invalid'));
});

test('mode commands are exact and do not match ordinary prompts', () => {
  assert.equal(mode.requestedMode('/weave lite'), 'lite');
  assert.equal(mode.requestedMode('weave mode full'), 'full');
  assert.equal(mode.requestedMode('stop weave'), 'off');
  assert.equal(mode.requestedMode('please improve weave full time'), null);
});

test('SessionStart injects the active mode', (t) => {
  const dir = tempDir(t);
  mode.writeMode(dir, 'lite');
  const result = runHook({ hook_event_name: 'SessionStart', cwd: dir });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /WEAVE MODE ACTIVE - level: lite/);
});

test('UserPromptSubmit switches mode and returns additional context', (t) => {
  const dir = tempDir(t);
  const result = runHook({ hook_event_name: 'UserPromptSubmit', cwd: dir, prompt: '/weave ultra' });
  assert.equal(result.status, 0);
  assert.equal(mode.readMode(dir), 'ultra');
  const output = JSON.parse(result.stdout);
  assert.match(output.hookSpecificOutput.additionalContext, /level: ultra/);
});

test('UserPromptSubmit stays silent for ordinary prompts', (t) => {
  const dir = tempDir(t);
  const result = runHook({ hook_event_name: 'UserPromptSubmit', cwd: dir, prompt: 'fix the parser' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});
