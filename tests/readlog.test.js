'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readlog = require('../core/readlog');

function tmpCwd(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-readlog-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

test('records reads and only flags the same unchanged content', (t) => {
  const cwd = tmpCwd(t);
  const first = readlog.checkAndRecordRead(cwd, 'notes.txt', 'first');
  const second = readlog.checkAndRecordRead(cwd, 'notes.txt', 'first');
  const changed = readlog.checkAndRecordRead(cwd, 'notes.txt', 'second');

  assert.equal(first.repeated, false);
  assert.equal(second.repeated, true);
  assert.ok(second.previousAt);
  assert.equal(changed.repeated, false);

  const ledger = JSON.parse(fs.readFileSync(path.join(cwd, '.weave', 'reads.json'), 'utf8'));
  assert.deepEqual(Object.keys(ledger), ['version', 'reads', 'searches']);
  assert.deepEqual(Object.keys(ledger.reads[path.resolve(cwd, 'notes.txt')]), ['hash', 'lastReadAt', 'tool']);
  assert.equal(ledger.reads[path.resolve(cwd, 'notes.txt')].tool, 'Read');
});

test('flags only exact repeated Grep and Glob searches', (t) => {
  const cwd = tmpCwd(t);

  assert.equal(readlog.checkAndRecordSearch(cwd, 'Grep', { path: 'src', pattern: 'needle' }).repeated, false);
  assert.equal(readlog.checkAndRecordSearch(cwd, 'Grep', { pattern: 'needle', path: 'src' }).repeated, true);
  assert.equal(readlog.checkAndRecordSearch(cwd, 'Grep', { path: 'src', pattern: 'other' }).repeated, false);
  assert.equal(readlog.checkAndRecordSearch(cwd, 'Glob', { pattern: '**/*.js' }).repeated, false);
  assert.equal(readlog.checkAndRecordSearch(cwd, 'Glob', { pattern: '**/*.js' }).repeated, true);
  assert.equal(readlog.checkAndRecordSearch(cwd, 'Glob', { pattern: '**/*.json' }).repeated, false);
});

test('prunes the ledger to a bounded number of entries', (t) => {
  const cwd = tmpCwd(t);
  for (let i = 0; i < 205; i++) {
    readlog.checkAndRecordRead(cwd, `file-${i}.txt`, String(i));
    readlog.checkAndRecordSearch(cwd, 'Grep', { pattern: `pattern-${i}` });
  }

  const ledger = JSON.parse(fs.readFileSync(path.join(cwd, '.weave', 'reads.json'), 'utf8'));
  assert.equal(Object.keys(ledger.reads).length, 200);
  assert.equal(ledger.searches.length, 200);
});
