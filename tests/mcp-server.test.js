'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { version } = require('../package.json');

const SERVER = path.join(__dirname, '..', 'mcp', 'server.js');

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

test('mcp server: initialize returns server info and tool capability', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    const res = await nextResponse();
    assert.equal(res.id, 1);
    assert.equal(res.result.serverInfo.name, 'weave-mcp');
    assert.equal(res.result.serverInfo.version, version);
    assert.ok(res.result.capabilities.tools);
  });
});

test('mcp server: tools/list exposes get_policy, gain, discover, and memory tools', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const res = await nextResponse();
    const names = res.result.tools.map((t) => t.name);
    assert.deepEqual(
      names.sort(),
      ['discover', 'gain', 'get_policy', 'memory_list', 'memory_load', 'memory_save', 'memory_show', 'prompt']
    );
  });
});

test('mcp server: ping returns an empty result', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 99, method: 'ping', params: {} });
    const res = await nextResponse();
    assert.equal(res.id, 99);
    assert.deepEqual(res.result, {});
  });
});

test('mcp server: tools/call get_policy(full) returns the same text as core/mode.js', async () => {
  const modes = require('../core/mode');
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_policy', arguments: { mode: 'full' } } });
    const res = await nextResponse();
    assert.equal(res.result.content[0].text, modes.instructions('full'));
  });
});

test('mcp server: tools/call with unknown tool returns a JSON-RPC error, not a crash', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope', arguments: {} } });
    const res = await nextResponse();
    assert.ok(res.error);
  });
});

test('mcp server: tools/call get_policy with an invalid mode returns a JSON-RPC error', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_policy', arguments: { mode: 'bogus' } } });
    const res = await nextResponse();
    assert.ok(res.error);
    assert.match(res.error.message, /invalid mode: bogus/);
  });
});

test('mcp server: tools/call rejects malformed arguments and supplied invalid cwd values', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 51, method: 'tools/call', params: { name: 'get_policy', arguments: [] } });
    const malformed = await nextResponse();
    assert.match(malformed.error.message, /invalid tool arguments/);

    send({ jsonrpc: '2.0', id: 52, method: 'tools/call', params: { name: 'memory_list', arguments: { cwd: '' } } });
    const invalidCwd = await nextResponse();
    assert.match(invalidCwd.error.message, /invalid directory/);
  });
});

test('mcp server: memory_save, memory_list, memory_show, memory_load round-trip', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-mcp-memory-'));
  const stateFile = path.join(cwd, '.weave', 'state.md');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, 'hello from state\n');

  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'memory_save', arguments: { name: 'snap1', cwd } } });
    const saveRes = await nextResponse();
    assert.ok(!saveRes.error, saveRes.error && saveRes.error.message);
    assert.match(saveRes.result.content[0].text, /Saved memory "snap1"/);

    send({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'memory_list', arguments: { cwd } } });
    const listRes = await nextResponse();
    assert.match(listRes.result.content[0].text, /snap1/);

    send({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'memory_show', arguments: { name: 'snap1', cwd } } });
    const showRes = await nextResponse();
    assert.equal(showRes.result.content[0].text, 'hello from state\n');

    fs.writeFileSync(stateFile, 'overwritten\n');
    send({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'memory_load', arguments: { name: 'snap1', cwd } } });
    const loadRes = await nextResponse();
    assert.match(loadRes.result.content[0].text, /Loaded memory "snap1"/);
    assert.equal(fs.readFileSync(stateFile, 'utf8'), 'hello from state\n');
  });

  fs.rmSync(cwd, { recursive: true, force: true });
});
