'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('.claude-plugin/plugin.json relies on automatic standard hook discovery', () => {
  const pkg = readJson('.claude-plugin/plugin.json');
  assert.equal(pkg.name, 'weave');
  assert.equal(pkg.hooks, undefined);
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
  assert.equal(pkg.hooks, './hooks/hooks.json');
});

test('package and plugin versions agree', () => {
  const pkg = readJson('package.json');
  assert.equal(pkg.version, readJson('.claude-plugin/plugin.json').version);
  assert.equal(pkg.version, readJson('.codex-plugin/plugin.json').version);
  assert.equal(pkg.bin.weave, 'cli/weave.js');
  assert.equal(pkg.scripts.test, 'node --test');
});

test('.agents/plugins/marketplace.json is valid and points at the local plugin root', () => {
  const mkt = readJson('.agents/plugins/marketplace.json');
  assert.equal(mkt.name, 'weave');
  assert.equal(mkt.plugins[0].source.source, 'local');
  assert.equal(mkt.plugins[0].source.path, './');
});

test('hooks/hooks.json declares a PreToolUse Bash matcher pointing at the real hook file', () => {
  // The command is a single interpolated string ("node \"${CLAUDE_PLUGIN_ROOT}/hooks/x.js\""),
  // not a separate command+args pair - Codex CLI only substitutes ${CLAUDE_PLUGIN_ROOT} inside
  // the "command" string, not inside "args" array entries, so a split form silently fails there.
  const hooks = readJson('hooks/hooks.json');
  const entry = hooks.hooks.PreToolUse.find((e) => String(e.matcher).includes('Bash'));
  assert.ok(entry, 'expected a Bash matcher under PreToolUse');
  const handler = entry.hooks[0];
  assert.equal(handler.args, undefined, 'command must be a single string, not split into command+args');
  assert.match(handler.command, /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/pretooluse\.js"$/);
  assert.ok(fs.existsSync(path.join(ROOT, 'hooks', 'pretooluse.js')));
  for (const event of ['SessionStart', 'SubagentStart', 'UserPromptSubmit']) {
    assert.ok(Array.isArray(hooks.hooks[event]), `expected ${event}`);
    assert.match(hooks.hooks[event][0].hooks[0].command, /\/hooks\/lifecycle\.js"$/);
  }
});

test('every bundled skill has matching frontmatter', () => {
  const names = ['weave', 'weave-review', 'weave-audit', 'weave-debt', 'weave-gain', 'weave-help'];
  for (const name of names) {
    const file = path.join(ROOT, 'skills', name, 'SKILL.md');
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith('---\n'), `${name} frontmatter start`);
    const end = text.indexOf('\n---', 4);
    const frontmatter = text.slice(4, end);
    assert.match(frontmatter, new RegExp(`name:\\s*${name}`));
    assert.match(frontmatter, /description:/);
  }
});
