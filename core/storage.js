'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_MAX_COUNT = 200;
const DEFAULT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const RUN_ID_RE = /^[a-f0-9]{12}$/;

function runsDir(cwd) {
  return path.join(cwd, '.weave', 'runs');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function generateId() {
  return crypto.randomBytes(6).toString('hex');
}

function saveRun(cwd, meta, rawText) {
  const dir = runsDir(cwd);
  ensureDir(dir);
  const id = generateId();
  const record = { id, ts: new Date().toISOString(), hasRaw: Boolean(rawText), ...meta };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(record, null, 2), { mode: 0o600 });
  if (rawText) {
    fs.writeFileSync(path.join(dir, `${id}.raw.txt`), rawText, { mode: 0o600 });
  }
  pruneOldRuns(cwd);
  return id;
}

function loadRun(cwd, id) {
  if (!RUN_ID_RE.test(String(id || ''))) return null;
  const dir = runsDir(cwd);
  const metaPath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(metaPath)) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const rawPath = path.join(dir, `${id}.raw.txt`);
  const raw = fs.existsSync(rawPath) ? fs.readFileSync(rawPath, 'utf8') : null;
  return { meta, raw };
}

function listRuns(cwd) {
  const dir = runsDir(cwd);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && RUN_ID_RE.test(path.basename(f, '.json')))
    .map((f) => {
      try {
        return { ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), id: path.basename(f, '.json') };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
}

function pruneOldRuns(cwd, { maxCount = DEFAULT_MAX_COUNT, maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  const dir = runsDir(cwd);
  if (!fs.existsSync(dir)) return { removed: 0 };
  const runs = listRuns(cwd);
  const now = Date.now();
  const toRemove = new Set();

  for (const r of runs) {
    if (now - new Date(r.ts).getTime() > maxAgeMs) toRemove.add(r.id);
  }
  const remainingAfterAge = runs.filter((r) => !toRemove.has(r.id));
  if (remainingAfterAge.length > maxCount) {
    const excess = remainingAfterAge.length - maxCount;
    remainingAfterAge.slice(0, excess).forEach((r) => toRemove.add(r.id));
  }

  for (const id of toRemove) {
    for (const ext of ['.json', '.raw.txt']) {
      const p = path.join(dir, `${id}${ext}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
  return { removed: toRemove.size };
}

module.exports = { runsDir, generateId, saveRun, loadRun, listRuns, pruneOldRuns, DEFAULT_MAX_COUNT, DEFAULT_MAX_AGE_MS };
