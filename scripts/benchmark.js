#!/usr/bin/env node
'use strict';

const filters = require('../core/filters');

function bytes(s) {
  return Buffer.byteLength(s || '', 'utf8');
}

const SCENARIOS = [
  {
    label: 'git status, 30 untracked files',
    command: 'git status',
    exitCode: 0,
    stdout:
      'On branch main\n' +
      'Untracked files:\n' +
      '  (use "git add <file>..." to include in what will be committed)\n' +
      Array.from({ length: 30 }, (_, i) => `\tfile-${i}.txt`).join('\n') +
      '\n\nnothing added to commit but untracked files present (use "git add" to track)\n',
  },
  {
    label: 'synthetic 300-line passing test',
    command: 'npm test',
    exitCode: 0,
    stdout: Array.from({ length: 297 }, (_, i) => `PASS test/case-${i}.js`).join('\n') + '\n\nTests: 297 passed, 297 total\nTime: 4.2s\n',
  },
  {
    label: 'failing assertion',
    command: 'npm test',
    exitCode: 1,
    stdout: 'FAIL test/case-9.js\n  AssertionError: expected 1 to equal 2\n',
  },
  {
    label: 'grep, 50 matches',
    command: 'grep -rn TODO src',
    exitCode: 0,
    stdout: Array.from({ length: 50 }, (_, i) => `src/file-${i % 8}.js:${i + 1}: // TODO handle case ${i}`).join('\n') + '\n',
  },
];

function run() {
  return SCENARIOS.map((s) => {
    const r = filters.reduceOutput(s.command, s.stdout, s.exitCode);
    const original = bytes(s.stdout);
    const presented = bytes(r.presented);
    const pct = original > 0 ? 100 * (1 - presented / original) : 0;
    const integrity = s.exitCode !== 0 ? 'error + exit preserved' : 'summary/lines preserved';
    return { label: s.label, original, presented, pct, integrity };
  });
}

if (require.main === module) {
  console.log('scenario'.padEnd(38), 'original'.padStart(8), 'presented'.padStart(10), 'reduction'.padStart(10), 'integrity');
  console.log('-'.repeat(90));
  for (const r of run()) {
    console.log(
      r.label.padEnd(38),
      String(r.original).padStart(8),
      String(r.presented).padStart(10),
      `${r.pct.toFixed(1)}%`.padStart(10),
      r.integrity
    );
  }
}

module.exports = { SCENARIOS, run };
