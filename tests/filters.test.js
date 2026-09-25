'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const filters = require('../core/filters');
const { computeReport } = require('../core/exec');

test('classify() recognizes the initial command families', () => {
  assert.equal(filters.classify('git status'), 'git-status');
  assert.equal(filters.classify('  git status --short'), 'git-status');
  assert.equal(filters.classify('git diff HEAD~1'), 'git-diff');
  assert.equal(filters.classify('git log'), 'git-log');
  assert.equal(filters.classify('rg TODO src/'), 'grep');
  assert.equal(filters.classify('grep -rn TODO .'), 'grep');
  assert.equal(filters.classify('pytest tests/'), 'test');
  assert.equal(filters.classify('npm test'), 'test');
  assert.equal(filters.classify('npm run test'), 'test');
  assert.equal(filters.classify('cargo test'), 'test');
  assert.equal(filters.classify('dotnet test'), 'test');
  assert.equal(filters.classify('go test ./...'), 'test');
  assert.equal(filters.classify('npm run build'), 'summary');
  assert.equal(filters.classify('docker compose build'), 'summary');
  assert.equal(filters.classify('docker logs api'), 'logs');
  assert.equal(filters.classify('ls -la'), 'listing');
  assert.equal(filters.classify('Get-ChildItem -Path .'), 'listing');
  assert.equal(filters.classify('gci'), 'listing');
  assert.equal(filters.classify('cat package.json'), 'passthrough');
  assert.equal(filters.classify('kubectl get pods -o json'), 'passthrough');
});

test('classify() recognizes playwright, rspec, rake test, prettier, and gh', () => {
  assert.equal(filters.classify('playwright test'), 'test');
  assert.equal(filters.classify('npx playwright test'), 'test');
  assert.equal(filters.classify('rspec spec/'), 'test');
  assert.equal(filters.classify('bundle exec rspec'), 'test');
  assert.equal(filters.classify('rake test'), 'test');
  assert.equal(filters.classify('prettier --check .'), 'summary');
  assert.equal(filters.classify('npx prettier --check .'), 'summary');
  assert.equal(filters.classify('pnpm outdated'), 'summary');
  assert.equal(filters.classify('gh pr view 42'), 'summary');
  assert.equal(filters.classify('gh run list'), 'summary');
  assert.equal(filters.classify('gh api repos/foo/bar'), 'passthrough');
});

test('classify() falls back to generic for chained/piped commands', () => {
  assert.equal(filters.classify('git status && git diff'), 'generic');
  assert.equal(filters.classify('pytest | tee out.log'), 'generic');
  assert.equal(filters.classify('npm test; echo done'), 'generic');
});

test('classify() ignores shell operators inside quoted arguments', () => {
  assert.equal(filters.classify('git commit -m "fix: update A && B"'), 'summary');
  assert.equal(filters.classify('rg "foo || bar" src/'), 'grep');
  assert.equal(filters.classify('git log --oneline | head -20'), 'generic');
});

test('git status filter removes only the "(use ...)" hint boilerplate', () => {
  const raw = [
    'On branch main',
    'Changes not staged for commit:',
    '  (use "git add <file>..." to update what will be committed)',
    '  (use "git restore <file>..." to discard changes in working directory)',
    '\tmodified:   src/app.py',
    '',
    'no changes added to commit (use "git add" and/or "git commit -a")',
  ].join('\n');
  const r = filters.filterGitStatus(raw);
  assert.ok(!r.presented.includes('(use "git add <file>...'));
  assert.ok(!r.presented.includes('(use "git restore'));
  assert.ok(r.presented.includes('modified:   src/app.py'));
  assert.ok(r.presented.includes('On branch main'));
  assert.equal(r.presented, [
    'On branch main',
    'Changes not staged for commit:',
    '\tmodified:   src/app.py',
    '',
    'no changes added to commit (use "git add" and/or "git commit -a")',
  ].join('\n'));
  assert.equal(r.omitted, 2);
});

test('git status filter condenses long file lists per section', () => {
  const sections = [
    ['Changes to be committed:', 'new file:   staged'],
    ['Changes not staged for commit:', 'modified:   modified'],
    ['Untracked files:', 'untracked'],
  ];
  const raw = ['On branch main'];
  for (const [heading, file] of sections) {
    raw.push(heading, '  (use "git add <file>..." to update)', ...Array.from({ length: 40 }, (_, i) => `\t${file}-${i}.txt`), '');
  }
  const stdout = raw.join('\n');
  const filtered = filters.filterGitStatus(stdout);
  const report = computeReport('git status', stdout, '', 0);

  for (const [heading, file] of sections) {
    assert.ok(filtered.presented.includes(heading));
    assert.ok(filtered.presented.includes(`\t${file}-9.txt`));
    assert.ok(!filtered.presented.includes(`\t${file}-10.txt`));
  }
  assert.equal(filtered.presented.match(/\.\.\. 30 more file\(s\)/g).length, 3);
  assert.equal(filtered.omitted, 93);
  assert.equal(report.omitted, 93);
  assert.ok(report.presentedBytes < report.originalBytes);
});

test('git diff filter removes only the index line, keeps hunks intact', () => {
  const raw = [
    'diff --git a/app.py b/app.py',
    'index e69de29..4b825dc 100644',
    '--- a/app.py',
    '+++ b/app.py',
    '@@ -1,2 +1,2 @@',
    '-def add(a, b):',
    '-    return a - b',
    '+def add(a, b):',
    '+    return a + b',
  ].join('\n');
  const r = filters.filterGitDiff(raw);
  assert.ok(!r.presented.includes('index e69de29'));
  assert.ok(r.presented.includes('-    return a - b'));
  assert.ok(r.presented.includes('+    return a + b'));
  assert.equal(r.omitted, 1);
});

test('git log filter condenses verbose commits to one line each', () => {
  const raw = [
    'commit abcdef1234567890',
    'Author: Jane Doe <jane@example.com>',
    'Date:   Mon Jan 1 00:00:00 2026 +0000',
    '',
    '    First commit message',
    '',
    'commit 1234567abcdef00',
    'Author: Jane Doe <jane@example.com>',
    'Date:   Tue Jan 2 00:00:00 2026 +0000',
    '',
    '    Second commit message',
    '    with a body line',
    '',
  ].join('\n');
  const r = filters.filterGitLog(raw, 'git log');
  const lines = r.presented.split('\n').filter(Boolean);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('abcdef1'));
  assert.ok(lines[0].includes('First commit message'));
  assert.ok(lines[1].includes('(+1 more line(s))'));
});

test('git log filter does not touch already-explicit formats', () => {
  const raw = 'abc123 first\nabc456 second';
  const r = filters.filterGitLog(raw, 'git log --oneline');
  assert.equal(r.presented, raw);
  assert.equal(r.omitted, 0);
});

test('git log filter bypasses graph output verbatim', () => {
  const raw = '* commit abcdef1234567890\n| Author: Jane Doe <jane@example.com>\n| Date: Mon Jan 1 00:00:00 2026 +0000';
  const r = filters.filterGitLog(raw, 'git log --graph');
  assert.equal(r.presented, raw);
  assert.equal(r.omitted, 0);
});

test('git log filter handles ANSI-colored output from a real merge commit', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-git-log-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const gitConfig = path.join(cwd, '.gitconfig');
  fs.writeFileSync(gitConfig, '');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_SYSTEM: gitConfig };
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Weave Test');
  git('config', 'user.email', 'weave@example.com');
  fs.writeFileSync(path.join(cwd, 'root.txt'), 'root');
  git('add', '.');
  git('commit', '-m', 'root');
  git('switch', '-c', 'feature');
  fs.writeFileSync(path.join(cwd, 'feature.txt'), 'feature');
  git('add', '.');
  git('commit', '-m', 'feature change');
  git('switch', 'main');
  fs.writeFileSync(path.join(cwd, 'main.txt'), 'main');
  git('add', '.');
  git('commit', '-m', 'main change');
  git('merge', '--no-ff', 'feature', '-m', 'merge feature');
  const raw = git('log', '-1', '--color=always');
  const result = filters.filterGitLog(raw, 'git log --color=always');
  assert.match(result.presented, /^[0-9a-f]{7}\s/);
  assert.match(result.presented, /merge feature/);
  assert.doesNotMatch(result.presented, /Merge:/);
  assert.doesNotMatch(result.presented, /\x1B\[/);
});

test('grep filter groups repeated file:line matches, preserving early context', () => {
  const lines = [];
  for (let i = 1; i <= 8; i++) lines.push(`src/app.py:${i}:    # TODO item ${i}`);
  const r = filters.filterGrep(lines.join('\n'), { maxPerFile: 3 });
  assert.ok(r.presented.includes('src/app.py (8 matches)'));
  assert.ok(r.presented.includes('1:     # TODO item 1'));
  assert.ok(r.presented.includes('… 5 more match(es)'));
  assert.equal(r.omitted, 5);
});

test('grep filter groups relative and Windows absolute paths', () => {
  const r = filters.filterGrep('src/app.js:7:function bar() {}\nC:\\Users\\user\\app.js:14:function foo() {}');
  assert.ok(r.presented.includes('src/app.js (1 match)'));
  assert.ok(r.presented.includes('C:\\Users\\user\\app.js (1 match)'));
  assert.equal(r.omitted, 0);
});

test('test-output filter: repeated passing lines collapse to the tail summary on exit 0', () => {
  const passLines = Array.from({ length: 200 }, (_, i) => `test_thing_${i} ... ok`);
  const raw = passLines.concat(['', '200 passed in 1.23s']).join('\n');
  const r = filters.filterTestOutput(raw, 0);
  assert.equal(r.failures, 'none');
  assert.ok(r.summary.includes('200 passed'));
  assert.ok(r.omitted > 190);
  assert.ok(!r.presented.includes('test_thing_0 ...'));
});

test('reduceOutput preserves complete failing test output', () => {
  const noise = Array.from({ length: 150 }, (_, i) => `test_ok_${i} PASSED`);
  const raw = noise
    .concat([
      'test_math.py::test_add FAILED',
      '',
      'def test_add():',
      '>       assert add(2, 3) == 999',
      'E       AssertionError: assert 5 == 999',
      '',
      'test_math.py:12: AssertionError',
      '1 failed, 150 passed in 2.0s',
    ])
    .join('\n');
  const r = filters.reduceOutput('pytest', raw, 1);
  assert.ok(r.presented.includes('test_math.py:12: AssertionError'));
  assert.ok(r.presented.includes('AssertionError: assert 5 == 999'));
  assert.equal(r.presented, raw);
  assert.equal(r.omitted, 0);
});

test('reduceOutput passthrough for small unknown-command output', () => {
  const raw = 'total 0\ndrwxr-xr-x 2 user user 4096 Jan 1 00:00 .\n';
  const r = filters.reduceOutput('ls -la', raw, 0);
  assert.equal(r.kind, 'passthrough');
  assert.equal(r.presented, raw);
  assert.equal(r.omitted, 0);
});

test('verbatim commands remain complete even when output is large', () => {
  const raw = Array.from({ length: 100 }, (_, i) => `source line ${i}`).join('\n');
  const r = filters.reduceOutput('cat large.txt', raw, 0);
  assert.equal(r.kind, 'passthrough');
  assert.equal(r.presented, raw);
  assert.equal(r.omitted, 0);
});

test('summary profiles retain warnings and the final outcome', () => {
  const raw = Array.from({ length: 80 }, (_, i) => `compiling module-${i}`);
  raw[35] = 'warning: deprecated API';
  raw.push('Build completed successfully');
  const r = filters.reduceOutput('npm run build', raw.join('\n'), 0);
  assert.equal(r.kind, 'summary');
  assert.ok(r.presented.includes('warning: deprecated API'));
  assert.ok(r.presented.includes('Build completed successfully'));
  assert.ok(r.omitted > 0);
});

test('log profiles retain errors and recent lines', () => {
  const raw = Array.from({ length: 100 }, (_, i) => `service line ${i}`);
  raw[50] = 'ERROR database unavailable';
  const r = filters.reduceOutput('docker logs api', raw.join('\n'), 0);
  assert.equal(r.kind, 'logs');
  assert.ok(r.presented.includes('ERROR database unavailable'));
  assert.ok(r.presented.includes('service line 99'));
});

test('generic and logs filters keep warning/deprecation lines, matching summary filter', () => {
  const raw = Array.from({ length: 80 }, (_, i) => `line ${i}`);
  raw[40] = 'npm WARN deprecated fs.existsSync legacy usage';
  const genericResult = filters.reduceOutput('some-unclassified-tool', raw.join('\n'), 0);
  assert.equal(genericResult.kind, 'generic');
  assert.ok(genericResult.presented.includes('npm WARN deprecated fs.existsSync legacy usage'));

  const logsResult = filters.reduceOutput('docker logs api', raw.join('\n'), 0);
  assert.ok(logsResult.presented.includes('npm WARN deprecated fs.existsSync legacy usage'));
});

test('generic filter counts consecutive duplicates as omitted', () => {
  const r = filters.filterGeneric(Array(50).fill('repeated output line').join('\n'));
  assert.equal(r.omitted, 49);
});

test('reduceOutput never reports success on a non-zero exit code', () => {
  const raw = 'some output';
  const r = filters.reduceOutput('some-command', raw, 1);
  assert.notEqual(r.summary.toLowerCase(), 'ok');
  assert.ok(r.summary.includes('1'));
});

test('truncateMiddle keeps head, tail, and any pattern match in between', () => {
  const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`);
  lines[50] = 'ERROR: boom';
  const { lines: kept, omitted } = filters.truncateMiddle(lines, { head: 2, tail: 2, keepPattern: /ERROR/ });
  assert.ok(kept.includes('line 0'));
  assert.ok(kept.includes('line 1'));
  assert.ok(kept.includes('ERROR: boom'));
  assert.ok(kept.includes('line 98'));
  assert.ok(kept.includes('line 99'));
  assert.equal(omitted, 95);
});

test('dedupeConsecutive collapses repeated lines with a count', () => {
  const out = filters.dedupeConsecutive(['a', 'a', 'a', 'b', 'a']);
  assert.deepEqual(out, ['a  (×3)', 'b', 'a']);
});
