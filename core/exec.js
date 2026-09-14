'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const { shellQuoteSingle, toGitBashPath } = require('./quoting');
const filters = require('./filters');
const redact = require('./redact');
const storage = require('./storage');

const SENTINEL = 'WEAVE_WRAPPED=1';
const MAX_WRAP_LEN = 4000;
const CAPTURE_CAP_BYTES = 20 * 1024 * 1024; // 20MB per stream

function bashExecutable() {
  if (process.env.WEAVE_BASH) return process.env.WEAVE_BASH;
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
  return process.platform === 'win32' && fs.existsSync(gitBash) ? gitBash : 'bash';
}

function isAlreadyWrapped(command) {
  return String(command || '').trimStart().startsWith(SENTINEL);
}

// Decide whether the PreToolUse hook should rewrite this Bash call at all.
// Anything excluded here is true passthrough — the hook makes no decision
// and the original command runs completely untouched.
function shouldWrap(toolInput) {
  const command = toolInput && toolInput.command;
  if (!command || typeof command !== 'string') return false;
  if (toolInput.run_in_background) return false;
  if (isAlreadyWrapped(command)) return false;
  if (command.length > MAX_WRAP_LEN) return false;
  return true;
}

// Build the replacement command string the hook hands back as
// `updatedInput.command`. weaveJsPath is the absolute, OS-native path to
// bin/weave.js (as resolved by Node's own path module).
function buildWrappedCommand(originalCommand, weaveJsPath) {
  const jsPath = toGitBashPath(weaveJsPath);
  return `${SENTINEL} node ${shellQuoteSingle(jsPath)} exec -- ${shellQuoteSingle(originalCommand)}`;
}

// Actually run the original command through the same shell Claude Code's
// own Bash tool uses (Git Bash / POSIX sh), capturing streams separately.
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

// Present stderr with the same dedupe/truncate primitives as the generic
// stdout fallback, but always separately labeled — stderr is never merged
// into or hidden behind the stdout summary.
function presentStderr(stderr, exitCode) {
  if (exitCode !== 0) return { presented: stderr || '', omitted: 0 };
  const lines = filters.toLines(stderr);
  if (bytes(stderr) < filters.FLOOR_BYTES && lines.length < filters.FLOOR_LINES) {
    return { presented: stderr || '', omitted: 0 };
  }
  const deduped = filters.dedupeConsecutive(lines);
  const { lines: kept, omitted } = filters.truncateMiddle(deduped, { head: 15, tail: 15, keepPattern: /error|exception|fail/i });
  return { presented: kept.join('\n'), omitted };
}

// Run `command`, filter its output, persist what's needed for recovery, and
// return everything the CLI needs to print a report and exit with the
// original command's exit code.
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
  const presentedBytes = bytes(formatReport(provisionalReport));

  const id = storage.saveRun(
    workDir,
    {
      command: persistedCommand,
      exitCode: run.exitCode,
      kind: reducedOut.kind,
      originalBytes,
      presentedBytes,
      omitted: totalOmitted,
    },
    rawText
  );

  return {
    ...provisionalReport,
    id,
    recovery: shouldPersistRaw ? `weave recall ${id}` : provisionalReport.recovery,
  };
}

function formatReport(report) {
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
