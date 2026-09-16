'use strict';

const PATTERNS = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
  /\b([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s/]+(@)/gi,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_.-]{20,}(?![A-Za-z0-9_.-])/g,
  /\b(Bearer|Authorization:\s*Bearer)\s+[A-Za-z0-9._~+/-]{10,}=*/gi,
  /((?:api[_-]?key|access[_-]?token|secret|password|passwd|token|client[_-]?secret)\s*[:=]\s*)(?:"[^"\r\n]{4,}"|'[^'\r\n]{4,}'|["']?[^\s"']{4,}["']?)/gi,
];

function redact(text) {
  if (!text) return text;
  let out = text;
  out = out.replace(PATTERNS[0], '[REDACTED:private-key]');
  out = out.replace(PATTERNS[1], '$1[REDACTED]$2');
  out = out.replace(PATTERNS[2], '[REDACTED:api-key]');
  out = out.replace(PATTERNS[3], '[REDACTED:aws-key]');
  out = out.replace(PATTERNS[4], '[REDACTED:token]');
  out = out.replace(PATTERNS[5], '[REDACTED:bearer]');
  out = out.replace(PATTERNS[6], (_m, prefix) => `${prefix}[REDACTED]`);
  return out;
}

module.exports = { redact };
