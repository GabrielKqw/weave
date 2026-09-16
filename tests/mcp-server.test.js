'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
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
        responses.push(msg);
        const w = waiters.shift();
        if (w) w(msg);
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

test('mcp server: tools/list exposes get_policy, gain, discover', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const res = await nextResponse();
    const names = res.result.tools.map((t) => t.name);
    assert.deepEqual(names.sort(), ['discover', 'gain', 'get_policy']);
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
