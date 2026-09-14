'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const execCore = require('../core/exec');
const storage = require('../core/storage');

function tmpCwd() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weave-exec-test-'));
}

test('execAndReport preserves a non-zero exit code', () => {
  const cwd = tmpCwd();
  const report = execCore.execAndReport('exit 7', { cwd });
  assert.equal(report.exitCode, 7);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('execAndReport preserves stderr content, kept separate from stdout', () => {
  const cwd = tmpCwd();
  const report = execCore.execAndReport('echo out-line; echo err-line 1>&2', { cwd });
  assert.ok(report.presentedStdout.includes('out-line'));
  assert.ok(report.presentedStderr.includes('err-line'));
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('a failing command gets a recoverable id, and weave recall returns the full original output', () => {
  const cwd = tmpCwd();
  const report = execCore.execAndReport('echo boom 1>&2; exit 1', { cwd });
  assert.equal(report.exitCode, 1);
  assert.notEqual(report.recovery, 'nothing to recover - no content was omitted');
  const id = report.id;
  const found = storage.loadRun(cwd, id);
  assert.ok(found.raw, 'raw recovery text should have been persisted for a failing command');
  assert.ok(found.raw.includes('boom'));
  assert.ok(found.raw.includes('[exit] 1'));
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('a small, clean, passing command needs no recovery', () => {
  const cwd = tmpCwd();
  const report = execCore.execAndReport('echo hi', { cwd });
  assert.equal(report.exitCode, 0);
  assert.equal(report.recovery, 'nothing to recover - no content was omitted');
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('unknown commands with small output pass through unchanged', () => {
  const cwd = tmpCwd();
  const report = execCore.execAndReport('printf "hello world\\n"', { cwd });
  assert.equal(report.presentedStdout, 'hello world\n');
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('buildWrappedCommand output is recognized as already-wrapped (recursion guard)', () => {
  const wrapped = execCore.buildWrappedCommand('git status', 'C:\\weave\\bin\\weave.js');
  assert.ok(wrapped.startsWith(execCore.SENTINEL));
  assert.equal(execCore.isAlreadyWrapped(wrapped), true);
  assert.equal(execCore.shouldWrap({ command: wrapped }), false);
});

test('shouldWrap excludes background commands and empty/missing commands', () => {
  assert.equal(execCore.shouldWrap({ command: 'git status', run_in_background: true }), false);
  assert.equal(execCore.shouldWrap({}), false);
  assert.equal(execCore.shouldWrap({ command: '' }), false);
  assert.equal(execCore.shouldWrap({ command: 'git status' }), true);
});

test('shouldWrap excludes commands beyond the safety length cap', () => {
  const long = 'echo ' + 'a'.repeat(execCore.MAX_WRAP_LEN + 10);
  assert.equal(execCore.shouldWrap({ command: long }), false);
});

test('stored metadata redacts secrets from the command', () => {
  const cwd = tmpCwd();
  const report = execCore.execAndReport('printf "token=supersecretvalue"', { cwd });
  const found = storage.loadRun(cwd, report.id);
  assert.ok(!found.meta.command.includes('supersecretvalue'));
  assert.ok(found.meta.command.includes('[REDACTED]'));
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('presented byte accounting includes the complete formatted report', () => {
  const cwd = tmpCwd();
  const report = execCore.execAndReport('echo hi', { cwd });
  const found = storage.loadRun(cwd, report.id);
  assert.equal(found.meta.presentedBytes, Buffer.byteLength(execCore.formatReport(report), 'utf8'));
  fs.rmSync(cwd, { recursive: true, force: true });
});
