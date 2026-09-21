'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const promptCore = require('../core/prompt');
const memory = require('../core/memory');

const CLI = path.join(__dirname, '..', 'cli', 'weave.js');
const SERVER = path.join(__dirname, '..', 'mcp', 'server.js');

function tmpCwd() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weave-prompt-test-'));
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

function assertWellFormedXml(xml) {
  const illegalRe = /[^\t\n\r\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u;
  assert.equal(illegalRe.test(xml), false, 'XML contains characters forbidden in XML 1.0');

  const stack = [];
  const tagRe = /<\/?([a-zA-Z_][\w.-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = tagRe.exec(xml))) {
    const [full, name, , selfClose] = m;
    if (full.startsWith('</')) {
      const top = stack.pop();
      assert.equal(top, name, `mismatched closing tag </${name}> in: ${full}`);
    } else if (!selfClose) {
      stack.push(name);
    }
  }
  assert.equal(stack.length, 0, `unclosed tags remain: ${stack.join(', ')}`);
}

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    const responses = [];
    const waiters = [];

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        const w = waiters.shift();
        if (w) w(msg);
        else responses.push(msg);
      }
    });
    child.on('error', reject);

    function send(msg) {
      child.stdin.write(JSON.stringify(msg) + '\n');
    }
    function nextResponse() {
      if (responses.length) return Promise.resolve(responses.shift());
      return new Promise((res) => waiters.push(res));
    }

    Promise.resolve(fn({ send, nextResponse }))
      .then((v) => {
        child.kill();
        resolve(v);
      })
      .catch((e) => {
        child.kill();
        reject(e);
      });
  });
}

test('escapeXml escapes &, <, >, ", and \'', () => {
  assert.equal(promptCore.escapeXml(`<a>&"'`), '&lt;a&gt;&amp;&quot;&apos;');
});

test('escapeXml strips characters forbidden by XML 1.0 (NUL, control chars, unpaired surrogates, non-characters)', () => {
  const bad = 'clean\u0000text\u0008with\u000Bcontrol\uD800surrogate\uFFFEend';
  const escaped = promptCore.escapeXml(bad);
  assert.equal(escaped.includes('\u0000'), false);
  assert.equal(escaped.includes('\u0008'), false);
  assert.equal(escaped.includes('\u000B'), false);
  assert.equal(escaped.includes('\uFFFE'), false);
  // Unpaired surrogate is normalized to valid replacement character (\uFFFD)
  assert.match(escaped, /cleantextwithcontrol\uFFFDsurrogateend/);
});

test('buildSuperPrompt produces well-formed XML with the expected structure', () => {
  const xml = promptCore.buildSuperPrompt({ task: 'fix the bug', mode: 'full', budget: 7, cwd: tmpCwd() });
  assertWellFormedXml(xml);
  assert.match(xml, /<weave_superprompt version="1\.0" mode="full" agent="unspecified" budget="7">/);
  assert.match(xml, /<goal>fix the bug<\/goal>/);
  assert.match(xml, /<reasoning_engine total_budget="7">/);
  assert.match(xml, /<fidelity_gate status="pending">/);
  assert.match(xml, /<question id="6">/);
  assert.match(xml, /<output_format>/);
});

test('buildSuperPrompt escapes unsafe characters embedded in the task', () => {
  const xml = promptCore.buildSuperPrompt({ task: `fix <script>&"'`, cwd: tmpCwd() });
  assertWellFormedXml(xml);
  assert.match(xml, /<goal>fix &lt;script&gt;&amp;&quot;&apos;<\/goal>/);
});

test('buildSuperPrompt cleans NUL and control characters from task into valid XML', () => {
  const xml = promptCore.buildSuperPrompt({ task: 'fix\u0000the\u0007bug\uFFFF', cwd: tmpCwd() });
  assertWellFormedXml(xml);
  assert.match(xml, /<goal>fixthebug<\/goal>/);
});

test('buildSuperPrompt rejects an out-of-range budget', () => {
  assert.throws(() => promptCore.buildSuperPrompt({ task: 'x', budget: 0, cwd: tmpCwd() }), /invalid budget/);
  assert.throws(() => promptCore.buildSuperPrompt({ task: 'x', budget: 51, cwd: tmpCwd() }), /invalid budget/);
  assert.throws(() => promptCore.buildSuperPrompt({ task: 'x', budget: 3.5, cwd: tmpCwd() }), /invalid budget/);
});

test('buildSuperPrompt rejects an invalid mode', () => {
  assert.throws(() => promptCore.buildSuperPrompt({ task: 'x', mode: 'bogus', cwd: tmpCwd() }), /invalid mode/);
});

test('parseStateMarkdown extracts goal, constraints, antiScope, criteria, and the memory pillars', () => {
  const content = [
    '# Weave state',
    '',
    '## Goal',
    'Ship the feature.',
    '',
    '## Constraints',
    'No new dependencies.',
    '',
    '## Not requested',
    'Refactoring unrelated modules.',
    '',
    '## Completion criteria',
    'npm test passes.',
    '',
    '## Working memory',
    '- the handler traces the request flow into the service layer',
    '- business rule: amount must be non-negative',
    '- root cause: defect triggered by a stale cache entry',
    '- schema contract: the users table key maps to id',
    '- verification gap: no test covers the timeout path',
  ].join('\n');

  const parsed = promptCore.parseStateMarkdown(content);
  assert.equal(parsed.goal, 'Ship the feature.');
  assert.equal(parsed.constraints, 'No new dependencies.');
  assert.equal(parsed.antiScope, 'Refactoring unrelated modules.');
  assert.equal(parsed.criteria, 'npm test passes.');
  assert.match(parsed.flow, /traces the request flow/);
  assert.match(parsed.rules, /must be non-negative/);
  assert.match(parsed.rootCause, /root cause/);
  assert.match(parsed.schema, /schema contract/);
  assert.match(parsed.gaps, /verification gap/);
});

test('parseMemoryMarkdown extracts the five pillars from a saved memory snapshot', () => {
  const content = [
    '## Working memory',
    '- execution flow: entry point calls the handler, which calls the service',
    '- rule: constraint requires a valid token',
    '- defect: root cause was an off-by-one error',
    '- integration contract: the field maps to the schema key',
    '- test gap: repro steps are untested',
  ].join('\n');

  const pillars = promptCore.parseMemoryMarkdown(content);
  assert.equal(Object.keys(pillars).sort().join(','), 'flow,gaps,rootCause,rules,schema');
  assert.match(pillars.flow, /entry point calls the handler/);
  assert.match(pillars.rules, /constraint requires/);
  assert.match(pillars.rootCause, /root cause/);
  assert.match(pillars.schema, /schema key/);
  assert.match(pillars.gaps, /untested/);
});

test('buildSuperPrompt with --state ingests .weave/state.md', () => {
  const cwd = tmpCwd();
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.weave', 'state.md'),
    ['## Goal', 'Repair the pipeline.', '', '## Working memory', '- root cause: defect in the retry logic'].join('\n')
  );

  const xml = promptCore.buildSuperPrompt({ state: true, cwd });
  assertWellFormedXml(xml);
  assert.match(xml, /<goal>Repair the pipeline\.<\/goal>/);
  assert.match(xml, /<defect_root_cause>.*root cause: defect in the retry logic.*<\/defect_root_cause>/);
});

test('buildSuperPrompt with --memory ingests a saved memory snapshot', () => {
  const cwd = tmpCwd();
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.weave', 'state.md'),
    ['## Goal', 'placeholder', '', '## Working memory', '- schema contract: the order table key maps to order_id'].join('\n')
  );
  memory.saveMemory(cwd, 'checkpoint');

  const xml = promptCore.buildSuperPrompt({ task: 'continue the migration', memory: 'checkpoint', cwd });
  assertWellFormedXml(xml);
  assert.match(xml, /<goal>continue the migration<\/goal>/);
  assert.match(xml, /<schema_contract>.*order table key maps to order_id.*<\/schema_contract>/);
});

test('CLI: weave prompt "task" exits 0 and prints well-formed XML', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const res = runCli(['prompt', 'my task'], cwd);
  assert.equal(res.status, 0);
  assertWellFormedXml(res.stdout);
  assert.match(res.stdout, /<goal>my task<\/goal>/);
});

test('CLI: weave prompt --budget=5 --raw collapses structural inter-tag whitespace', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const res = runCli(['prompt', '--budget=5', '--raw', 'raw task'], cwd);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /budget="5"/);
  // Structural indentation between tags is gone (text content, e.g. <invariants>,
  // may still legitimately contain its own embedded newlines).
  assert.equal(/>\n\s+</.test(res.stdout), false);
  assert.match(res.stdout, /<goal>raw task<\/goal><constraints>/);
  assertWellFormedXml(res.stdout);
});

test('CLI: weave prompt rejects an invalid --mode', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const res = runCli(['prompt', '--mode=bogus', 'task'], cwd);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /--mode expects/);
});

test('CLI: weave prompt rejects an out-of-range --budget', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const res = runCli(['prompt', '--budget=999', 'task'], cwd);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /invalid budget/);
});

test('CLI: weave prompt rejects unrecognized options with exit code 2', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const res = runCli(['prompt', '--unknown-option', 'task'], cwd);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unrecognized option/);
});

test('CLI: weave prompt rejects non-decimal budget values with exit code 2', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const hexRes = runCli(['prompt', '--budget=0x10', 'task'], cwd);
  assert.equal(hexRes.status, 2);
  assert.match(hexRes.stderr, /expected a decimal integer/);

  const strRes = runCli(['prompt', '--budget=ten', 'task'], cwd);
  assert.equal(strRes.status, 2);
  assert.match(strRes.stderr, /expected a decimal integer/);
});

test('CLI: weave prompt supports "--" option terminator for literal flags in task', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const res = runCli(['prompt', '--state', '--', '--flag-in-task', 'fix bug'], cwd);
  assert.equal(res.status, 0);
  assertWellFormedXml(res.stdout);
  assert.match(res.stdout, /<goal>--flag-in-task fix bug<\/goal>/);
});

test('CLI: weave prompt --help prints usage and exits 0', (t) => {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const res = runCli(['prompt', '--help'], cwd);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Usage: weave prompt/);
});

test('buildSuperPrompt task overrides state goal but preserves state memory pillars', () => {
  const cwd = tmpCwd();
  const weaveDir = path.join(cwd, '.weave');
  fs.mkdirSync(weaveDir, { recursive: true });
  fs.writeFileSync(
    path.join(weaveDir, 'state.md'),
    ['## Goal', 'Original state goal', '## Working memory', '- rule: order total must be positive'].join('\n')
  );

  const xml = promptCore.buildSuperPrompt({ task: 'Overridden task goal', state: true, cwd });
  assertWellFormedXml(xml);
  assert.match(xml, /<goal>Overridden task goal<\/goal>/);
  assert.match(xml, /<business_rules>.*order total must be positive.*<\/business_rules>/);
});

test('mcp server: tools/list exposes prompt', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    const res = await nextResponse();
    const names = res.result.tools.map((t) => t.name);
    assert.ok(names.includes('prompt'));
  });
});

test('mcp server: tools/call prompt executes cleanly and returns well-formed XML', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'prompt', arguments: { task: 'mcp task', budget: 3 } },
    });
    const res = await nextResponse();
    assert.ok(res.result, `expected a result, got error: ${JSON.stringify(res.error)}`);
    const text = res.result.content[0].text;
    assertWellFormedXml(text);
    assert.match(text, /<goal>mcp task<\/goal>/);
    assert.match(text, /total_budget="3"/);
  });
});

test('mcp server: tools/call prompt with an invalid budget returns a JSON-RPC error', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'prompt', arguments: { task: 'x', budget: 999 } },
    });
    const res = await nextResponse();
    assert.ok(res.error);
    assert.match(res.error.message, /invalid budget/);
  });
});

test('mcp server: tools/call prompt rejects invalid types for arguments (string load_state, non-string task)', async () => {
  await withServer(async ({ send, nextResponse }) => {
    // string load_state ("false")
    send({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'prompt', arguments: { load_state: 'false' } },
    });
    const res1 = await nextResponse();
    assert.ok(res1.error);
    assert.match(res1.error.message, /invalid load_state: must be a boolean/);

    // non-string task
    send({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'prompt', arguments: { task: 12345 } },
    });
    const res2 = await nextResponse();
    assert.ok(res2.error);
    assert.match(res2.error.message, /invalid task: must be a string/);

    // non-boolean raw
    send({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'prompt', arguments: { raw: 'true' } },
    });
    const res3 = await nextResponse();
    assert.ok(res3.error);
    assert.match(res3.error.message, /invalid raw: must be a boolean/);

    // explicit arguments: null
    send({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'prompt', arguments: null },
    });
    const res4 = await nextResponse();
    assert.ok(res4.error);
    assert.match(res4.error.message, /invalid tool arguments/);
  });
});
