#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const execCore = require('../core/exec');
const storage = require('../core/storage');
const modes = require('../core/mode');
const discover = require('../core/discover');

const PLUGIN_ROOT = path.join(__dirname, '..');

function cmdExec(argv) {
  let cwd;
  const cwdIdx = argv.indexOf('--cwd');
  if (cwdIdx !== -1) {
    cwd = argv[cwdIdx + 1];
    if (!cwd) {
      process.stderr.write('weave exec: --cwd requires a directory\n');
      process.exitCode = 2;
      return;
    }
    argv = [...argv.slice(0, cwdIdx), ...argv.slice(cwdIdx + 2)];
  }
  const dashIdx = argv.indexOf('--');
  const command = dashIdx === -1 ? argv.join(' ') : argv.slice(dashIdx + 1).join(' ');
  if (!command.trim()) {
    process.stderr.write('weave exec: no command given (usage: weave exec -- <command>)\n');
    process.exitCode = 2;
    return;
  }
  const report = execCore.execAndReport(command, { cwd: cwd || process.cwd() });
  if (report.passthrough) {
    process.stdout.write(report.presentedStdout);
    process.stderr.write(report.presentedStderr);
  } else {
    process.stdout.write(execCore.formatReport(report) + '\n');
  }
  process.exitCode = report.exitCode;
}

function cmdRecall(argv) {
  const id = argv[0];
  if (!id) {
    process.stderr.write('weave recall: missing <id> (usage: weave recall <id>)\n');
    process.exitCode = 2;
    return;
  }
  const found = storage.loadRun(process.cwd(), id);
  if (!found) {
    process.stdout.write(`No stored run found for id "${id}". It may have expired, been pruned, or never existed.\n`);
    process.exitCode = 1;
    return;
  }
  const { meta, raw } = found;
  process.stdout.write(`Command: ${meta.command}\n`);
  process.stdout.write(`Exit: ${meta.exitCode}\n`);
  process.stdout.write(`Recorded: ${meta.ts}\n`);
  if (!raw) {
    process.stdout.write('Nothing was omitted for this run - the filtered output already contained everything captured.\n');
    process.exitCode = meta.exitCode;
    return;
  }
  process.stdout.write('--- full recorded output (secrets redacted before storage) ---\n');
  process.stdout.write(raw + '\n');
  process.exitCode = meta.exitCode;
}

function cmdGain(argv) {
  const runs = storage.listRuns(process.cwd());
  if (runs.length === 0) {
    process.stdout.write('No recorded runs yet in .weave/runs/. Run some commands through Weave first.\n');
    return;
  }
  if (argv.includes('--history')) {
    for (const r of runs) {
      const presented = Math.min(r.originalBytes || 0, r.presentedBytes || 0);
      const pct = r.originalBytes > 0 ? (100 * (1 - presented / r.originalBytes)).toFixed(1) : '0.0';
      process.stdout.write(`${r.ts}  ${String(r.kind || '?').padEnd(10)}  exit ${r.exitCode}  ${r.originalBytes}B -> ${presented}B  (${pct}%)  ${r.command}\n`);
    }
    return;
  }
  const originalBytes = runs.reduce((s, r) => s + (r.originalBytes || 0), 0);
  const presentedBytes = runs.reduce(
    (s, r) => s + Math.min(r.originalBytes || 0, r.presentedBytes || 0),
    0
  );
  const reductionPct = originalBytes > 0 ? (100 * (1 - presentedBytes / originalBytes)).toFixed(1) : '0.0';
  const approxTokensSaved = Math.max(0, Math.round((originalBytes - presentedBytes) / 4));

  process.stdout.write('Weave gain - command output reports only\n');
  process.stdout.write('----------------------------------------------------------------------\n');
  process.stdout.write(`Commands recorded:   ${runs.length}\n`);
  process.stdout.write(`Raw stream bytes:    ${originalBytes}\n`);
  process.stdout.write(`Report bytes:        ${presentedBytes}\n`);
  process.stdout.write(`Reduction:           ${reductionPct}%\n`);
  process.stdout.write(`Tokens saved (approx, 4 bytes/token): ~${approxTokensSaved}\n`);
  process.stdout.write('\nThis compares captured stdout/stderr with the complete Weave report.\n');
  process.stdout.write('It does not estimate total context, session cost, or API spend.\n');
}

function cmdDiscover() {
  const result = discover.scan({ cwd: process.cwd() });
  if (!result.found) {
    process.stdout.write(`No Claude Code session history found for this project at ${result.dir}\n`);
    process.stdout.write('Nothing to analyze yet - run some sessions first, or this project only uses Codex.\n');
    return;
  }
  if (result.analyzed === 0) {
    process.stdout.write(`Scanned ${result.files} session file(s), found no unwrapped Bash commands with recorded output.\n`);
    return;
  }
  const missed = Math.max(0, result.originalBytes - result.presentedBytes);
  const approxTokens = Math.round(missed / 4);
  process.stdout.write('Weave discover - missed reduction in past sessions not wrapped by Weave\n');
  process.stdout.write('----------------------------------------------------------------------\n');
  process.stdout.write(`Session files scanned:     ${result.files}\n`);
  process.stdout.write(`Unwrapped commands found:  ${result.analyzed}\n`);
  process.stdout.write(`Raw output bytes:          ${result.originalBytes}\n`);
  process.stdout.write(`Estimated after reduction: ${result.presentedBytes}\n`);
  process.stdout.write(`Estimated missed savings:  ${missed} bytes (~${approxTokens} tokens)\n`);
  const kinds = Object.entries(result.byKind).sort((a, b) => b[1] - a[1]);
  if (kinds.length) {
    process.stdout.write('\nBy command type (estimated bytes missed):\n');
    for (const [kind, bytes] of kinds) process.stdout.write(`  ${kind.padEnd(12)} ${bytes}\n`);
  }
  process.stdout.write('\nThese commands ran before Weave was active, or outside its wrapper (e.g. mode off).\n');
  process.stdout.write('Estimates replay recorded output through the current filters; they are not measured token billing.\n');
}

function cmdMode(argv) {
  const requested = argv[0];
  if (!requested) {
    process.stdout.write(modes.instructions(modes.readMode(process.cwd())) + '\n');
    return;
  }
  if (!modes.MODES.has(requested)) {
    process.stderr.write('weave mode: expected off, lite, full, or ultra\n');
    process.exitCode = 2;
    return;
  }
  modes.writeMode(process.cwd(), requested);
  process.stdout.write(modes.instructions(requested) + '\n');
}

function checkJson(label, filePath, results) {
  if (!fs.existsSync(filePath)) {
    results.push({ ok: false, label, detail: `missing: ${filePath}` });
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    results.push({ ok: true, label, detail: filePath });
    return parsed;
  } catch (e) {
    results.push({ ok: false, label, detail: `invalid JSON in ${filePath}: ${e.message}` });
    return null;
  }
}

function cmdDoctor() {
  const results = [];

  results.push({ ok: true, label: 'node runtime', detail: process.version });

  const bashPath = execCore.bashExecutable();
  const bashCheck = spawnSync(bashPath, ['-c', 'exit 0'], { windowsHide: true });
  results.push({
    ok: !bashCheck.error && bashCheck.status === 0,
    label: 'bash executable',
    detail: bashCheck.error ? bashCheck.error.message : bashPath,
  });

  checkJson('.claude-plugin/plugin.json', path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), results);
  checkJson('.claude-plugin/marketplace.json', path.join(PLUGIN_ROOT, '.claude-plugin', 'marketplace.json'), results);
  checkJson('.codex-plugin/plugin.json', path.join(PLUGIN_ROOT, '.codex-plugin', 'plugin.json'), results);
  const hooksJson = checkJson('hooks/hooks.json', path.join(PLUGIN_ROOT, 'hooks', 'hooks.json'), results);

  const hookScriptPath = path.join(PLUGIN_ROOT, 'hooks', 'pretooluse.js');
  results.push({
    ok: fs.existsSync(hookScriptPath),
    label: 'hooks/pretooluse.js present',
    detail: hookScriptPath,
  });
  const lifecyclePath = path.join(PLUGIN_ROOT, 'hooks', 'lifecycle.js');
  results.push({ ok: fs.existsSync(lifecyclePath), label: 'lifecycle mode hook present', detail: lifecyclePath });

  const hasBashMatcher = Boolean(
    hooksJson &&
      hooksJson.hooks &&
      Array.isArray(hooksJson.hooks.PreToolUse) &&
      hooksJson.hooks.PreToolUse.some((entry) => String(entry.matcher || '').includes('Bash'))
  );
  results.push({ ok: hasBashMatcher, label: 'PreToolUse Bash matcher registered', detail: hasBashMatcher ? 'found' : 'not found in hooks.json' });

  const skillPath = path.join(PLUGIN_ROOT, 'skills', 'weave', 'SKILL.md');
  results.push({ ok: fs.existsSync(skillPath), label: 'skills/weave/SKILL.md present', detail: skillPath });

  const weaveDir = path.join(process.cwd(), '.weave');
  let writable = false;
  try {
    fs.mkdirSync(weaveDir, { recursive: true });
    const probe = path.join(weaveDir, `.doctor-probe-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    writable = true;
  } catch (e) {
    results.push({ ok: false, label: '.weave/ writable', detail: e.message });
  }
  if (writable) results.push({ ok: true, label: '.weave/ writable', detail: weaveDir });

  let allOk = true;
  for (const r of results) {
    process.stdout.write(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.label} - ${r.detail}\n`);
    if (!r.ok) allOk = false;
  }
  process.exitCode = allOk ? 0 : 1;
}

function main() {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case 'exec':
      return cmdExec(rest);
    case 'recall':
      return cmdRecall(rest);
    case 'gain':
      return cmdGain(rest);
    case 'discover':
      return cmdDiscover(rest);
    case 'mode':
      return cmdMode(rest);
    case 'doctor':
      return cmdDoctor(rest);
    default:
      process.stdout.write('Usage: weave <doctor|mode [off|lite|full|ultra]|gain|discover|recall <id>|exec -- <command>>\n');
      process.exitCode = cmd ? 2 : 0;
  }
}

main();
