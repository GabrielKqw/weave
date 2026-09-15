#!/usr/bin/env node
'use strict';

// core/mode.js is the single source of truth so wording can't drift between agents.
const fs = require('fs');
const path = require('path');
const mode = require('../core/mode');

const ROOT = path.join(__dirname, '..');
const BODY = mode.instructions('full');
const HEADER = '# Weave policy (full mode)\n\n';
const FOOTER = '\nSwitch modes only from Claude Code/Codex, where Weave is wired via hooks (`/weave off|lite|full|ultra`). This static file always reflects `full`.\n';

const TARGETS = [
  { file: 'AGENTS.md', content: HEADER + BODY + '\n' + FOOTER },
  { file: '.clinerules/weave.md', content: HEADER + BODY + '\n' + FOOTER },
  { file: '.windsurf/rules/weave.md', content: HEADER + BODY + '\n' + FOOTER },
  {
    file: '.cursor/rules/weave.mdc',
    content:
      '---\ndescription: Weave engineering policy, level: full\nglobs:\nalwaysApply: true\n---\n\n' + HEADER + BODY + '\n' + FOOTER,
  },
];

const checkOnly = process.argv.includes('--check');
let drifted = false;

for (const { file, content } of TARGETS) {
  const full = path.join(ROOT, file);
  if (checkOnly) {
    const current = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
    if (current !== content) {
      drifted = true;
      console.error(`stale: ${file} (run node scripts/generate-agent-rules.js)`);
    }
    continue;
  }
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log(`wrote ${file}`);
}

if (checkOnly && drifted) process.exitCode = 1;
