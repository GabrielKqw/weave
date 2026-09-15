'use strict';

const FLOOR_BYTES = 400;
const FLOOR_LINES = 12;

function toLines(text) {
  if (!text) return [];
  return text.split(/\r?\n/);
}

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

function classify(command) {
  const c = (command || '').trim();
  const hasShellOperators = /(\s\|\|?\s|\s&&\s|;|>>?|<)/.test(c);
  if (hasShellOperators) return 'generic';
  if (/\s(--json|--format[= ]json|-o[= ]json)\b/i.test(c)) return 'passthrough';
  if (/^(cat|type|more|less|head|tail|sed|Get-Content)\b/i.test(c)) return 'passthrough';
  if (/^gh\s+api\b/.test(c)) return 'passthrough';
  if (/^git\s+status\b/.test(c)) return 'git-status';
  if (/^git\s+diff\b/.test(c)) return 'git-diff';
  if (/^git\s+log\b/.test(c)) return 'git-log';
  if (/^git\s+(branch|stash|fetch|pull|push|add|commit)\b/.test(c)) return 'summary';
  if (/^(rg|grep)\b/.test(c)) return 'grep';
  if (
    /^(pytest|python\s+-m\s+pytest|(?:npm|pnpm|yarn|bun)(?:\s+run)?\s+test\b|cargo\s+test\b|dotnet\s+test\b|go\s+test\b|mvn(?:w)?\s+test\b|gradle(?:w)?\s+test\b|jest\b|npx\s+(?:jest|vitest|playwright)\b|vitest\b|playwright\s+test\b|(?:bundle\s+exec\s+)?rspec\b|(?:bundle\s+exec\s+)?rake\s+test\b)/.test(
      c
    )
  ) {
    return 'test';
  }
  if (
    /^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:build|lint|check|format)\b|^cargo\s+(?:build|check|clippy|fmt)\b|^dotnet\s+(?:build|format)\b|^go\s+(?:build|vet|fmt)\b|^(?:make|cmake|mvnw?|gradlew?)\b|^(?:npx\s+)?prettier\b/.test(
      c
    )
  ) {
    return 'summary';
  }
  if (/^(?:npm|pnpm|yarn|bun)\s+(?:i|install|add|outdated|list|ls)\b|^(?:pip|pip3)\s+install\b|^cargo\s+install\b/.test(c)) return 'summary';
  if (/^gh\s+(?:pr|run|issue)\s+\w+/.test(c)) return 'summary';
  if (/^(?:ls|dir|tree|find|fd)\b/i.test(c)) return 'listing';
  if (/^(?:docker(?:\s+compose)?|kubectl|terraform|journalctl)\b/.test(c)) {
    return /\b(logs?|events?)\b/.test(c) ? 'logs' : 'summary';
  }
  return 'generic';
}

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

function filterGitDiff(stdout) {
  const lines = toLines(stdout);
  const indexLine = /^index [0-9a-f]+\.\.[0-9a-f]+(\s+\d+)?$/;
  const kept = lines.filter((l) => !indexLine.test(l));
  return { presented: kept.join('\n'), omitted: lines.length - kept.length };
}

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

const IMPORTANT_LINE = /\b(error|exception|traceback|fail(ed|ure)?|denied|refused|panic|warn(ing)?|deprecated|vulnerabilit\w*)\b/i;

function filterGeneric(stdout) {
  const lines = toLines(stdout);
  const bytes = Buffer.byteLength(stdout || '', 'utf8');
  if (bytes < FLOOR_BYTES && lines.length < FLOOR_LINES) {
    return { presented: stdout, omitted: 0 };
  }
  const deduped = dedupeConsecutive(lines);
  const { lines: kept, omitted } = truncateMiddle(deduped, { head: 20, tail: 20, keepPattern: IMPORTANT_LINE });
  return { presented: kept.join('\n'), omitted };
}

function filterSummary(stdout) {
  const lines = dedupeConsecutive(toLines(stdout));
  const { lines: kept, omitted } = truncateMiddle(lines, { head: 6, tail: 12, keepPattern: IMPORTANT_LINE });
  return { presented: kept.join('\n'), omitted };
}

function filterListing(stdout) {
  const lines = toLines(stdout);
  const { lines: kept, omitted } = truncateMiddle(lines, { head: 30, tail: 10 });
  return { presented: kept.join('\n'), omitted };
}

function filterLogs(stdout) {
  const lines = dedupeConsecutive(toLines(stdout));
  const { lines: kept, omitted } = truncateMiddle(lines, { head: 8, tail: 30, keepPattern: IMPORTANT_LINE });
  return { presented: kept.join('\n'), omitted };
}

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

  if (kind === 'passthrough') {
    return { kind, presented: stdout || '', omitted: 0, summary: 'ok (verbatim output preserved)', failures: 'none' };
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
    case 'summary': {
      const r = filterSummary(stdout);
      return { kind, presented: r.presented, omitted: r.omitted, summary: 'successful command output condensed', failures: 'none' };
    }
    case 'listing': {
      const r = filterListing(stdout);
      return { kind, presented: r.presented, omitted: r.omitted, summary: 'listing condensed', failures: 'none' };
    }
    case 'logs': {
      const r = filterLogs(stdout);
      return { kind, presented: r.presented, omitted: r.omitted, summary: 'logs condensed; errors and tail retained', failures: 'none' };
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
  IMPORTANT_LINE,
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
  filterSummary,
  filterListing,
  filterLogs,
  reduceOutput,
};
