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
  const out = redact('token is ghp_1234567890abcdefghijklmnopqrstuvwx');
  assert.ok(!out.includes('ghp_1234567890abcdefghijklmnopqrstuvwx'));
  assert.ok(out.includes('[REDACTED:token]'));
});

test('redacts Authorization: Bearer headers', () => {
  const out = redact('Authorization: Bearer sk-abcdef1234567890');
  assert.ok(!out.includes('sk-abcdef1234567890'));
});

test('redacts generic password/secret/token assignments', () => {
  const out = redact('DB_PASSWORD=hunter2verysecret\nsecret: topsecretvalue123');
  assert.ok(!out.includes('hunter2verysecret'));
  assert.ok(!out.includes('topsecretvalue123'));
  assert.ok(out.includes('[REDACTED]'));
});

test('leaves ordinary output alone', () => {
  const text = '5 passed, 0 failed in 1.2s\nmodified: src/app.py';
  assert.equal(redact(text), text);
});
