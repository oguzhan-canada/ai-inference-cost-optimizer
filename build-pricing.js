#!/usr/bin/env node
/*
 * build-pricing.js — regenerate pricing.json from index.html (the single source of truth).
 *
 * The app's MODELS / SELFHOST_EXTRA / HARDWARE / THROUGHPUT arrays are the only place
 * prices live; this script extracts them verbatim so the machine-readable pricing.json
 * can never silently drift from what the UI computes. Run after any pricing edit:
 *
 *     node build-pricing.js
 *
 * No dependencies. Output is LF-normalized, 2-space-indented JSON.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Extract the engine slice exactly as the test harness does (const MODELS … function renderResult).
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('No <script> block found in index.html');
const script = scriptMatch[1];
const a = script.indexOf('const MODELS');
const b = script.indexOf('function renderResult');
if (a < 0 || b < 0) throw new Error('engine markers not found');
const engineSrc = script.slice(a, b) +
  '\nmodule.exports = { MODELS, HARDWARE, THROUGHPUT,' +
  ' SELFHOST_EXTRA: (typeof SELFHOST_EXTRA !== "undefined" ? SELFHOST_EXTRA : []),' +
  ' SELFHOST_SNAPSHOT_DATE: (typeof SELFHOST_SNAPSHOT_DATE !== "undefined" ? SELFHOST_SNAPSHOT_DATE : null) };\n';

const tmp = path.join(ROOT, '_pricing_engine.gen.js');
fs.writeFileSync(tmp, engineSrc);
let mod;
try { mod = require(tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
const { MODELS, HARDWARE, THROUGHPUT, SELFHOST_EXTRA, SELFHOST_SNAPSHOT_DATE } = mod;

// Advisor API-pricing snapshot date is a literal in the export builder.
const apiDateMatch = html.match(/pricing_snapshot_date:\s*'([^']+)'/);
const apiSnapshot = apiDateMatch ? apiDateMatch[1] : null;

const out = {
  _comment: 'Machine-readable pricing snapshot for the AI Inference Cost Optimizer. ' +
            'Generated from index.html by build-pricing.js — DO NOT edit by hand; edit index.html and re-run.',
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  currency: 'USD',
  token_unit: 'per_1M_tokens',
  snapshots: {
    api_pricing: apiSnapshot,
    self_host_hardware: SELFHOST_SNAPSHOT_DATE
  },
  sources: {
    api_pricing: 'pricing-sources.md',
    self_host: 'hardware-sources.md',
    live_demo: 'https://oguzhan-canada.github.io/ai-inference-cost-optimizer/',
    repository: 'https://github.com/oguzhan-canada/ai-inference-cost-optimizer'
  },
  disclaimer: 'Illustrative snapshot for directional FinOps guidance only. ' +
              'Verify against current provider documentation before committing to a path. No warranty.',
  counts: {
    models: MODELS.length,
    self_host_extra: (SELFHOST_EXTRA || []).length,
    hardware: (HARDWARE || []).length,
    throughput: (THROUGHPUT || []).length
  },
  models: MODELS,
  self_host_extra: SELFHOST_EXTRA || [],
  hardware: HARDWARE || [],
  throughput: THROUGHPUT || [],
  refresh_checklist: [
    'Edit the MODELS / SELFHOST_EXTRA / HARDWARE / THROUGHPUT arrays in index.html (single source of truth).',
    'Update the matching row + date in pricing-sources.md (API) or hardware-sources.md (GPU/throughput).',
    'Bump SELFHOST_SNAPSHOT_DATE / pricing_snapshot_date in index.html if the snapshot moved.',
    'Re-run: node tests/run.js && node tests/selfhost.run.js (must stay green).',
    'Re-run: node build-pricing.js to regenerate this file, then commit both together.'
  ]
};

const json = JSON.stringify(out, null, 2).replace(/\r\n/g, '\n') + '\n';
fs.writeFileSync(path.join(ROOT, 'pricing.json'), json, 'utf8');
console.log('pricing.json written — ' + out.counts.models + ' models, ' +
  out.counts.self_host_extra + ' self-host-extra, ' + out.counts.hardware + ' GPUs, ' +
  out.counts.throughput + ' throughput rows (api ' + apiSnapshot + ', hw ' + SELFHOST_SNAPSHOT_DATE + ').');
