'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const filters = require('./filters');
const { isAlreadyWrapped, formatReport } = require('./exec');

function projectTranscriptsDir(cwd) {
  const slug = path.resolve(cwd).replace(/[:\\/]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', slug);
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
  }
  return '';
}

function readJsonLines(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {}
  }
  return out;
}

function estimatedPresentedBytes(command, exitCode, text) {
  const originalBytes = Buffer.byteLength(text || '', 'utf8');
  const reduced = filters.reduceOutput(command, text, exitCode);
  const report = formatReport({
    passthrough: false,
    command,
    exitCode,
    summary: reduced.summary || 'ok',
    failures: reduced.failures || 'none',
    omitted: reduced.omitted,
    recovery: reduced.omitted > 0 ? 'weave recall <id>' : 'nothing to recover - no content was omitted',
    presentedStdout: reduced.presented,
    presentedStderr: '',
  });
  return Math.min(originalBytes, Buffer.byteLength(report, 'utf8'));
}

function scan({ cwd = process.cwd(), transcriptsDir } = {}) {
  const dir = transcriptsDir || projectTranscriptsDir(cwd);
  if (!fs.existsSync(dir)) {
    return { found: false, dir };
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  let analyzed = 0;
  let originalBytes = 0;
  let presentedBytes = 0;
  const byKind = {};

  for (const file of files) {
    const pendingCommandByToolUseId = new Map();
    for (const entry of readJsonLines(path.join(dir, file))) {
      const content = entry && entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;

      if (entry.type === 'assistant') {
        for (const item of content) {
          if (item && item.type === 'tool_use' && item.name === 'Bash' && item.input && typeof item.input.command === 'string') {
            if (!isAlreadyWrapped(item.input.command)) {
              pendingCommandByToolUseId.set(item.id, item.input.command);
            }
          }
        }
      } else if (entry.type === 'user') {
        for (const item of content) {
          if (item && item.type === 'tool_result' && pendingCommandByToolUseId.has(item.tool_use_id)) {
            const command = pendingCommandByToolUseId.get(item.tool_use_id);
            pendingCommandByToolUseId.delete(item.tool_use_id);
            const text = extractText(item.content);
            if (!text) continue;
            const exitCode = item.is_error ? 1 : 0;
            const kind = filters.classify(command);
            const raw = Buffer.byteLength(text, 'utf8');
            const presented = estimatedPresentedBytes(command, exitCode, text);
            analyzed++;
            originalBytes += raw;
            presentedBytes += presented;
            byKind[kind] = (byKind[kind] || 0) + Math.max(0, raw - presented);
          }
        }
      }
    }
  }

  return { found: true, dir, files: files.length, analyzed, originalBytes, presentedBytes, byKind };
}

module.exports = { projectTranscriptsDir, scan };
