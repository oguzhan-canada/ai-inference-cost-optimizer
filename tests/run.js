// tests/run.js
const fs = require('fs');
const path = require('path');

// 1. Extract engine from index.html into a module
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('No <script> block found in index.html');

const script = scriptMatch[1];
const engineStart = script.indexOf('const MODELS');
const engineEnd   = script.indexOf('function renderResult');
const engineSrc = script.slice(engineStart, engineEnd) +
  '\nmodule.exports = { MODELS, BASELINE_ID, decide };\n';

const tmpPath = path.join(__dirname, '_engine.gen.js');
fs.writeFileSync(tmpPath, engineSrc);
const { decide } = require(tmpPath);

// 2. Scenarios — paste from §2 above
const scenarios = [
  // S1
  { name: 'Doc backfill — simple, async, one-off',
    inputs: { task:'extraction', latency:'async', reuse:'oneoff', context:'small',
              quality:'good-enough', compliance:'none', throughput:'low',
              volIn:100, volOut:20 },
    expected: { winner_provider:'Mistral', winner_id:'ministral-3b',
                max_monthly_usd:10,
                must_apply:['Batch processing','Right-sized model'],
                must_not_apply:['Residency premium','Self-hosted open weights'] } },

  // S2
  { name: 'Production chat — standard, real-time, repeated',
    inputs: { task:'chat', latency:'realtime', reuse:'repeated', context:'small',
              quality:'production', compliance:'none', throughput:'bursty',
              volIn:100, volOut:20 },
    expected: { winner_provider:'Mistral', winner_id:'mistral-small-4',
                max_monthly_usd:20,
                must_apply:['Right-sized model'],
                must_not_apply:['Batch processing','Residency premium'] } },

  // S3
  { name: 'Agentic workflow — high quality, heavy reuse',
    inputs: { task:'agent', latency:'near', reuse:'heavy', context:'medium',
              quality:'high', compliance:'none', throughput:'bursty',
              volIn:100, volOut:20 },
    expected: { winner_provider:'Mistral', winner_id:'mistral-large-3',
                max_monthly_usd:100,
                must_apply:['Right-sized model','Agent-specialty alternative'],
                must_not_apply:['Batch processing'] } },

  // S4
  { name: 'Self-host required — open weights only',
    inputs: { task:'chat', latency:'realtime', reuse:'repeated', context:'small',
              quality:'production', compliance:'selfhost', throughput:'steady',
              volIn:100, volOut:20 },
    expected: { winner_provider:'Mistral', winner_id:'mistral-small-4',
                max_monthly_usd:20,
                must_apply:['Right-sized model','Self-hosted open weights',
                            'Self-host accounting'],
                must_not_apply:['Residency premium'] } },

  // S5
  { name: 'Coding production — Codestral surfaces as specialty',
    inputs: { task:'coding', latency:'realtime', reuse:'repeated', context:'medium',
              quality:'production', compliance:'none', throughput:'bursty',
              volIn:100, volOut:20 },
    expected: { winner_provider:'Mistral', winner_id:'mistral-small-4',
                max_monthly_usd:20,
                must_apply:['Right-sized model','Coding-specialty alternative'] } },

  // S6
  { name: 'Frontier research — quality bar wins, no cheap-out',
    inputs: { task:'reasoning', latency:'near', reuse:'oneoff', context:'large',
              quality:'frontier', compliance:'none', throughput:'low',
              volIn:50, volOut:15 },
    expected: { winner_provider:'Anthropic', winner_id:'opus-4.8',
                max_monthly_usd:700,
                must_apply:['Context-size note'],
                must_not_apply:['Right-sized model','Batch processing'] } },

  // S7
  { name: 'EU residency — narrows candidate set',
    inputs: { task:'chat', latency:'realtime', reuse:'repeated', context:'small',
              quality:'production', compliance:'eu', throughput:'bursty',
              volIn:100, volOut:20 },
    expected: { winner_provider:'Mistral', winner_id:'mistral-small-4',
                max_monthly_usd:20,
                must_apply:['Right-sized model'],
                must_not_apply:['Residency premium'] } },

  // S8
  { name: 'US residency — premium multiplier applied',
    inputs: { task:'chat', latency:'realtime', reuse:'repeated', context:'small',
              quality:'production', compliance:'us', throughput:'bursty',
              volIn:100, volOut:20 },
    expected: { winner_provider:'Mistral', winner_id:'mistral-small-4',
                max_monthly_usd:22,
                must_apply:['Right-sized model','Residency premium'] } },

  // S9
  { name: 'Steady-state high throughput',
    inputs: { task:'chat', latency:'realtime', reuse:'repeated', context:'small',
              quality:'production', compliance:'none', throughput:'steady',
              volIn:500, volOut:100 },
    expected: { winner_provider:'Mistral', winner_id:'mistral-small-4',
                max_monthly_usd:100,
                must_apply:['Right-sized model','Infrastructure note'] } },

  // S10
  { name: 'Tiny workload — savings still meaningful',
    inputs: { task:'classification', latency:'async', reuse:'oneoff', context:'small',
              quality:'good-enough', compliance:'none', throughput:'low',
              volIn:5, volOut:1 },
    expected: { winner_provider:'Mistral', winner_id:'ministral-3b',
                max_monthly_usd:1,
                must_apply:['Batch processing','Right-sized model'] } },

  // S11 — error case
  { name: 'EU + frontier — empty candidate set',
    inputs: { task:'reasoning', latency:'near', reuse:'oneoff', context:'medium',
              quality:'frontier', compliance:'eu', throughput:'low',
              volIn:50, volOut:15 },
    expected: { error: 'No eligible models' } },
];

// 3. Assertion runner
function leverPrefixMatches(prefix, leverNames) {
  return leverNames.some(n => n.startsWith(prefix));
}

function check(scenario) {
  const failures = [];
  const r = decide(scenario.inputs);
  const exp = scenario.expected;

  // Error case
  if (exp.error) {
    if (!r.error) failures.push(`expected error, got winner ${r.winner?.model.id}`);
    else if (!r.error.startsWith(exp.error)) {
      failures.push(`error mismatch: got "${r.error}"`);
    }
    return failures;
  }

  if (r.error) { failures.push(`unexpected engine error: ${r.error}`); return failures; }
  if (!r.winner) { failures.push('no winner returned'); return failures; }

  if (exp.winner_provider && r.winner.model.provider !== exp.winner_provider) {
    failures.push(`provider: expected ${exp.winner_provider}, got ${r.winner.model.provider}`);
  }
  if (exp.winner_id && r.winner.model.id !== exp.winner_id) {
    failures.push(`id: expected ${exp.winner_id}, got ${r.winner.model.id}`);
  }
  if (typeof exp.max_monthly_usd === 'number' && r.winner.monthlyCost > exp.max_monthly_usd) {
    failures.push(`cost: $${r.winner.monthlyCost.toFixed(2)} > ceiling $${exp.max_monthly_usd}`);
  }

  const leverNames = r.levers.map(l => l.name);
  for (const req of (exp.must_apply || [])) {
    if (!leverPrefixMatches(req, leverNames)) {
      failures.push(`lever "${req}" expected but not applied. Got: [${leverNames.join(', ')}]`);
    }
  }
  for (const forbid of (exp.must_not_apply || [])) {
    if (leverPrefixMatches(forbid, leverNames)) {
      failures.push(`lever "${forbid}" was applied but must not be. Got: [${leverNames.join(', ')}]`);
    }
  }
  return failures;
}

// 4. Run
let pass = 0, fail = 0;
for (const s of scenarios) {
  const failures = check(s);
  if (failures.length === 0) {
    console.log(`✓ ${s.name}`);
    pass++;
  } else {
    console.log(`✗ ${s.name}`);
    for (const f of failures) console.log(`    ${f}`);
    fail++;
  }
}
console.log(`\n${pass}/${pass + fail} passing`);

fs.unlinkSync(tmpPath);
process.exit(fail === 0 ? 0 : 1);

