'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 200;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const REPEATED_SEARCH_WINDOW_MS = 15 * 60 * 1000;

function ledgerPath(cwd) {
  return path.join(cwd, '.weave', 'reads.json');
}

function loadLedger(cwd) {
  try {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath(cwd), 'utf8'));
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) throw new Error();
    return {
      version: 1,
      reads: ledger.reads && typeof ledger.reads === 'object' && !Array.isArray(ledger.reads) ? ledger.reads : {},
      searches: Array.isArray(ledger.searches) ? ledger.searches : [],
    };
  } catch {
    return { version: 1, reads: {}, searches: [] };
  }
}

function pruneEntries(entries, timestamp, now) {
  const current = entries.filter((entry) => now - Date.parse(timestamp(entry)) <= MAX_AGE_MS);
  current.sort((a, b) => Date.parse(timestamp(a)) - Date.parse(timestamp(b)));
  return current.slice(Math.max(0, current.length - MAX_ENTRIES));
}

function saveLedger(cwd, ledger) {
  const now = Date.now();
  const reads = pruneEntries(
    Object.entries(ledger.reads).map(([filePath, record]) => ({ filePath, record })),
    (entry) => entry.record.lastReadAt,
    now,
  );
  ledger.reads = Object.fromEntries(reads.map(({ filePath, record }) => [filePath, record]));
  ledger.searches = pruneEntries(ledger.searches, (entry) => entry.lastRunAt, now);

  const dir = path.dirname(ledgerPath(cwd));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(ledgerPath(cwd), JSON.stringify(ledger, null, 2), { mode: 0o600 });
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
}

function checkAndRecordRead(cwd, filePath, content, tool = 'Read') {
  const ledger = loadLedger(cwd);
  const resolvedPath = path.resolve(cwd, filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const previous = ledger.reads[resolvedPath];
  const result = { repeated: Boolean(previous && previous.hash === hash), previousAt: previous && previous.lastReadAt };
  ledger.reads[resolvedPath] = { hash, lastReadAt: new Date().toISOString(), tool };
  saveLedger(cwd, ledger);
  return result;
}

function checkAndRecordSearch(cwd, tool, params) {
  const ledger = loadLedger(cwd);
  const normalized = normalize(params);
  const key = JSON.stringify(normalized);
  const now = Date.now();
  const previous = [...ledger.searches].reverse().find((entry) => (
    entry.tool === tool && JSON.stringify(entry.params) === key
  ));
  const result = {
    repeated: Boolean(previous && now - Date.parse(previous.lastRunAt) <= REPEATED_SEARCH_WINDOW_MS),
    previousAt: previous && previous.lastRunAt,
  };
  ledger.searches.push({ tool, params: normalized, lastRunAt: new Date(now).toISOString() });
  saveLedger(cwd, ledger);
  return result;
}

module.exports = { checkAndRecordRead, checkAndRecordSearch };
