'use strict';

const fs = require('fs');
const path = require('path');

const NAME_RE = /^[a-zA-Z0-9_.-]+$/;

function memoriesDir(cwd) {
  return path.join(cwd, '.weave', 'memories');
}

function isValidName(name) {
  if (typeof name !== 'string' || !name) return false;
  if (name.includes('..')) return false;
  if (name.includes('/') || name.includes('\\')) return false;
  if (name.endsWith('.md')) return false;
  if (name.endsWith('.')) return false;
  return NAME_RE.test(name);
}

function memoryFileName(name) {
  return `${name}.md`;
}

function assertNoSymlinks(cwd, targetPath) {
  const root = path.join(cwd, '.weave');
  const rel = path.relative(root, targetPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return;

  const check = (p) => {
    try {
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) {
        throw new Error(`refusing to use symlinked path: "${p}"`);
      }
    } catch (e) {
      if (e.code === 'ENOENT') return;
      throw e;
    }
  };

  let current = root;
  check(current);
  const segments = rel === '' ? [] : rel.split(path.sep);
  for (const seg of segments) {
    current = path.join(current, seg);
    check(current);
  }
}

function saveMemory(cwd, name, sourceFile) {
  if (!isValidName(name)) throw new Error(`invalid memory name: "${name}"`);
  const src = sourceFile || path.join(cwd, '.weave', 'state.md');
  assertNoSymlinks(cwd, src);
  if (!fs.existsSync(src)) throw new Error(`source file does not exist: ${src}`);
  const dir = memoriesDir(cwd);
  assertNoSymlinks(cwd, dir);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const dest = path.join(dir, memoryFileName(name));
  assertNoSymlinks(cwd, dest);
  fs.copyFileSync(src, dest);
  return dest;
}

function loadMemory(cwd, name, targetFile) {
  if (!isValidName(name)) throw new Error(`invalid memory name: "${name}"`);
  const src = path.join(memoriesDir(cwd), memoryFileName(name));
  assertNoSymlinks(cwd, src);
  if (!fs.existsSync(src)) throw new Error(`memory does not exist: "${name}"`);
  const dest = targetFile || path.join(cwd, '.weave', 'state.md');
  assertNoSymlinks(cwd, dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
  fs.copyFileSync(src, dest);
  return dest;
}

function listMemories(cwd) {
  const dir = memoriesDir(cwd);
  assertNoSymlinks(cwd, dir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => (entry.isFile() || entry.isSymbolicLink ? !entry.isSymbolicLink() && entry.isFile() : entry.name.endsWith('.md')))
    .map((entry) => {
      const filePath = path.join(dir, entry.name);
      assertNoSymlinks(cwd, filePath);
      const stat = fs.statSync(filePath);
      return { name: path.basename(entry.name, '.md'), size: stat.size, modified: stat.mtime };
    })
    .sort((a, b) => a.modified - b.modified);
}

function showMemory(cwd, name) {
  if (!isValidName(name)) throw new Error(`invalid memory name: "${name}"`);
  const src = path.join(memoriesDir(cwd), memoryFileName(name));
  assertNoSymlinks(cwd, src);
  if (!fs.existsSync(src)) throw new Error(`memory does not exist: "${name}"`);
  return fs.readFileSync(src, 'utf8');
}

function deleteMemory(cwd, name) {
  if (!isValidName(name)) throw new Error(`invalid memory name: "${name}"`);
  const target = path.join(memoriesDir(cwd), memoryFileName(name));
  assertNoSymlinks(cwd, target);
  if (!fs.existsSync(target)) throw new Error(`memory does not exist: "${name}"`);
  fs.unlinkSync(target);
}

module.exports = {
  memoriesDir,
  isValidName,
  memoryFileName,
  saveMemory,
  loadMemory,
  listMemories,
  showMemory,
  deleteMemory,
};
