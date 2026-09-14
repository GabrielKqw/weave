'use strict';

function shellQuoteSingle(str) {
  return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

function toGitBashPath(winPath) {
  return String(winPath)
    .replace(/^([A-Za-z]):\\/, (_m, drive) => `/${drive.toLowerCase()}/`)
    .replace(/\\/g, '/');
}

module.exports = { shellQuoteSingle, toGitBashPath };
