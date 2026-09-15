'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const discover = require('../core/discover');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeTranscript(dir, lines) {
  fs.writeFileSync(path.join(dir, 'session.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

test('projectTranscriptsDir matches Claude Code\'s real slug format (one dash per separator char)', () => {
  // path.resolve() treats separators differently per platform (e.g. "\" is not
  // a separator on POSIX), so the expected slug must be platform-appropriate -
  // a hardcoded Windows path/slug pair fails on Linux CI runners and vice versa.
  if (process.platform === 'win32') {
    const dir = discover.projectTranscriptsDir('C:\\Users\\Admin\\Desktop\\Projetos\\Weave');
    assert.ok(dir.endsWith(path.join('.claude', 'projects', 'C--Users-Admin-Desktop-Projetos-Weave')));
  } else {
    const dir = discover.projectTranscriptsDir('/home/admin/projetos/weave');
    assert.ok(dir.endsWith(path.join('.claude', 'projects', '-home-admin-projetos-weave')));
  }
});

test('scan reports found: false when no transcript directory exists', () => {
  const missing = path.join(os.tmpdir(), 'weave-discover-does-not-exist-' + Date.now());
  const result = discover.scan({ transcriptsDir: missing });
  assert.equal(result.found, false);
});

test('scan estimates missed savings for an unwrapped noisy git status call', () => {
  const dir = tmpDir('weave-discover-test-');
  const bigStatus = ['On branch main'].concat(Array.from({ length: 30 }, (_, i) => `\t(use "git add <file${i}>..." to include)`)).join('\n');
  writeTranscript(dir, [
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'git status' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: bigStatus, is_error: false }] } },
  ]);
  const result = discover.scan({ transcriptsDir: dir });
  assert.equal(result.found, true);
  assert.equal(result.analyzed, 1);
  assert.ok(result.originalBytes > result.presentedBytes, 'expected estimated savings for repetitive git status hints');
  assert.ok(result.byKind['git-status'] > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('scan skips commands already wrapped by Weave', () => {
  const dir = tmpDir('weave-discover-test-');
  writeTranscript(dir, [
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'WEAVE_WRAPPED=1 node weave.js exec -- "git status"' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'On branch main', is_error: false }] } },
  ]);
  const result = discover.scan({ transcriptsDir: dir });
  assert.equal(result.analyzed, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('scan ignores malformed lines and non-Bash tools without crashing', () => {
  const dir = tmpDir('weave-discover-test-');
  fs.writeFileSync(
    path.join(dir, 'session.jsonl'),
    ['not json at all', JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'x' } }] } })].join('\n')
  );
  const result = discover.scan({ transcriptsDir: dir });
  assert.equal(result.found, true);
  assert.equal(result.analyzed, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
