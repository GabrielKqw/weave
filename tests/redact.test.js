'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { redact } = require('../core/redact');

test('redacts AWS access key IDs', () => {
  const out = redact('export AWS_ACCESS_KEY_ID=AKIAABCDEFGHIJKLMNOP');
  assert.ok(!out.includes('AKIAABCDEFGHIJKLMNOP'));
  assert.ok(out.includes('[REDACTED:aws-key]'));
});

test('redacts GitHub-style tokens', () => {
  const classic = 'ghp_1234567890abcdefghijklmnopqrstuvwx';
  const fineGrained = 'github_pat_11AA22bb33CC44dd55EE66ff77GG88hh99II';
  const out = redact(`token is ${classic}\nfine-grained: '${fineGrained}'`);
  assert.ok(!out.includes(classic));
  assert.ok(!out.includes(fineGrained));
  assert.ok(out.includes('[REDACTED:token]'));
});

test('redacts Authorization: Bearer headers', () => {
  const out = redact('Authorization: Bearer sk-abcdef1234567890\nauthorization: bearer abc+def/ghi~jkl==');
  assert.ok(!out.includes('sk-abcdef1234567890'));
  assert.ok(!out.includes('abc+def/ghi~jkl=='));
});

test('redacts generic password/secret/token assignments', () => {
  const out = redact('password=hunter2verysecret\nsecret: \'top secret value\'\nAPI_TOKEN="abc123xyz456verylong"');
  assert.equal(out, 'password=[REDACTED]\nsecret: [REDACTED]\nAPI_TOKEN=[REDACTED]');
});

test('redacts private keys, API keys, and URL credentials', () => {
  const privateKey = '-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----';
  const apiKey = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
  const url = 'postgres://admin:plain-password@example.test/db';
  const out = redact(`${privateKey}\n${apiKey}\n${url}`);
  assert.ok(!out.includes('private-material'));
  assert.ok(!out.includes(apiKey));
  assert.ok(!out.includes('plain-password'));
  assert.ok(out.includes('[REDACTED:private-key]'));
  assert.ok(out.includes('postgres://admin:[REDACTED]@example.test/db'));
});

test('redacts a bare JWT with no surrounding keyword (e.g. inside an assertion diff)', () => {
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiJ9.XCyYgZHPMURqlNgnAJzAWtcay9l8VvUEqv_5WYFei3U';
  const out = redact(`AssertionError: '${jwt}' == 'expected'`);
  assert.ok(!out.includes(jwt));
  assert.ok(out.includes('[REDACTED:jwt]'));
});

test('leaves ordinary output alone', () => {
  const text = '5 passed, 0 failed in 1.2s\nmodified: src/app.py';
  assert.equal(redact(text), text);
});
