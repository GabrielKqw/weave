#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const mode = require('../core/mode');

const ROOT = path.join(__dirname, '..');
const BODY = mode.instructions('full');
const HEADER = '# Weave policy (full mode)\n\n';
const FOOTER = '\nSwitch modes via Claude Code/Codex hooks (`/weave off|lite|full|ultra`), Weave CLI (`node cli/weave.js mode <mode>`), or Weave MCP tools. This static file reflects `full`.\n';

const GEMINI_EXTRAS = `\n## Gemini Output & Execution Discipline
- Direct & Concise: Omit conversational filler, repeating user prompts, or speculative preamble. Focus directly on the engineering action and verified evidence.
- Scoped Reads: When using \`view_file\`, specify targeted \`StartLine\` and \`EndLine\` ranges (50–100 lines at a time) rather than viewing whole files.
- Scoped Execution: Keep shell commands focused (e.g. \`git log -n 5\`, \`git status -s\`). Commands are wrapped via Weave to reduce terminal noise.
- Minimal Edits: Use \`replace_file_content\` for precise surgical edits rather than overwriting whole files.
- Weave Integration: Leverage Weave MCP tools (\`get_policy\`, \`gain\`, \`prompt\`, \`memory_save\`, \`memory_load\`) and keep \`.weave/state.md\` updated for non-trivial tasks.
`;

const TARGETS = [
  { file: 'AGENTS.md', content: HEADER + BODY + '\n' + FOOTER },
  { file: 'GEMINI.md', content: HEADER + BODY + '\n' + GEMINI_EXTRAS + FOOTER },
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
