'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { shellQuoteSingle, shellQuotePowershell, toGitBashPath } = require('./quoting');
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
  const str = String(command || '').trimStart();
  return (
    str.startsWith(SENTINEL) ||
    str.startsWith('$env:WEAVE_WRAPPED') ||
    /^node\s+["']?.*?weave(?:\.js)?["']?\s+exec\b/i.test(str) ||
    /^weave(?:\.js)?\s+exec\b/i.test(str)
  );
}

function shouldWrap(toolInput) {
  const command = toolInput && (toolInput.command || toolInput.CommandLine);
  if (!command || typeof command !== 'string') return false;
  if (toolInput.run_in_background) return false;
  if (isAlreadyWrapped(command)) return false;
  if (command.length > MAX_WRAP_LEN) return false;
  return true;
}

function buildWrappedCommand(originalCommand, weaveJsPath, cwd, { shell = 'bash' } = {}) {
  if (shell === 'powershell') {
    const cwdArg = cwd ? `--cwd ${shellQuotePowershell(cwd)} ` : '';
    const b64 = Buffer.from(originalCommand, 'utf8').toString('base64');
    return `$env:WEAVE_WRAPPED="1"; node ${shellQuotePowershell(weaveJsPath)} exec --shell powershell ${cwdArg}--b64 ${b64}`;
  }
  const jsPath = toGitBashPath(weaveJsPath);
  const cwdArg = cwd ? `--cwd ${shellQuoteSingle(cwd)} ` : '';
  return `${SENTINEL} node ${shellQuoteSingle(jsPath)} exec ${cwdArg}-- ${shellQuoteSingle(originalCommand)}`;
}

function runCommand(command, { cwd, shell = 'bash' } = {}) {
  const isPowershell = shell === 'powershell';
  let binary, args;
  if (isPowershell) {
    binary = 'powershell.exe';
    const b64 = Buffer.from(command, 'utf16le').toString('base64');
    args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64];
  } else {
    binary = bashExecutable();
    args = ['-c', command];
  }
  const shellName = isPowershell ? 'powershell' : 'bash';

  const result = spawnSync(binary, args, {
    cwd: cwd || process.cwd(),
    maxBuffer: CAPTURE_CAP_BYTES,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) {
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    if (stdout || stderr) {
      const note = `weave: ${shellName} exited abnormally after partial capture: ${result.error.message}`;
      return {
        stdout,
        stderr: stderr ? `${stderr}\n${note}` : note,
        exitCode: 1,
      };
    }
    return {
      stdout: '',
      stderr: `weave: failed to execute via ${shellName}: ${result.error.message}`,
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
  const dedupedOmitted = lines.length - deduped.length;
  const { lines: kept, omitted: truncatedOmitted } = filters.truncateMiddle(deduped, { head: 15, tail: 15, keepPattern: filters.IMPORTANT_LINE });
  return { presented: kept.join('\n'), omitted: dedupedOmitted + truncatedOmitted };
}

function computeReport(command, stdout, stderr, exitCode) {
  const reducedOut = filters.reduceOutput(command, stdout, exitCode);
  const reducedErr = presentStderr(stderr, exitCode);

  const totalOmitted = reducedOut.omitted + reducedErr.omitted;
  const shouldPersistRaw = exitCode !== 0 || totalOmitted > 0;
  const originalBytes = bytes(stdout) + bytes(stderr);
  const provisionalReport = {
    id: '000000000000',
    command,
    exitCode,
    summary: reducedOut.summary,
    failures: exitCode === 0 && reducedOut.failures === 'none' ? 'none' : reducedOut.failures,
    omitted: totalOmitted,
    recovery: shouldPersistRaw ? 'weave recall 000000000000' : 'nothing to recover - no content was omitted',
    presentedStdout: reducedOut.presented,
    presentedStderr: reducedErr.presented,
  };
  const passthrough = bytes(formatReport(provisionalReport)) >= originalBytes;
  const presentedBytes = passthrough ? originalBytes : bytes(formatReport(provisionalReport));
  const omitted = passthrough ? 0 : totalOmitted;

  return {
    ...provisionalReport,
    passthrough,
    originalBytes,
    presentedBytes,
    omitted,
    presentedStdout: passthrough ? stdout : reducedOut.presented,
    presentedStderr: passthrough ? stderr : reducedErr.presented,
    kind: reducedOut.kind,
    shouldPersistRaw,
  };
}

function execAndReport(command, { cwd, shell = 'bash' } = {}) {
  const workDir = cwd || process.cwd();
  const run = runCommand(command, { cwd: workDir, shell });
  const report = computeReport(command, run.stdout, run.stderr, run.exitCode);

  const rawText = report.shouldPersistRaw
    ? redact.redact([`$ ${command}`, '', '[stdout]', run.stdout, '', '[stderr]', run.stderr, '', `[exit] ${run.exitCode}`].join('\n'))
    : null;

  let id = report.id;
  let persisted = false;
  try {
    id = storage.saveRun(
      workDir,
      {
        command: redact.redact(command),
        exitCode: run.exitCode,
        kind: report.kind,
        originalBytes: report.originalBytes,
        presentedBytes: report.presentedBytes,
        omitted: report.omitted,
      },
      rawText
    );
    persisted = true;
  } catch {}

  return {
    ...report,
    id,
    recovery: report.shouldPersistRaw
      ? persisted ? `weave recall ${id}` : 'nothing to recover - history could not be saved'
      : report.recovery,
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
  computeReport,
  execAndReport,
  formatReport,
};
