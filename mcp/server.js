#!/usr/bin/env node
'use strict';

// stdio transport is newline-delimited JSON-RPC, not LSP-style Content-Length framing.
const readline = require('readline');
const modes = require('../core/mode');
const storage = require('../core/storage');
const discover = require('../core/discover');

const SERVER_INFO = { name: 'weave-mcp', version: '1.0.0' };

const TOOLS = [
  {
    name: 'get_policy',
    description: 'Return the Weave engineering policy text for a given mode.',
    inputSchema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: ['off', 'lite', 'full', 'ultra'] } },
    },
  },
  {
    name: 'gain',
    description: "Report this project's recorded Weave terminal-output reduction (from .weave/runs/).",
    inputSchema: { type: 'object', properties: { cwd: { type: 'string' } } },
  },
  {
    name: 'discover',
    description: 'Estimate output reduction missed in past Claude Code sessions for this project, not wrapped by Weave.',
    inputSchema: { type: 'object', properties: { cwd: { type: 'string' } } },
  },
];

function text(str) {
  return { content: [{ type: 'text', text: str }] };
}

function callTool(name, args = {}) {
  const cwd = typeof args.cwd === 'string' && args.cwd ? args.cwd : process.cwd();
  switch (name) {
    case 'get_policy': {
      const mode = modes.MODES.has(args.mode) ? args.mode : 'full';
      return text(modes.instructions(mode));
    }
    case 'gain': {
      const runs = storage.listRuns(cwd);
      if (runs.length === 0) return text('No recorded runs yet in .weave/runs/.');
      const originalBytes = runs.reduce((s, r) => s + (r.originalBytes || 0), 0);
      const presentedBytes = runs.reduce((s, r) => s + Math.min(r.originalBytes || 0, r.presentedBytes || 0), 0);
      const pct = originalBytes > 0 ? (100 * (1 - presentedBytes / originalBytes)).toFixed(1) : '0.0';
      return text(`Commands recorded: ${runs.length}\nRaw bytes: ${originalBytes}\nReport bytes: ${presentedBytes}\nReduction: ${pct}%`);
    }
    case 'discover': {
      const result = discover.scan({ cwd });
      if (!result.found) return text(`No Claude Code session history found at ${result.dir}`);
      const missed = Math.max(0, result.originalBytes - result.presentedBytes);
      return text(`Session files: ${result.files}\nUnwrapped commands: ${result.analyzed}\nEstimated missed savings: ${missed} bytes`);
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function respondError(id, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }) + '\n');
}

function handle(msg) {
  if (msg == null || typeof msg !== 'object') return;
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return respond(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: SERVER_INFO });
  }
  if (method === 'notifications/initialized') return; // no response for notifications
  if (method === 'tools/list') return respond(id, { tools: TOOLS });
  if (method === 'tools/call') {
    try {
      const result = callTool(params && params.name, (params && params.arguments) || {});
      return respond(id, result);
    } catch (e) {
      return respondError(id, e.message);
    }
  }
  if (id !== undefined) respondError(id, `unknown method: ${method}`);
}

function main() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }
    handle(msg);
  });
}

if (require.main === module) main();

module.exports = { TOOLS, callTool, handle };
