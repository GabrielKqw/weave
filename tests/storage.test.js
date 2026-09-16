'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('../core/storage');

function tmpCwd() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weave-storage-test-'));
}

test('saveRun + loadRun round-trip, including raw recovery text', () => {
  const cwd = tmpCwd();
  const id = storage.saveRun(cwd, { command: 'pytest', exitCode: 1, kind: 'test', originalBytes: 500, presentedBytes: 100, omitted: 40 }, 'FULL RAW OUTPUT HERE');
  const found = storage.loadRun(cwd, id);
  assert.ok(found);
  assert.equal(found.meta.command, 'pytest');
  assert.equal(found.meta.exitCode, 1);
  assert.equal(found.raw, 'FULL RAW OUTPUT HERE');
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('saveRun without raw text still saves metadata but reports no recovery content', () => {
  const cwd = tmpCwd();
  const id = storage.saveRun(cwd, { command: 'ls', exitCode: 0, kind: 'generic', originalBytes: 10, presentedBytes: 10, omitted: 0 }, null);
  const found = storage.loadRun(cwd, id);
  assert.ok(found);
  assert.equal(found.raw, null);
  assert.equal(found.meta.hasRaw, false);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('loadRun returns null for an unknown id', () => {
  const cwd = tmpCwd();
  assert.equal(storage.loadRun(cwd, 'doesnotexist'), null);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('loadRun rejects path traversal ids', () => {
  const cwd = tmpCwd();
  fs.writeFileSync(path.join(cwd, 'outside.json'), '{}');
  assert.equal(storage.loadRun(cwd, '../../outside'), null);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('corrupt run metadata is ignored and does not block later saves', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const dir = storage.runsDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'aaaaaaaaaaaa.json'), '{broken');
  fs.writeFileSync(path.join(dir, 'bbbbbbbbbbbb.json'), JSON.stringify({ ts: 'invalid', hrns: '1' }));
  fs.writeFileSync(path.join(dir, 'cccccccccccc.json'), JSON.stringify({ ts: new Date().toISOString(), hrns: 'invalid' }));
  assert.equal(storage.loadRun(cwd, 'aaaaaaaaaaaa'), null);
  assert.deepEqual(storage.listRuns(cwd), []);
  const id = storage.saveRun(cwd, { command: 'echo ok', exitCode: 0 }, null);
  assert.equal(storage.listRuns(cwd).length, 1);
  assert.ok(storage.loadRun(cwd, id));
});

test('pruning trusts the run filename, not an id stored in metadata', () => {
  const cwd = tmpCwd();
  const outside = path.join(cwd, 'outside.json');
  fs.writeFileSync(outside, 'keep');
  const id = storage.saveRun(cwd, { command: 'old', exitCode: 0 }, null);
  const metaPath = path.join(storage.runsDir(cwd), `${id}.json`);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.id = '../../outside';
  meta.ts = new Date(0).toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(meta));
  storage.pruneOldRuns(cwd, { maxCount: 0, maxAgeMs: 0 });
  assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('pruneOldRuns removes runs beyond maxCount, keeping the newest', () => {
  const cwd = tmpCwd();
  const ids = [];
  for (let i = 0; i < 5; i++) {
    ids.push(storage.saveRun(cwd, { command: `cmd${i}`, exitCode: 0, originalBytes: 1, presentedBytes: 1, omitted: 0 }, null));
  }
  storage.pruneOldRuns(cwd, { maxCount: 2, maxAgeMs: Number.MAX_SAFE_INTEGER });
  const remaining = storage.listRuns(cwd);
  assert.equal(remaining.length, 2);
  assert.ok(remaining.some((r) => r.id === ids[3]));
  assert.ok(remaining.some((r) => r.id === ids[4]));
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('pruneOldRuns removes runs older than maxAgeMs regardless of count', () => {
  const cwd = tmpCwd();
  const id = storage.saveRun(cwd, { command: 'old', exitCode: 0, originalBytes: 1, presentedBytes: 1, omitted: 0 }, null);
  const dir = storage.runsDir(cwd);
  const metaPath = path.join(dir, `${id}.json`);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.ts = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(meta));

  storage.pruneOldRuns(cwd, { maxCount: 1000, maxAgeMs: 14 * 24 * 60 * 60 * 1000 });
  assert.equal(storage.loadRun(cwd, id), null);
  fs.rmSync(cwd, { recursive: true, force: true });
});
