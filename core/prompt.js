'use strict';

const fs = require('fs');
const path = require('path');
const modes = require('./mode');
const memory = require('./memory');

function stripInvalidXmlChars(str) {
  const wellFormed = typeof str.toWellFormed === 'function' ? str.toWellFormed() : str;
  return wellFormed.replace(/[^\t\n\r\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '');
}

function escapeXml(str) {
  return stripInvalidXmlChars(String(str))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseSections(content) {
  const sections = {};
  const lines = String(content || '').split(/\r?\n/);
  let current = null;
  let buf = [];
  const flush = () => {
    if (current !== null) sections[current] = buf.join('\n').trim();
  };
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      current = m[1].trim().toLowerCase();
      buf = [];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

// Working memory in .weave/state.md is freeform prose, not pillar-labeled.
// Classify each non-empty line into the nearest of the five Operational
// Memory Pillars (see skills/weave/SKILL.md section 3) by keyword match.
const PILLAR_PATTERNS = [
  ['flow', /\b(flow|trace|call path|entry point|handler)\b|->|→/i],
  ['rules', /\b(rule|invariant|must|constraint|valid\w*)\b/i],
  ['rootCause', /\b(root cause|defect|bug|error code|failure mode|fails? because)\b/i],
  ['schema', /\b(schema|contract|integration|field|mapping|key)\b/i],
  ['gaps', /\b(test|verif\w*|untested|gap|todo|repro)\b/i],
];

function extractPillars(text) {
  const buckets = { flow: [], rules: [], rootCause: [], schema: [], gaps: [] };
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    for (const [pillar, re] of PILLAR_PATTERNS) {
      if (re.test(line)) {
        buckets[pillar].push(line);
        break;
      }
    }
  }
  return {
    flow: buckets.flow.join('\n'),
    rules: buckets.rules.join('\n'),
    rootCause: buckets.rootCause.join('\n'),
    schema: buckets.schema.join('\n'),
    gaps: buckets.gaps.join('\n'),
  };
}

function parseStateMarkdown(content) {
  const sections = parseSections(content);
  const pillars = extractPillars(sections['working memory'] || '');
  return {
    goal: sections['goal'] || '',
    constraints: sections['constraints'] || '',
    antiScope: sections['not requested'] || '',
    criteria: sections['completion criteria'] || '',
    ...pillars,
  };
}

function parseMemoryMarkdown(content) {
  const sections = parseSections(content);
  return extractPillars(sections['working memory'] || content);
}

const FIDELITY_QUESTIONS = [
  'Did I deliver what was actually asked?',
  "Did I change anything that wasn't required?",
  'Does the change address the cause, not just a symptom?',
  'Is there an equally correct, smaller change I passed over?',
  "Am I calling activity - files opened, commands run, lines written - a result, when the Completion criteria aren't actually met?",
  "Does every claim I'm about to make have real evidence behind it (a command's actual output, a test that actually ran) rather than an assumption that it would work?",
];

function buildSuperPrompt(options = {}) {
  const cwd = options.cwd || process.cwd();
  const mode = options.mode || modes.readMode(cwd);
  if (!modes.MODES.has(mode)) throw new Error(`invalid mode: ${mode}`);

  const budget = options.budget === undefined ? 10 : options.budget;
  if (!Number.isInteger(budget) || budget < 1 || budget > 50) {
    throw new Error(`invalid budget: ${options.budget} (expected an integer between 1 and 50)`);
  }

  const agent = options.agent || 'unspecified';
  const task = options.task || '';

  let contract = {
    goal: '', constraints: '', antiScope: '', criteria: '',
    flow: '', rules: '', rootCause: '', schema: '', gaps: '',
  };

  if (options.state) {
    const statePath = path.join(cwd, '.weave', 'state.md');
    if (fs.existsSync(statePath)) {
      Object.assign(contract, parseStateMarkdown(fs.readFileSync(statePath, 'utf8')));
    }
  }

  if (options.memory) {
    Object.assign(contract, parseMemoryMarkdown(memory.showMemory(cwd, options.memory)));
  }

  const goal = task || contract.goal || 'Not specified - derive from the task below.';
  const stepInstructions =
    `Work in discrete steps; each step spends one unit from total_budget="${budget}". State a hypothesis before ` +
    'acting, record real evidence after, and reflect on whether the evidence matched. Score progress with a reward ' +
    'from 0.0 (no progress) to 1.0 (goal fully advanced). When reward is low or evidence contradicts the hypothesis, ' +
    'emit a backtrack and revise the plan instead of continuing down a failing path. Stop before exceeding the ' +
    'budget - if the goal is not reached in time, report the remaining gap honestly instead of fabricating completion.';

  const lines = [
    `<weave_superprompt version="1.0" mode="${escapeXml(mode)}" agent="${escapeXml(agent)}" budget="${budget}">`,
    '  <request_contract>',
    `    <goal>${escapeXml(goal)}</goal>`,
    `    <constraints>${escapeXml(contract.constraints || 'None recorded.')}</constraints>`,
    `    <invariants>${escapeXml(modes.instructions(mode))}</invariants>`,
    `    <anti_scope>${escapeXml(contract.antiScope || 'None recorded.')}</anti_scope>`,
    `    <completion_criteria>${escapeXml(contract.criteria || "Not specified - define a concrete, verifiable check before finishing.")}</completion_criteria>`,
    '  </request_contract>',
    '  <operational_memory>',
    `    <execution_flow>${escapeXml(contract.flow || 'Not yet traced.')}</execution_flow>`,
    `    <business_rules>${escapeXml(contract.rules || 'None recorded.')}</business_rules>`,
    `    <defect_root_cause>${escapeXml(contract.rootCause || 'None recorded.')}</defect_root_cause>`,
    `    <schema_contract>${escapeXml(contract.schema || 'None recorded.')}</schema_contract>`,
    `    <verification_gaps>${escapeXml(contract.gaps || 'None recorded.')}</verification_gaps>`,
    '  </operational_memory>',
    `  <reasoning_engine total_budget="${budget}">`,
    `    <instructions>${escapeXml(stepInstructions)}</instructions>`,
    '    <step_schema>',
    '      <step>',
    `        <budget remaining="N" total="${budget}"/>`,
    '        <action>what you are about to do, and why it is the next needed step</action>',
    '        <hypothesis>what you expect to find or happen</hypothesis>',
    '        <evidence>the actual command output, file content, or test result observed</evidence>',
    '        <reflection>whether evidence matched the hypothesis, and what it changes about the plan</reflection>',
    '        <reward score="0.0-1.0"/>',
    '        <backtrack>present only when reward is low or evidence invalidates the hypothesis: what is undone and the revised approach</backtrack>',
    '      </step>',
    '    </step_schema>',
    '  </reasoning_engine>',
    '  <fidelity_gate status="pending">',
    ...FIDELITY_QUESTIONS.map((q, i) => `    <question id="${i + 1}">${escapeXml(q)}</question>`),
    '  </fidelity_gate>',
    '  <output_format>',
    `    <diff>${escapeXml('Unified diff or precise file-by-file summary of the exact changes made - no unrelated reformatting.')}</diff>`,
    `    <verification_command>${escapeXml('The exact command(s) run to prove the change works, with their real output.')}</verification_command>`,
    `    <evidence>${escapeXml('Concrete proof for each completion criterion - actual test output, command result, or manual repro steps performed.')}</evidence>`,
    `    <state_update>${escapeXml('If .weave/state.md exists for this task, the Working memory, Verification, and Fidelity check sections to write back.')}</state_update>`,
    '  </output_format>',
    '</weave_superprompt>',
  ];

  const xml = lines.join('\n');
  return options.raw ? xml.replace(/>\s+</g, '><').trim() : xml;
}

module.exports = { escapeXml, parseStateMarkdown, parseMemoryMarkdown, buildSuperPrompt };
