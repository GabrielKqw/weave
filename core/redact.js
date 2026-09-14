'use strict';

// Heuristic secret redaction applied before anything is written to
// `.weave/runs/`. This is defense in depth, not a guarantee — it catches
// common, recognizable secret shapes and common `key=value` assignments; it
// cannot catch a secret with no distinguishing shape. Documented as such in
// README.

const PATTERNS = [
  // AWS access key IDs
  /\bAKIA[0-9A-Z]{16}\b/g,
  // GitHub tokens (classic + fine-grained-ish prefixes)
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  // Bearer / Authorization headers
  /\b(Bearer|Authorization:\s*Bearer)\s+[A-Za-z0-9._-]{10,}/gi,
  // Generic key=value / key: value secrets (password, token, secret, api_key, ...).
  // No leading \b: real names are often prefixed like DB_PASSWORD or MY_API_KEY,
  // and `_` is a word character so \b would not match at that boundary.
  /((?:api[_-]?key|access[_-]?token|secret|password|passwd|token|client[_-]?secret)\s*[:=]\s*)("?[^\s"']{4,}"?)/gi,
];

function redact(text) {
  if (!text) return text;
  let out = text;
  out = out.replace(PATTERNS[0], '[REDACTED:aws-key]');
  out = out.replace(PATTERNS[1], '[REDACTED:token]');
  out = out.replace(PATTERNS[2], '[REDACTED:bearer]');
  out = out.replace(PATTERNS[3], (_m, prefix) => `${prefix}[REDACTED]`);
  return out;
}

module.exports = { redact };
