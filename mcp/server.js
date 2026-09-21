#!/usr/bin/env node
'use strict';

const fs = require('fs');
const readline = require('readline');
const modes = require('../core/mode');
const storage = require('../core/storage');
const discover = require('../core/discover');
const memory = require('../core/memory');
const prompt = require('../core/prompt');
const { version } = require('../package.json');

const SERVER_INFO = { name: 'weave-mcp', version };

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
  {
    name: 'memory_save',
    description: 'Save a memory snapshot into .weave/memories/<name>.md',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        file: { type: 'string' },
        cwd: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'memory_load',
    description: 'Load a memory snapshot from .weave/memories/<name>.md into .weave/state.md',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        cwd: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'memory_list',
    description: 'List saved memories in this project',
    inputSchema: {
      type: 'object',
      properties: { cwd: { type: 'string' } },
    },
  },
  {
    name: 'memory_show',
    description: 'Show content of a saved memory snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        cwd: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'prompt',
    description:
      'Generate a structured Weave SuperPrompt: request contract, 5-pillar operational memory, budgeted reasoning protocol, and the 6-question fidelity gate. Emits clean Markdown text by default, or XML when xml: true.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        mode: { type: 'string', enum: ['off', 'lite', 'full', 'ultra'] },
        budget: { type: 'integer', minimum: 1, maximum: 50 },
        load_state: { type: 'boolean' },
        memory_name: { type: 'string' },
        agent: { type: 'string' },
        raw: { type: 'boolean' },
        xml: { type: 'boolean' },
        cwd: { type: 'string' },
      },
    },
  },
];

function text(str) {
  return { content: [{ type: 'text', text: str }] };
}

function assertValidDir(cwd) {
  let stat;
  try {
    stat = fs.statSync(cwd);
  } catch {
    throw new Error(`invalid directory: ${cwd}`);
  }
  if (!stat.isDirectory()) throw new Error(`invalid directory: ${cwd}`);
}

function toolArgs(args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('invalid tool arguments');
  }
  return args;
}

function toolCwd(args) {
  if (args.cwd === undefined) return process.cwd();
  if (typeof args.cwd !== 'string' || !args.cwd) throw new Error(`invalid directory: ${args.cwd}`);
  assertValidDir(args.cwd);
  return args.cwd;
}

function callTool(name, args = {}) {
  args = toolArgs(args);
  switch (name) {
    case 'get_policy': {
      if (args.mode !== undefined && !modes.MODES.has(args.mode)) {
        throw new Error(`invalid mode: ${args.mode}`);
      }
      const mode = args.mode || 'full';
      return text(modes.instructions(mode));
    }
    case 'gain': {
      const cwd = toolCwd(args);
      const runs = storage.listRuns(cwd);
      if (runs.length === 0) return text('No recorded runs yet in .weave/runs/.');
      const originalBytes = runs.reduce((s, r) => s + (r.originalBytes || 0), 0);
      const presentedBytes = runs.reduce((s, r) => s + Math.min(r.originalBytes || 0, r.presentedBytes || 0), 0);
      const pct = originalBytes > 0 ? (100 * (1 - presentedBytes / originalBytes)).toFixed(1) : '0.0';
      return text(`Commands recorded: ${runs.length}\nRaw bytes: ${originalBytes}\nReport bytes: ${presentedBytes}\nReduction: ${pct}%`);
    }
    case 'discover': {
      const cwd = toolCwd(args);
      const result = discover.scan({ cwd });
      if (!result.found) return text(`No Claude Code session history found at ${result.dir}`);
      const missed = Math.max(0, result.originalBytes - result.presentedBytes);
      return text(`Session files: ${result.files}\nUnwrapped commands: ${result.analyzed}\nEstimated missed savings: ${missed} bytes`);
    }
    case 'memory_save': {
      const cwd = toolCwd(args);
      if (args.file !== undefined && (typeof args.file !== 'string' || !args.file)) {
        throw new Error('invalid source file');
      }
      const dest = memory.saveMemory(cwd, args.name, args.file);
      return text(`Saved memory "${args.name}" -> ${dest}`);
    }
    case 'memory_load': {
      const cwd = toolCwd(args);
      const dest = memory.loadMemory(cwd, args.name);
      return text(`Loaded memory "${args.name}" -> ${dest}`);
    }
    case 'memory_list': {
      const cwd = toolCwd(args);
      const items = memory.listMemories(cwd);
      if (items.length === 0) return text('No memories saved yet. Use memory_save to create one.');
      return text(items.map((item) => `${item.modified.toISOString()}  ${String(item.size).padStart(8)}B  ${item.name}`).join('\n'));
    }
    case 'memory_show': {
      const cwd = toolCwd(args);
      return text(memory.showMemory(cwd, args.name));
    }
    case 'prompt': {
      const cwd = toolCwd(args);
      if (args.task !== undefined && typeof args.task !== 'string') {
        throw new Error('invalid task: must be a string');
      }
      if (args.mode !== undefined && (typeof args.mode !== 'string' || !modes.MODES.has(args.mode))) {
        throw new Error(`invalid mode: ${args.mode}`);
      }
      if (args.budget !== undefined && (typeof args.budget !== 'number' || !Number.isInteger(args.budget) || args.budget < 1 || args.budget > 50)) {
        throw new Error(`invalid budget: ${args.budget} (expected an integer between 1 and 50)`);
      }
      if (args.load_state !== undefined && typeof args.load_state !== 'boolean') {
        throw new Error('invalid load_state: must be a boolean');
      }
      if (args.memory_name !== undefined && typeof args.memory_name !== 'string') {
        throw new Error('invalid memory_name: must be a string');
      }
      if (args.agent !== undefined && typeof args.agent !== 'string') {
        throw new Error('invalid agent: must be a string');
      }
      if (args.raw !== undefined && typeof args.raw !== 'boolean') {
        throw new Error('invalid raw: must be a boolean');
      }
      if (args.xml !== undefined && typeof args.xml !== 'boolean') {
        throw new Error('invalid xml: must be a boolean');
      }
      return text(
        prompt.buildSuperPrompt({
          task: args.task,
          mode: args.mode,
          budget: args.budget,
          state: Boolean(args.load_state),
          memory: args.memory_name,
          agent: args.agent,
          raw: Boolean(args.raw),
          xml: Boolean(args.xml),
          cwd,
        })
      );
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
  if (method === 'notifications/initialized') return;
  if (method === 'ping') return respond(id, {});
  if (method === 'tools/list') return respond(id, { tools: TOOLS });
  if (method === 'tools/call') {
    try {
      const toolArguments = params && Object.prototype.hasOwnProperty.call(params, 'arguments') ? params.arguments : {};
      const result = callTool(params && params.name, toolArguments);
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
