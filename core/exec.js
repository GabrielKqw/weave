'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { shellQuoteSingle, toGitBashPath } = require('./quoting');
const filters = require('./filters');
const redact = require('./redact');
const storage = require('./storage');

const SENTINEL = 'WEAVE_WRAPPED=1';
const MAX_WRAP_LEN = 4000;
const CAPTURE_CAP_BYTES = 20 * 1024 * 1024;

function bashExecutable() {
  if (process.env.WEAVE_BASH) return process.env.WEAVE_BASH;
  if (process.platform !== 'win32') return 'bash';
  const candidates = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'),
  ].filter(Boolean);
  return candidates.find(fs.existsSync) || 'bash';
}

function isAlreadyWrapped(command) {
  return String(command || '').trimStart().startsWith(SENTINEL);
}

function shouldWrap(toolInput) {
  const command = toolInput && toolInput.command;
  if (!command || typeof command !== 'string') return false;
  if (toolInput.run_in_background) return false;
  if (isAlreadyWrapped(command)) return false;
  if (command.length > MAX_WRAP_LEN) return false;
  return true;
}

function buildWrappedCommand(originalCommand, weaveJsPath, cwd) {
  const jsPath = toGitBashPath(weaveJsPath);
  const cwdArg = cwd ? `--cwd ${shellQuoteSingle(cwd)} ` : '';
  return `${SENTINEL} node ${shellQuoteSingle(jsPath)} exec ${cwdArg}-- ${shellQuoteSingle(originalCommand)}`;
}

function runCommand(command, { cwd } = {}) {
  const result = spawnSync(bashExecutable(), ['-c', command], {
    cwd: cwd || process.cwd(),
    maxBuffer: CAPTURE_CAP_BYTES,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) {
    return {
      stdout: '',
      stderr: `weave: failed to execute via bash: ${result.error.message}`,
      exitCode: 127,
    };
  }
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status === null ? 1 : result.status,
  };
}

function bytes(s) {
  return Buffer.byteLength(s || '', 'utf8');
}

function presentStderr(stderr, exitCode) {
  if (exitCode !== 0) return { presented: stderr || '', omitted: 0 };
  const lines = filters.toLines(stderr);
  if (bytes(stderr) < filters.FLOOR_BYTES && lines.length < filters.FLOOR_LINES) {
    return { presented: stderr || '', omitted: 0 };
  }
  const deduped = filters.dedupeConsecutive(lines);
  const { lines: kept, omitted } = filters.truncateMiddle(deduped, { head: 15, tail: 15, keepPattern: filters.IMPORTANT_LINE });
  return { presented: kept.join('\n'), omitted };
}

function execAndReport(command, { cwd } = {}) {
  const workDir = cwd || process.cwd();
  const run = runCommand(command, { cwd: workDir });
  const reducedOut = filters.reduceOutput(command, run.stdout, run.exitCode);
  const reducedErr = presentStderr(run.stderr, run.exitCode);

  const totalOmitted = reducedOut.omitted + reducedErr.omitted;
  const shouldPersistRaw = run.exitCode !== 0 || totalOmitted > 0;

  const originalBytes = bytes(run.stdout) + bytes(run.stderr);
  let rawText = null;
  if (shouldPersistRaw) {
    rawText = redact.redact(
      [`$ ${command}`, '', '[stdout]', run.stdout, '', '[stderr]', run.stderr, '', `[exit] ${run.exitCode}`].join('\n')
    );
  }

  const persistedCommand = redact.redact(command);
  const provisionalReport = {
    id: '000000000000',
    command,
    exitCode: run.exitCode,
    summary: reducedOut.summary,
    failures: run.exitCode === 0 && reducedOut.failures === 'none' ? 'none' : reducedOut.failures,
    omitted: totalOmitted,
    recovery: shouldPersistRaw ? 'weave recall 000000000000' : 'nothing to recover - no content was omitted',
    presentedStdout: reducedOut.presented,
    presentedStderr: reducedErr.presented,
  };
  const passthrough = bytes(formatReport(provisionalReport)) >= originalBytes;
  const presentedBytes = passthrough ? originalBytes : bytes(formatReport(provisionalReport));
  const omitted = passthrough ? 0 : totalOmitted;

  const id = storage.saveRun(
    workDir,
    {
      command: persistedCommand,
      exitCode: run.exitCode,
      kind: reducedOut.kind,
      originalBytes,
      presentedBytes,
      omitted,
    },
    rawText
  );

  return {
    ...provisionalReport,
    id,
    passthrough,
    omitted,
    presentedStdout: passthrough ? run.stdout : reducedOut.presented,
    presentedStderr: passthrough ? run.stderr : reducedErr.presented,
    recovery: shouldPersistRaw ? `weave recall ${id}` : provisionalReport.recovery,
  };
}

function formatReport(report) {
  if (report.passthrough) return report.presentedStdout + report.presentedStderr;
  const lines = [
    `Command: ${report.command}`,
    `Exit: ${report.exitCode}`,
    `Summary: ${report.summary}`,
    `Failures: ${report.failures}`,
    `Omitted: ${report.omitted > 0 ? `${report.omitted} line(s)` : 'nothing omitted'}`,
    `Recovery: ${report.recovery}`,
    '---',
    '[stdout]',
    report.presentedStdout || '(empty)',
    '',
    '[stderr]',
    report.presentedStderr || '(empty)',
  ];
  return lines.join('\n');
}

module.exports = {
  bashExecutable,
  SENTINEL,
  MAX_WRAP_LEN,
  isAlreadyWrapped,
  shouldWrap,
  buildWrappedCommand,
  runCommand,
  execAndReport,
  formatReport,
};
