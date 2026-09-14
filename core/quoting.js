'use strict';

// Wrap an arbitrary string as a single POSIX shell word: replace each single
// quote with '\'' and enclose in single quotes. For any string not
// containing a NUL byte, a POSIX shell parsing shellQuoteSingle(s) as one
// word reproduces s exactly, regardless of what operators/quotes/newlines
// it contains — this is what lets Weave wrap a command without changing
// what it does.
function shellQuoteSingle(str) {
  return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

// Git Bash (MSYS) expects /c/Users/... rather than C:\Users\... in command
// lines it will tokenize itself. Node's own fs/path calls work fine with
// either form; this conversion is only for text we're about to hand to a
// shell as source, not for filesystem access.
function toGitBashPath(winPath) {
  return String(winPath)
    .replace(/^([A-Za-z]):\\/, (_m, drive) => `/${drive.toLowerCase()}/`)
    .replace(/\\/g, '/');
}

module.exports = { shellQuoteSingle, toGitBashPath };
