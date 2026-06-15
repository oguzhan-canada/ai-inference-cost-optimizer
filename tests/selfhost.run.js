// tests/selfhost.run.js
// Track A — Self-host Economics engine tests (invariant-based; data-value-agnostic).
// Mirrors tests/run.js extraction, additionally exporting HARDWARE, THROUGHPUT, selfHostCost.
const fs = require('fs');
const path = require('path');

// 1. Extract engine from index.html
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('No <script> block found in index.html');
const script = scriptMatch[1];
const engineStart = script.indexOf('const MODELS');
const engineEnd   = script.indexOf('function renderResult');
if (engineStart < 0 || engineEnd < 0) throw new Error('engine markers not found');
const engineSrc = script.slice(engineStart, engineEnd) +
  '\nmodule.exports = { MODELS, BASELINE_ID, decide, HARDWARE, THROUGHPUT, selfHostCost, ownedHourly,' +
  ' SELFHOST_EXTRA: (typeof SELFHOST_EXTRA !== "undefined" ? SELFHOST_EXTRA : undefined) };\n';

const tmpPath = path.join(__dirname, '_selfhost_engine.gen.js');
fs.writeFileSync(tmpPath, engineSrc);

let mod;
try {
  mod = require(tmpPath);
} catch (e) {
  console.log('✗ engine failed to load (selfHostCost/HARDWARE/THROUGHPUT not implemented yet)');
  console.log('    ' + e.message);
  try { fs.unlinkSync(tmpPath); } catch (_) {}
  process.exit(1);
}
const { MODELS, HARDWARE, THROUGHPUT, selfHostCost, ownedHourly } = mod;

// 2. Helpers
let pass = 0, fail = 0;
function ok(name, cond, msg) {
  if (cond) { console.log('✓ ' + name); pass++; }
  else { console.log('✗ ' + name + (msg ? '  → ' + msg : '')); fail++; }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)); }
const M  = id => MODELS.find(m => m.id === id);
const HW = id => (HARDWARE || []).find(h => h.id === id);
const opts = o => Object.assign({ utilCeiling: 0.7, minReplicas: 1, hoursPerMonth: 730, includePrefill: true }, o || {});

// 3. Assertions
// Data presence
ok('HARDWARE has the 4 GPUs (l4, a10g, a100-80gb, h100-80gb)',
   Array.isArray(HARDWARE) && ['l4', 'a10g', 'a100-80gb', 'h100-80gb'].every(id => HW(id)));
ok('THROUGHPUT table is non-empty', Array.isArray(THROUGHPUT) && THROUGHPUT.length > 0);
ok('each HARDWARE entry has on-demand, spot, neocloud prices',
   Array.isArray(HARDWARE) && HARDWARE.every(h =>
     ['on-demand', 'spot', 'neocloud'].every(b => h.prices.some(p => p.basis === b && p.usd_hr > 0))));

// Feasibility: a 24B model on a 24GB card should be flagged infeasible
const infeasible = selfHostCost(M('mistral-small-4'), HW('l4'), 'neocloud', 10, 2, opts());
ok('infeasible (VRAM) pair flagged', infeasible && infeasible.feasible === false);

// Feasibility: a fitting pair computes a positive monthly cost
const feas = selfHostCost(M('phi-4'), HW('a100-80gb'), 'on-demand', 100, 20, opts());
ok('feasible pair computes positive monthly', feas && feas.feasible === true && feas.monthly > 0);

// Min-replicas at tiny volume
const tiny = selfHostCost(M('phi-4-mini'), HW('l4'), 'neocloud', 0.01, 0.002, opts());
const l4neo = HW('l4').prices.find(p => p.basis === 'neocloud').usd_hr;
ok('tiny volume → gpus_needed == minReplicas (1)', tiny.feasible && tiny.gpus_needed === 1);
ok('tiny monthly == 1 × $/hr × 730', tiny.feasible && approx(tiny.monthly, l4neo * 730, 1e-6),
   tiny.feasible ? ('got ' + tiny.monthly) : 'infeasible');

// Monotonicity: $/MTok-out decreases as volume rises (idle floor amortizes)
const lo = selfHostCost(M('phi-4'), HW('a100-80gb'), 'on-demand', 50, 10, opts());
const hi = selfHostCost(M('phi-4'), HW('a100-80gb'), 'on-demand', 500, 100, opts());
ok('per_mtok_out falls as volume rises', hi.per_mtok_out < lo.per_mtok_out,
   `lo=${lo.per_mtok_out} hi=${hi.per_mtok_out}`);

// Floor convergence at very large volume (output-only, so it converges to the pure-output floor)
const huge = selfHostCost(M('phi-4'), HW('a100-80gb'), 'on-demand', 0, 1e7, opts({ includePrefill: false }));
ok('per_mtok_out approaches floor at scale', approx(huge.per_mtok_out, huge.floor_per_mtok_out, 0.02),
   `per=${huge.per_mtok_out} floor=${huge.floor_per_mtok_out}`);

// Spot cheaper than on-demand
const od = selfHostCost(M('phi-4'), HW('a100-80gb'), 'on-demand', 200, 40, opts());
const sp = selfHostCost(M('phi-4'), HW('a100-80gb'), 'spot', 200, 40, opts());
ok('spot monthly < on-demand monthly', sp.monthly < od.monthly, `spot=${sp.monthly} od=${od.monthly}`);

// Break-even present and positive
ok('break-even volume is a positive number',
   typeof feas.breakeven_volout_mtok === 'number' && feas.breakeven_volout_mtok > 0,
   'got ' + feas.breakeven_volout_mtok);

// Break-even semantics: below crossover API cheaper, above crossover self-host cheaper
(function () {
  const model = M('phi-4'), hw = HW('a100-80gb');
  const r = selfHostCost(model, hw, 'spot', 200, 40, opts());
  if (typeof r.breakeven_volout_mtok !== 'number') { ok('break-even crossover ordering', false, 'no breakeven'); return; }
  const be = r.breakeven_volout_mtok;
  const ratio = 200 / 40; // in:out
  const apiOut = model.output, apiIn = model.input;
  const apiMonthly = volOut => apiIn * (volOut * ratio) + apiOut * volOut;
  const shMonthly  = volOut => selfHostCost(model, hw, 'spot', volOut * ratio, volOut, opts()).monthly;
  const below = be * 0.5, above = be * 2;
  ok('below break-even: API cheaper', apiMonthly(below) < shMonthly(below),
     `api=${apiMonthly(below).toFixed(2)} sh=${shMonthly(below).toFixed(2)}`);
  ok('above break-even: self-host cheaper', shMonthly(above) < apiMonthly(above),
     `sh=${shMonthly(above).toFixed(2)} api=${apiMonthly(above).toFixed(2)}`);
})();

// Determinism
const d1 = JSON.stringify(selfHostCost(M('phi-4'), HW('h100-80gb'), 'spot', 123, 45, opts()));
const d2 = JSON.stringify(selfHostCost(M('phi-4'), HW('h100-80gb'), 'spot', 123, 45, opts()));
ok('deterministic (same inputs → same output)', d1 === d2);

// ── Owned / buy basis (Track A.2) ──────────────────────────────
ok('ownedHourly is a function', typeof ownedHourly === 'function');
ok('each HARDWARE entry has buy_usd and tdp_w',
   Array.isArray(HARDWARE) && HARDWARE.every(h => h.buy_usd > 0 && h.tdp_w > 0));

(function () {
  if (typeof ownedHourly !== 'function') { ok('owned engine present', false, 'ownedHourly missing'); return; }
  const hw = HW('h100-80gb');
  const O = { lifeYears: 3, usdPerKwh: 0.12, pue: 1.5, hostingPerMonth: 250 };
  const oh = ownedHourly(hw, O);
  ok('owned $/hr is positive', oh && oh.usd_hr > 0, oh ? ('got ' + oh.usd_hr) : 'null');
  ok('owned $/hr = card + power + hosting (parts sum)',
     oh && approx(oh.card_per_hr + oh.power_per_hr + oh.hosting_per_hr, oh.usd_hr, 1e-9));
  ok('owned card term = price / (life × 8766h)', oh && approx(oh.card_per_hr, hw.buy_usd / (3 * 8766), 1e-9));
  ok('owned power term = (W/1000) × $/kWh × PUE', oh && approx(oh.power_per_hr, (hw.tdp_w / 1000) * 0.12 * 1.5, 1e-9));
  ok('owned includes hosting (zero-hosting drops by hosting/730)',
     approx(ownedHourly(hw, Object.assign({}, O, { hostingPerMonth: 0 })).usd_hr, oh.usd_hr - 250 / 730, 1e-9));
  ok('longer useful life → lower owned $/hr',
     ownedHourly(hw, Object.assign({}, O, { lifeYears: 5 })).usd_hr < ownedHourly(hw, Object.assign({}, O, { lifeYears: 2 })).usd_hr);

  const rO = selfHostCost(M('phi-4'), hw, 'owned', 200, 40, opts({ overrideUsdHr: oh.usd_hr }));
  ok('owned $/hr feeds selfHostCost (override honored)', rO.feasible && approx(rO.usd_hr, oh.usd_hr, 1e-9));
  ok('owned monthly == gpus × owned$/hr × 730 (to the cent)',
     rO.feasible && approx(rO.monthly, Math.round(rO.gpus_needed * oh.usd_hr * 730 * 100) / 100, 1e-9));

  const oLow  = selfHostCost(M('phi-4'), hw, 'owned', 5, 1, opts({ overrideUsdHr: oh.usd_hr }));
  const oHigh = selfHostCost(M('phi-4'), hw, 'owned', 500, 100, opts({ overrideUsdHr: oh.usd_hr }));
  ok('owned per_mtok_out worse at low utilization (idle penalty)',
     oLow.per_mtok_out > oHigh.per_mtok_out, `low=${oLow.per_mtok_out} high=${oHigh.per_mtok_out}`);
})();

// ── Open-weight catalog (Track A.3): Llama / Qwen / Gemma additions ──
// These live in SELFHOST_EXTRA (self-host-only; NOT in the advisor MODELS catalog),
// concatenated into SH_MODELS at render time. Feasibility is by THROUGHPUT-row presence.
const SX = id => ((mod.SELFHOST_EXTRA || []).find(m => m.id === id));
ok('SELFHOST_EXTRA open-weight catalog present (>=5 models)',
   Array.isArray(mod.SELFHOST_EXTRA) && mod.SELFHOST_EXTRA.length >= 5);
['llama-3.1-8b', 'llama-3.3-70b', 'qwen2.5-7b', 'qwen2.5-32b', 'gemma-2-9b'].forEach(id => {
  const m = SX(id);
  ok('catalog entry self-hostable + priced: ' + id,
     !!m && m.selfhost === true && m.input > 0 && m.output > 0,
     m ? ('input=' + m.input + ' output=' + m.output) : 'missing');
});
ok('Llama 3.1 8B feasible on L4 (fits 24GB)',
   selfHostCost(SX('llama-3.1-8b'), HW('l4'), 'spot', 50, 10, opts()).feasible === true);
ok('Gemma 2 9B feasible on L4 (fits 24GB)',
   selfHostCost(SX('gemma-2-9b'), HW('l4'), 'spot', 50, 10, opts()).feasible === true);
ok('Qwen2.5 32B infeasible on L4 (VRAM)',
   selfHostCost(SX('qwen2.5-32b'), HW('l4'), 'spot', 50, 10, opts()).feasible === false);
ok('Llama 3.3 70B infeasible on L4 (VRAM)',
   selfHostCost(SX('llama-3.3-70b'), HW('l4'), 'spot', 50, 10, opts()).feasible === false);
(function () {
  const r = selfHostCost(SX('llama-3.3-70b'), HW('h100-80gb'), 'spot', 500, 100, opts());
  ok('Llama 3.3 70B feasible on H100 with positive monthly', r.feasible === true && r.monthly > 0,
     r.feasible ? ('monthly=' + r.monthly) : r.reason);
})();
(function () {
  const r = selfHostCost(SX('llama-3.1-8b'), HW('h100-80gb'), 'spot', 400, 80, opts({ apiRef: SX('llama-3.1-8b') }));
  ok('Llama 3.1 8B has a positive break-even vs its own API price',
     typeof r.breakeven_volout_mtok === 'number' && r.breakeven_volout_mtok > 0,
     'got ' + r.breakeven_volout_mtok);
})();

// Track A.4 — throughput provenance tags (measured vs est) + multi-GPU (TP) provisioning
ok('every THROUGHPUT row tags a source (measured|est)',
   THROUGHPUT.every(t => t.source === 'measured' || t.source === 'est'));
ok('anchor throughput is tagged measured (mistral-small-4/h100)',
   selfHostCost(M('mistral-small-4'), HW('h100-80gb'), 'spot', 50, 10, opts()).throughput_source === 'measured');
ok('open-weight throughput is tagged est (llama-3.1-8b/h100)',
   selfHostCost(SX('llama-3.1-8b'), HW('h100-80gb'), 'spot', 50, 10, opts()).throughput_source === 'est');
(function () {
  const r = selfHostCost(SX('llama-3.3-70b'), HW('h100-80gb'), 'spot', 1, 0.2, opts({ minReplicas: 1 }));
  ok('Llama 3.3 70B provisions 2 GPUs per replica (TP×2)',
     r.feasible && r.gpus_per_replica === 2 && r.gpus_needed === 2,
     r.feasible ? ('gpr=' + r.gpus_per_replica + ' gpus=' + r.gpus_needed) : r.reason);
  ok('70B tiny monthly reflects 2 cards (gpus × $/hr × 730)',
     r.feasible && approx(r.monthly, 2 * r.usd_hr * 730, 1e-6), r.feasible ? ('got ' + r.monthly) : r.reason);
})();
ok('single-card model still 1 GPU at tiny volume (gpr default = 1)',
   selfHostCost(SX('llama-3.1-8b'), HW('h100-80gb'), 'spot', 0.001, 0.0002, opts({ minReplicas: 1 })).gpus_needed === 1);

// 4. Report
console.log(`\n${pass}/${pass + fail} passing`);
fs.unlinkSync(tmpPath);
process.exit(fail === 0 ? 0 : 1);
