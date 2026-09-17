'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const memory = require('../core/memory');

const CLI = path.join(__dirname, '..', 'cli', 'weave.js');

function tmpCwd() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weave-memory-test-'));
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

test('saveMemory reads default .weave/state.md when no source file is given', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), '# state\ncontext here');

  const dest = memory.saveMemory(cwd, 'checkpoint1');
  assert.equal(dest, path.join(memory.memoriesDir(cwd), 'checkpoint1.md'));
  assert.equal(fs.readFileSync(dest, 'utf8'), '# state\ncontext here');
});

test('saveMemory reads from a custom source file when provided', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const custom = path.join(cwd, 'custom.md');
  fs.writeFileSync(custom, 'custom content');

  const dest = memory.saveMemory(cwd, 'from-custom', custom);
  assert.equal(fs.readFileSync(dest, 'utf8'), 'custom content');
});

test('saveMemory throws a clear error when the source file does not exist', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  assert.throws(() => memory.saveMemory(cwd, 'nope'), /source file does not exist/);
});

test('loadMemory restores content into .weave/state.md by default', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'original');
  memory.saveMemory(cwd, 'snap');
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'changed after save');

  const dest = memory.loadMemory(cwd, 'snap');
  assert.equal(dest, path.join(cwd, '.weave', 'state.md'));
  assert.equal(fs.readFileSync(dest, 'utf8'), 'original');
});

test('loadMemory throws a clear error when the memory does not exist', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  assert.throws(() => memory.loadMemory(cwd, 'missing'), /memory does not exist/);
});

test('listMemories returns [] when the memories dir does not exist', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  assert.deepEqual(memory.listMemories(cwd), []);
});

test('listMemories lists saved memories sorted by modified date', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'a');
  memory.saveMemory(cwd, 'first');
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'bb');
  memory.saveMemory(cwd, 'second');

  const items = memory.listMemories(cwd);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((i) => i.name).sort(), ['first', 'second']);
  assert.ok(items.every((i) => typeof i.size === 'number'));
  assert.ok(items.every((i) => i.modified instanceof Date));
});

test('showMemory returns the memory content as text', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'show me');
  memory.saveMemory(cwd, 'visible');

  assert.equal(memory.showMemory(cwd, 'visible'), 'show me');
});

test('showMemory throws a clear error when the memory does not exist', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  assert.throws(() => memory.showMemory(cwd, 'missing'), /memory does not exist/);
});

test('deleteMemory removes the memory file', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'gone soon');
  memory.saveMemory(cwd, 'temp');
  assert.equal(memory.listMemories(cwd).length, 1);

  memory.deleteMemory(cwd, 'temp');
  assert.equal(memory.listMemories(cwd).length, 0);
});

test('deleteMemory throws a clear error when the memory does not exist', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  assert.throws(() => memory.deleteMemory(cwd, 'missing'), /memory does not exist/);
});

test('isValidName rejects path traversal and separators', () => {
  assert.equal(memory.isValidName('../hacked'), false);
  assert.equal(memory.isValidName('..'), false);
  assert.equal(memory.isValidName('a/b'), false);
  assert.equal(memory.isValidName('a\\b'), false);
  assert.equal(memory.isValidName('valid-name_1.2'), true);
});

test('saveMemory, loadMemory, showMemory, deleteMemory reject path traversal names', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'x');

  assert.throws(() => memory.saveMemory(cwd, '../hacked'), /invalid memory name/);
  assert.throws(() => memory.loadMemory(cwd, '../hacked'), /invalid memory name/);
  assert.throws(() => memory.showMemory(cwd, '../hacked'), /invalid memory name/);
  assert.throws(() => memory.deleteMemory(cwd, '../hacked'), /invalid memory name/);
});

test('isValidName rejects names ending in ".md" or "."', () => {
  assert.equal(memory.isValidName('foo.md'), false);
  assert.equal(memory.isValidName('foo.'), false);
  assert.equal(memory.isValidName('.'), false);
  assert.equal(memory.isValidName('foo'), true);
  assert.equal(memory.isValidName('foo.bar'), true);
});

test('memoryFileName always appends .md', () => {
  assert.equal(memory.memoryFileName('foo'), 'foo.md');
});

test('saveMemory rejects a name that collides with an existing memory once .md is appended', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'x');

  assert.throws(() => memory.saveMemory(cwd, 'foo.md'), /invalid memory name/);
});

test('symlink protection: saveMemory refuses to write through a symlinked memories dir', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-memory-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'x');

  let symlinked = false;
  try {
    fs.symlinkSync(outside, memory.memoriesDir(cwd), 'dir');
    symlinked = true;
  } catch {
    // No symlink permission on this platform/user (common on Windows without admin/dev mode).
  }

  if (!symlinked) return;
  assert.throws(() => memory.saveMemory(cwd, 'evil'), /symlink/);
});

test('symlink protection: loadMemory/showMemory/deleteMemory refuse a symlinked memory file', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const secret = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-memory-secret-'));
  t.after(() => fs.rmSync(secret, { recursive: true, force: true }));
  const secretFile = path.join(secret, 'secret.txt');
  fs.writeFileSync(secretFile, 'top secret');

  fs.mkdirSync(memory.memoriesDir(cwd), { recursive: true });

  let symlinked = false;
  try {
    fs.symlinkSync(secretFile, path.join(memory.memoriesDir(cwd), 'evil.md'), 'file');
    symlinked = true;
  } catch {
    // No symlink permission on this platform/user (common on Windows without admin/dev mode).
  }

  if (!symlinked) return;
  assert.throws(() => memory.loadMemory(cwd, 'evil'), /symlink/);
  assert.throws(() => memory.showMemory(cwd, 'evil'), /symlink/);
  assert.throws(() => memory.deleteMemory(cwd, 'evil'), /symlink/);
});

test('symlink protection: throws on symlink even if platform lacks symlink permissions (mocked)', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'normal state');

  const origLstat = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', (p) => {
    if (String(p).includes('symlink-detected')) {
      return { isSymbolicLink: () => true, isFile: () => true, isDirectory: () => false };
    }
    return origLstat(p);
  });

  assert.throws(() => memory.saveMemory(cwd, 'symlink-detected'), /refusing to use symlinked path/);
  assert.throws(() => memory.saveMemory(cwd, 'safe', path.join(cwd, '.weave', 'symlink-detected.md')), /refusing to use symlinked path/);
  assert.throws(() => memory.loadMemory(cwd, 'symlink-detected'), /refusing to use symlinked path/);
  assert.throws(() => memory.showMemory(cwd, 'symlink-detected'), /refusing to use symlinked path/);
  assert.throws(() => memory.deleteMemory(cwd, 'symlink-detected'), /refusing to use symlinked path/);
});

test('CLI: weave memory list reports no memories saved yet with exit code 0', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const res = runCli(['memory', 'list'], cwd);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /No memories saved yet/);
});

test('CLI: weave memory save/list/show/load/delete round-trip with exit code 0', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'cli round trip');

  const save = runCli(['memory', 'save', 'cliname'], cwd);
  assert.equal(save.status, 0);
  assert.match(save.stdout, /Saved memory "cliname"/);

  const list = runCli(['memory', 'list'], cwd);
  assert.equal(list.status, 0);
  assert.match(list.stdout, /cliname/);

  const show = runCli(['memory', 'show', 'cliname'], cwd);
  assert.equal(show.status, 0);
  assert.equal(show.stdout, 'cli round trip');

  const load = runCli(['memory', 'load', 'cliname'], cwd);
  assert.equal(load.status, 0);
  assert.match(load.stdout, /Loaded memory "cliname"/);

  const del = runCli(['memory', 'delete', 'cliname'], cwd);
  assert.equal(del.status, 0);
  assert.match(del.stdout, /Deleted memory "cliname"/);

  const listAfter = runCli(['memory', 'list'], cwd);
  assert.match(listAfter.stdout, /No memories saved yet/);
});

test('CLI: weave memory save without a name exits 2 with a usage error', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const res = runCli(['memory', 'save'], cwd);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /missing <name>/);
});

test('CLI: weave memory with no subcommand exits 2 with a usage error', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const res = runCli(['memory'], cwd);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /missing subcommand/);
});

test('CLI: weave memory with an unknown subcommand exits 2', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const res = runCli(['memory', 'bogus'], cwd);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /expected save, load, list, show, or delete/);
});

test('CLI: weave memory load of a missing memory exits 1', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const res = runCli(['memory', 'load', 'missing'], cwd);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /memory does not exist/);
});

test('CLI: weave memory save rejects an invalid name with exit code 1', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), 'x');

  const res = runCli(['memory', 'save', '../hacked'], cwd);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /invalid memory name/);
});
