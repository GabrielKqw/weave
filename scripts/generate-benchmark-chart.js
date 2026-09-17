#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { run } = require('./benchmark');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'docs', 'benchmark.svg');

const WIDTH = 660;
const ROW_H = 44;
const BAR_H = 20;
const LABEL_W = 270;
const TRACK_W = 320;
const RADIUS = 4;
const TOP_PAD = 28;
const BOTTOM_PAD = 20;

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function barPath(x0, y, w, h, r) {
  if (w <= 0) return '';
  const x1 = x0 + w;
  const rr = Math.min(r, w, h / 2);
  return [
    `M ${x0} ${y}`,
    `L ${x1 - rr} ${y}`,
    `A ${rr} ${rr} 0 0 1 ${x1} ${y + rr}`,
    `L ${x1} ${y + h - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x1 - rr} ${y + h}`,
    `L ${x0} ${y + h}`,
    'Z',
  ].join(' ');
}

function render(rows) {
  const height = TOP_PAD + rows.length * ROW_H + BOTTOM_PAD;
  const baseline = LABEL_W;
  const parts = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img" aria-labelledby="title desc">`
  );
  parts.push(`<title id="title">Weave benchmark: output reduction per scenario</title>`);
  parts.push(
    `<desc id="desc">${rows.map((r) => `${escapeXml(r.label)}: ${r.pct.toFixed(1)}% reduction`).join('. ')}.</desc>`
  );
  parts.push(`<style>
    text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .label { fill: #52514e; font-size: 13px; }
    .value { fill: #0b0b0b; font-size: 13px; font-weight: 600; }
    .bar { fill: #2a78d6; }
    .baseline { stroke: #c3c2b7; stroke-width: 1; }
    @media (prefers-color-scheme: dark) {
      .label { fill: #c3c2b7; }
      .value { fill: #ffffff; }
      .bar { fill: #3987e5; }
      .baseline { stroke: #383835; }
    }
  </style>`);
  parts.push(`<line class="baseline" x1="${baseline}" y1="${TOP_PAD - 4}" x2="${baseline}" y2="${TOP_PAD + rows.length * ROW_H}" />`);

  rows.forEach((r, i) => {
    const rowTop = TOP_PAD + i * ROW_H;
    const rowCenter = rowTop + ROW_H / 2;
    const barY = rowCenter - BAR_H / 2;
    const textY = rowCenter + 4;
    const w = Math.round((Math.max(0, r.pct) / 100) * TRACK_W);
    parts.push(`<text class="label" x="${baseline - 10}" y="${textY}" text-anchor="end">${escapeXml(r.label)}</text>`);
    if (w > 0) {
      parts.push(`<path class="bar" d="${barPath(baseline, barY, w, BAR_H, RADIUS)}" />`);
      parts.push(`<text class="value" x="${baseline + w + 8}" y="${textY}">${r.pct.toFixed(1)}%</text>`);
    } else {
      parts.push(`<text class="value" x="${baseline + 8}" y="${textY}">${r.pct.toFixed(1)}%</text>`);
    }
  });

  parts.push('</svg>\n');
  return parts.join('\n');
}

const content = render(run());
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : null;
  if (current !== content) {
    console.error('stale: docs/benchmark.svg (run node scripts/generate-benchmark-chart.js)');
    process.exitCode = 1;
  }
} else {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, content);
  console.log('wrote docs/benchmark.svg');
}
