'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const { shellQuoteSingle, toGitBashPath } = require('../core/quoting');
const { bashExecutable } = require('../core/exec');

test('toGitBashPath converts a Windows drive path to MSYS form', () => {
  assert.equal(toGitBashPath('C:\\Users\\user\\Desktop\\Weave\\cli\\weave.js'), '/c/Users/user/Desktop/Weave/cli/weave.js');
});

test('shellQuoteSingle round-trips arbitrary strings through a real POSIX shell', () => {
  const cases = [
    `simple`,
    `has spaces and && operators || too`,
    `single 'quote' inside`,
    `double "quote" inside`,
    `pipe | and semicolon ; and redirect > file`,
    `back\\slash`,
    `dollar $HOME and backtick \`date\``,
    `multi\nline\ncommand`,
  ];
  for (const original of cases) {
    const wrapped = shellQuoteSingle(original);
    const result = spawnSync(bashExecutable(), ['-c', `printf '%s' ${wrapped}`], { encoding: 'utf8' });
    assert.equal(result.status, 0, `bash failed for case: ${JSON.stringify(original)}`);
    assert.equal(result.stdout, original, `round-trip mismatch for: ${JSON.stringify(original)}`);
  }
});
