'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('.claude-plugin/plugin.json is valid and names the hook bundle', () => {
  const pkg = readJson('.claude-plugin/plugin.json');
  assert.equal(pkg.name, 'weave');
  assert.equal(pkg.hooks, './hooks/hooks.json');
});

test('.claude-plugin/marketplace.json is valid and self-references this plugin', () => {
  const mkt = readJson('.claude-plugin/marketplace.json');
  assert.equal(mkt.name, 'weave');
  assert.ok(Array.isArray(mkt.plugins) && mkt.plugins.length === 1);
  assert.equal(mkt.plugins[0].source, './');
});

test('.codex-plugin/plugin.json is valid and points at the shared skills dir', () => {
  const pkg = readJson('.codex-plugin/plugin.json');
  assert.equal(pkg.name, 'weave');
  assert.equal(pkg.skills, './skills/');
});

test('.agents/plugins/marketplace.json is valid and points at the local plugin root', () => {
  const mkt = readJson('.agents/plugins/marketplace.json');
  assert.equal(mkt.name, 'weave');
  assert.equal(mkt.plugins[0].source.source, 'local');
  assert.equal(mkt.plugins[0].source.path, './');
});

test('hooks/hooks.json declares a PreToolUse Bash matcher pointing at the real hook file', () => {
  const hooks = readJson('hooks/hooks.json');
  const entry = hooks.hooks.PreToolUse.find((e) => String(e.matcher).includes('Bash'));
  assert.ok(entry, 'expected a Bash matcher under PreToolUse');
  const handler = entry.hooks[0];
  assert.equal(handler.command, 'node');
  assert.ok(handler.args[0].endsWith('/hooks/pretooluse.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'hooks', 'pretooluse.js')));
});

test('skills/weave/SKILL.md has valid frontmatter naming the skill "weave"', () => {
  const text = fs.readFileSync(path.join(ROOT, 'skills', 'weave', 'SKILL.md'), 'utf8');
  assert.ok(text.startsWith('---\n'));
  const end = text.indexOf('\n---', 4);
  const frontmatter = text.slice(4, end);
  assert.match(frontmatter, /name:\s*weave/);
  assert.match(frontmatter, /description:/);
});
