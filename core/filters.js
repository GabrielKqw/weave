'use strict';

// Weave's own terminal-output reduction engine.
//
// Original implementation — no code from RTK (Apache-2.0) or Ponytail (MIT)
// is reused here. Only the general, publicly documented *concepts* behind
// noise reduction (filter/group/dedupe/truncate, keep errors, allow full
// recovery) informed this design; see README's RTK/Ponytail sections for
// the sources consulted.
//
// Every filter is conservative: if it can't confidently reduce output
// without risking the loss of a real error, it returns the input unchanged
// and reports omitted: 0. Nothing here ever changes what already ran —
// only how the result is presented.

const FLOOR_BYTES = 400;
const FLOOR_LINES = 12;

function toLines(text) {
  if (!text) return [];
  return text.split(/\r?\n/);
}

// Collapse runs of consecutive identical lines into "<line>  (×N)".
function dedupeConsecutive(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let j = i + 1;
    while (j < lines.length && lines[j] === lines[i]) j++;
    const count = j - i;
    out.push(count > 1 ? `${lines[i]}  (×${count})` : lines[i]);
    i = j;
  }
  return out;
}

// Keep the first `head` lines, the last `tail` lines, and any line matching
// `keepPattern` wherever it occurs; collapse the rest into omission markers.
// Returns { lines, omitted } where `omitted` is the count of dropped lines.
function truncateMiddle(lines, { head = 20, tail = 20, keepPattern = null } = {}) {
  if (lines.length <= head + tail) return { lines: lines.slice(), omitted: 0 };

  const kept = new Set();
  for (let i = 0; i < head && i < lines.length; i++) kept.add(i);
  for (let i = Math.max(0, lines.length - tail); i < lines.length; i++) kept.add(i);
  if (keepPattern) {
    lines.forEach((l, i) => {
      if (keepPattern.test(l)) kept.add(i);
    });
  }

  const idxs = Array.from(kept).sort((a, b) => a - b);
  const out = [];
  let last = -1;
  let omitted = 0;
  for (const i of idxs) {
    if (i > last + 1) {
      const gap = i - last - 1;
      omitted += gap;
      out.push(`… ${gap} line(s) omitted …`);
    }
    out.push(lines[i]);
    last = i;
  }
  if (last < lines.length - 1) {
    const gap = lines.length - 1 - last;
    omitted += gap;
    out.push(`… ${gap} line(s) omitted …`);
  }
  return { lines: out, omitted };
}

// Decide which specific filter applies. Anything containing top-level shell
// operators is left as "generic" — we never try to structurally parse mixed
// output from a chained/piped command.
function classify(command) {
  const c = (command || '').trim();
  const hasShellOperators = /(\s\|\|?\s|\s&&\s|;|>>?|<)/.test(c);
  if (hasShellOperators) return 'generic';
  if (/^git\s+status\b/.test(c)) return 'git-status';
  if (/^git\s+diff\b/.test(c)) return 'git-diff';
  if (/^git\s+log\b/.test(c)) return 'git-log';
  if (/^(rg|grep)\b/.test(c)) return 'grep';
  if (/^(pytest|npm(\s+run)?\s+test\b|npm\s+test\b|cargo\s+test\b|dotnet\s+test\b|jest\b|npx\s+jest\b|vitest\b)/.test(c)) {
    return 'test';
  }
  return 'generic';
}

// `git status` boilerplate ("(use \"git add <file>...\" to update...)") is
// pure instructional text the model never needs to act on.
function filterGitStatus(stdout) {
  const lines = toLines(stdout);
  const hint = /^\s*\(use "git [^"]+"[^)]*\)\s*$/;
  const kept = [];
  for (const l of lines) {
    if (hint.test(l)) continue;
    if (l === '' && kept[kept.length - 1] === '') continue;
    kept.push(l);
  }
  return { presented: kept.join('\n'), omitted: lines.length - kept.length };
}

// The `index <hash>..<hash> <mode>` line in a diff is never diagnostically
// useful; everything else (hunks, +/- lines) is left untouched.
function filterGitDiff(stdout) {
  const lines = toLines(stdout);
  const indexLine = /^index [0-9a-f]+\.\.[0-9a-f]+(\s+\d+)?$/;
  const kept = lines.filter((l) => !indexLine.test(l));
  return { presented: kept.join('\n'), omitted: lines.length - kept.length };
}

// Condense the verbose default `git log` (commit/Author/Date/blank/message
// blocks) to one line per commit, unless the caller already asked for an
// explicit format — in which case we don't second-guess it.
function filterGitLog(stdout, command) {
  if (/--oneline|--format|--pretty|-p\b|--stat|--patch/.test(command || '')) {
    return { presented: stdout, omitted: 0 };
  }
  const lines = toLines(stdout);
  const out = [];
  let omitted = 0;
  let i = 0;
  const commitStart = /^commit\s+([0-9a-f]{7,40})/;
  while (i < lines.length) {
    const m = commitStart.exec(lines[i]);
    if (!m) {
      i++;
      continue;
    }
    const hash = m[1].slice(0, 7);
    let j = i + 1;
    let author = '';
    let date = '';
    let subject = '';
    let extraLines = 0;
    while (j < lines.length && !commitStart.test(lines[j])) {
      if (/^Author:/.test(lines[j])) author = lines[j].replace(/^Author:\s*/, '').trim();
      else if (/^Date:/.test(lines[j])) date = lines[j].replace(/^Date:\s*/, '').trim();
      else if (lines[j].trim() && !subject) subject = lines[j].trim();
      else if (lines[j].trim()) extraLines++;
      j++;
    }
    const consumed = j - i;
    out.push(`${hash}  ${date}  ${author}  ${subject}${extraLines ? `  (+${extraLines} more line(s))` : ''}`);
    omitted += Math.max(0, consumed - 1);
    i = j;
  }
  return { presented: out.join('\n'), omitted };
}

// Group `file:line:content` matches by file, showing the first few per file
// in full and collapsing the rest to a count.
function filterGrep(stdout, { maxPerFile = 5 } = {}) {
  const lines = toLines(stdout).filter((l) => l.length);
  const linePattern = /^([^:]+):(\d+):(.*)$/;
  const byFile = new Map();
  const order = [];
  let unmatched = 0;
  for (const l of lines) {
    const m = linePattern.exec(l);
    if (!m) {
      unmatched++;
      continue;
    }
    const [, file, lineNo, rest] = m;
    if (!byFile.has(file)) {
      byFile.set(file, []);
      order.push(file);
    }
    byFile.get(file).push(`${lineNo}: ${rest}`);
  }
  if (lines.length === 0 || unmatched === lines.length) {
    // Doesn't look like file:line:content (e.g. -l, -c, -o, custom format).
    return { presented: stdout, omitted: 0 };
  }
  let omitted = unmatched;
  const out = [];
  for (const file of order) {
    const entries = byFile.get(file);
    out.push(`${file} (${entries.length} match${entries.length === 1 ? '' : 'es'})`);
    entries.slice(0, maxPerFile).forEach((e) => out.push('  ' + e));
    if (entries.length > maxPerFile) {
      const rest = entries.length - maxPerFile;
      out.push(`  … ${rest} more match(es) in this file`);
      omitted += rest;
    }
  }
  return { presented: out.join('\n'), omitted };
}

const FAILURE_MARKER = /\b(FAIL(ED)?|Error|Exception|AssertionError|Traceback|not ok|✗|×)\b/;

// Test-runner output: on success, collapse to the runner's own tail summary
// (nothing diagnostic is lost — nothing failed). On failure, dedupe repeats
// and keep every line near a failure marker plus the tail summary, so the
// actual assertion/traceback/file:line survives.
function filterTestOutput(stdout, exitCode) {
  const lines = toLines(stdout);
  const deduped = dedupeConsecutive(lines);
  if (exitCode === 0) {
    const tail = deduped.slice(-6).filter((l) => l.trim().length);
    const omitted = Math.max(0, lines.length - tail.length);
    return {
      presented: tail.join('\n'),
      omitted,
      summary: tail[tail.length - 1] || 'command exited 0',
      failures: 'none',
    };
  }
  const { lines: kept, omitted } = truncateMiddle(deduped, { head: 0, tail: 6, keepPattern: FAILURE_MARKER });
  const failureLines = deduped.filter((l) => FAILURE_MARKER.test(l));
  return {
    presented: kept.join('\n'),
    omitted,
    summary: `command exited ${exitCode}`,
    failures: failureLines.length ? failureLines.join('\n') : '(non-zero exit, no known failure marker matched — see presented output)',
  };
}

const ERRORISH = /\b(error|exception|traceback|fail(ed|ure)?|denied|refused|panic)\b/i;

// Fallback for anything not specifically classified: only touches output
// that is actually long/repetitive; small output always passes through.
function filterGeneric(stdout) {
  const lines = toLines(stdout);
  const bytes = Buffer.byteLength(stdout || '', 'utf8');
  if (bytes < FLOOR_BYTES && lines.length < FLOOR_LINES) {
    return { presented: stdout, omitted: 0 };
  }
  const deduped = dedupeConsecutive(lines);
  const { lines: kept, omitted } = truncateMiddle(deduped, { head: 20, tail: 20, keepPattern: ERRORISH });
  return { presented: kept.join('\n'), omitted };
}

// Top-level entry point. Always returns a presentable stdout string plus
// bookkeeping the CLI needs to build the Command/Exit/Summary/... report.
function reduceOutput(command, stdout, exitCode) {
  const rawBytes = Buffer.byteLength(stdout || '', 'utf8');
  const kind = classify(command);

  if (exitCode !== 0) {
    return {
      kind: 'passthrough',
      presented: stdout || '',
      omitted: 0,
      summary: `exited ${exitCode}`,
      failures: '(see complete output above)',
    };
  }

  if (rawBytes < FLOOR_BYTES) {
    return {
      kind: 'passthrough',
      presented: stdout || '',
      omitted: 0,
      summary: 'ok',
      failures: 'none',
    };
  }

  switch (kind) {
    case 'git-status': {
      const r = filterGitStatus(stdout);
      return { kind, presented: r.presented, omitted: r.omitted, summary: 'git status (boilerplate hints removed)', failures: 'none' };
    }
    case 'git-diff': {
      const r = filterGitDiff(stdout);
      return { kind, presented: r.presented, omitted: r.omitted, summary: 'git diff (index lines removed)', failures: exitCode === 0 ? 'none' : '(see output above)' };
    }
    case 'git-log': {
      const r = filterGitLog(stdout, command);
      return { kind, presented: r.presented, omitted: r.omitted, summary: 'git log (condensed to one line per commit)', failures: 'none' };
    }
    case 'grep': {
      const r = filterGrep(stdout);
      return { kind, presented: r.presented, omitted: r.omitted, summary: 'matches grouped by file', failures: 'none' };
    }
    case 'test': {
      const r = filterTestOutput(stdout, exitCode);
      return { kind, presented: r.presented, omitted: r.omitted, summary: r.summary, failures: r.failures };
    }
    default: {
      const r = filterGeneric(stdout);
      return {
        kind: 'generic',
        presented: r.presented,
        omitted: r.omitted,
        summary: exitCode === 0 ? 'ok' : `exited ${exitCode}`,
        failures: exitCode === 0 ? 'none' : '(see output above)',
      };
    }
  }
}

module.exports = {
  FLOOR_BYTES,
  FLOOR_LINES,
  toLines,
  dedupeConsecutive,
  truncateMiddle,
  classify,
  filterGitStatus,
  filterGitDiff,
  filterGitLog,
  filterGrep,
  filterTestOutput,
  filterGeneric,
  reduceOutput,
};
