'use strict';

const fs = require('fs');
const path = require('path');

const MODES = new Set(['off', 'lite', 'full', 'ultra']);

function modePath(cwd) {
  return path.join(cwd || process.cwd(), '.weave', 'mode');
}

function readMode(cwd) {
  try {
    const mode = fs.readFileSync(modePath(cwd), 'utf8').trim();
    return MODES.has(mode) ? mode : 'full';
  } catch {
    return 'full';
  }
}

function writeMode(cwd, mode) {
  if (!MODES.has(mode)) throw new Error(`invalid mode: ${mode}`);
  const file = modePath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, mode + '\n');
  return mode;
}

function requestedMode(prompt) {
  const text = String(prompt || '').trim().toLowerCase();
  if (/^(stop weave|normal mode)$/.test(text)) return 'off';
  const match = /^(?:[/@$]weave|weave\s+mode)\s+(off|lite|full|ultra)$/.exec(text);
  return match ? match[1] : null;
}

function instructions(mode) {
  if (mode === 'off') return 'WEAVE MODE OFF';
  const shared = [
    `WEAVE MODE ACTIVE - level: ${mode}`,
    'Trace the affected flow before editing; fix shared causes, not isolated symptoms.',
    'Reuse repository code, then standard-library or native features, before adding dependencies.',
    'Make the smallest correct change and verify it with real evidence.',
    'Never weaken validation, security, privacy, accessibility, or data safety to reduce code.',
  ];
  if (mode === 'lite') return [shared[0], shared[2], shared[3]].join('\n');
  if (mode === 'ultra') shared.splice(3, 0, 'Question whether new code is needed; prefer deletion and direct one-purpose code over flexibility.');
  return shared.join('\n');
}

module.exports = { MODES, modePath, readMode, writeMode, requestedMode, instructions };
