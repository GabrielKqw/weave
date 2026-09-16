'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
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

test('execAndReport returns the command result when run persistence fails', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const saveRun = storage.saveRun;
  t.after(() => { storage.saveRun = saveRun; });
  storage.saveRun = () => { throw new Error('disk unavailable'); };
  const report = execCore.execAndReport('echo out; echo err 1>&2; exit 7', { cwd });
  assert.equal(report.exitCode, 7);
  assert.match(report.presentedStdout, /out/);
  assert.match(report.presentedStderr, /err/);
  assert.equal(report.recovery, 'nothing to recover - history could not be saved');
});

test('runCommand preserves partial output when capture exceeds maxBuffer', () => {
  const result = execCore.runCommand('yes x | head -c 22020096');
  assert.ok(result.stdout.length > 0);
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /weave: bash exited abnormally after partial capture:/);
});

test('stderr deduplication counts collapsed lines as omitted', () => {
  const cwd = tmpCwd();
  const report = execCore.execAndReport('for i in {1..50}; do echo repeated-stderr-line 1>&2; done', { cwd });
  assert.equal(report.omitted, 49);
  assert.notEqual(report.recovery, 'nothing to recover - no content was omitted');
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

test('wrapped execution persists under the tool cwd, not the hook process cwd', () => {
  const processCwd = tmpCwd();
  const toolCwd = tmpCwd();
  const result = spawnSync(process.execPath, [
    path.join(__dirname, '..', 'cli', 'weave.js'),
    'exec', '--cwd', toolCwd, '--', 'echo isolated',
  ], { cwd: processCwd, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(storage.listRuns(processCwd).length, 0);
  assert.equal(storage.listRuns(toolCwd).length, 1);
  fs.rmSync(processCwd, { recursive: true, force: true });
  fs.rmSync(toolCwd, { recursive: true, force: true });
});

test('weave exec rejects missing, option-like, nonexistent, and non-directory --cwd values', (t) => {
  const root = tmpCwd();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'file.txt');
  fs.writeFileSync(file, 'x');
  const cli = path.join(__dirname, '..', 'cli', 'weave.js');
  for (const args of [
    ['exec', '--cwd'],
    ['exec', '--cwd', '--', 'echo should-not-run'],
    ['exec', '--cwd', path.join(root, 'missing'), '--', 'echo should-not-run'],
    ['exec', '--cwd', file, '--', 'echo should-not-run'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /--cwd requires a directory|invalid --cwd/);
    assert.doesNotMatch(result.stdout, /should-not-run/);
  }
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

test('falls back to the original output when a report would be larger', () => {
  const cwd = tmpCwd();
  const report = execCore.execAndReport('echo hi', { cwd });
  const found = storage.loadRun(cwd, report.id);
  assert.equal(report.passthrough, true);
  assert.equal(report.omitted, 0);
  assert.equal(execCore.formatReport(report), 'hi\n');
  assert.equal(found.meta.originalBytes, found.meta.presentedBytes);
  assert.equal(found.meta.presentedBytes, Buffer.byteLength(execCore.formatReport(report), 'utf8'));
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('gain treats legacy oversized reports as zero savings', () => {
  const cwd = tmpCwd();
  storage.saveRun(cwd, { originalBytes: 10, presentedBytes: 20 }, null);
  const run = spawnSync(process.execPath, [path.join(__dirname, '..', 'cli', 'weave.js'), 'gain'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /Report bytes:\s+10/);
  assert.match(run.stdout, /Reduction:\s+0\.0%/);
  fs.rmSync(cwd, { recursive: true, force: true });
});
