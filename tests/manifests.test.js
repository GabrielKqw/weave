'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

test('package.json files field ships .agents, GEMINI.md, and AGENTS.md', () => {
  const pkg = readJson('package.json');
  assert.ok(pkg.files.includes('.agents'));
  assert.ok(pkg.files.includes('GEMINI.md'));
  assert.ok(pkg.files.includes('AGENTS.md'));
});

test('weave --help and weave -h print usage and exit 0', () => {
  const cliPath = path.join(ROOT, 'cli', 'weave.js');
  for (const flag of ['--help', '-h', 'help']) {
    const result = spawnSync(process.execPath, [cliPath, flag], { encoding: 'utf8' });
    assert.equal(result.status, 0, `expected exit 0 for "${flag}"`);
    assert.match(result.stdout, /^Usage: weave/);
  }
});

test('weave with an unknown subcommand exits 2', () => {
  const cliPath = path.join(ROOT, 'cli', 'weave.js');
  const result = spawnSync(process.execPath, [cliPath, 'bogus-subcommand'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
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
  assert.equal(handler.args, undefined, 'command must be a single string, not split into command+args');
  assert.match(handler.command, /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/pretooluse\.js"$/);
  assert.ok(fs.existsSync(path.join(ROOT, 'hooks', 'pretooluse.js')));
  for (const event of ['SessionStart', 'SubagentStart', 'UserPromptSubmit']) {
    assert.ok(Array.isArray(hooks.hooks[event]), `expected ${event}`);
    assert.match(hooks.hooks[event][0].hooks[0].command, /\/hooks\/lifecycle\.js"$/);
  }
});

test('every bundled skill has matching frontmatter', () => {
  const names = ['weave', 'weave-review', 'weave-audit', 'weave-debt', 'weave-gain', 'weave-help', 'weave-prompt'];
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

test('weave doctor --agent=antigravity reports bash as warn/optional instead of fail', () => {
  const cliPath = path.join(ROOT, 'cli', 'weave.js');
  const result = spawnSync(process.execPath, [cliPath, 'doctor', '--agent=antigravity'], {
    encoding: 'utf8',
    env: { ...process.env, WEAVE_BASH: 'nonexistent-bash-binary-test' },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /WARN\s+bash executable \(optional for antigravity\)/);
  assert.doesNotMatch(result.stdout, /FAIL\s+bash executable/);
});

function cleanAgentEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('CODEX_') || key.startsWith('ANTIGRAVITY_')) delete env[key];
  }
  delete env.OPENAI_CLI_MODEL;
  delete env.WEAVE_AGENT;
  return env;
}

function runDoctor(extraEnv) {
  const cliPath = path.join(ROOT, 'cli', 'weave.js');
  return spawnSync(process.execPath, [cliPath, 'doctor'], {
    encoding: 'utf8',
    env: { ...cleanAgentEnv(), ...extraEnv },
  });
}

test('weave doctor detects codex via CODEX_MANAGED_PACKAGE_ROOT', () => {
  const result = runDoctor({ CODEX_MANAGED_PACKAGE_ROOT: 'C:\\codex\\pkg' });
  assert.match(result.stdout, /detected agent - codex/);
});

test('weave doctor detects codex via OPENAI_CLI_MODEL', () => {
  const result = runDoctor({ OPENAI_CLI_MODEL: 'gpt-5.4-codex' });
  assert.match(result.stdout, /detected agent - codex/);
});

test('weave doctor gives ANTIGRAVITY_AGENT precedence over Codex env vars', () => {
  const result = runDoctor({
    ANTIGRAVITY_AGENT: '1',
    CODEX_MANAGED_PACKAGE_ROOT: 'C:\\codex\\pkg',
    OPENAI_CLI_MODEL: 'gpt-5.4-codex',
  });
  assert.match(result.stdout, /detected agent - antigravity/);
  assert.doesNotMatch(result.stdout, /detected agent - codex/);
});

test('weave doctor detects antigravity via ANTIGRAVITY_CONVERSATION_ID', () => {
  const result = runDoctor({
    ANTIGRAVITY_CONVERSATION_ID: 'conv-abc-123',
    OPENAI_CLI_MODEL: 'gpt-5.4-codex',
  });
  assert.match(result.stdout, /detected agent - antigravity/);
  assert.doesNotMatch(result.stdout, /detected agent - codex/);
});


