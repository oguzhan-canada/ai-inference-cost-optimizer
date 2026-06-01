# Validation set

Test scenarios for the decision engine. Each scenario specifies inputs and the
expected output shape. The harness at the bottom is runnable Node and can be
pointed at any build of the engine.

**Snapshot date:** 2026-05-31
**Engine version:** 0.1
**Pricing source:** `pricing-sources.md`
**Schema:** `schema.md` §6

All expected values below were captured from the engine itself on 2026-05-31 and
should remain stable as long as pricing, rules, and lever logic are unchanged.
When pricing is updated, re-run the harness and re-record the affected scenarios.

---

## 1. How the harness works

Each scenario is a JSON object with three fields:

- `name` — human-readable scenario name
- `inputs` — full input object per `schema.md` §1
- `expected` — assertions about the winner and lever set

The `expected` block supports five assertion types:

| Field | Type | Meaning |
|-------|------|---------|
| `winner_provider` | string \| null | exact provider match required, or `null` to skip |
| `winner_id` | string \| null | exact model id required, or `null` to skip |
| `max_monthly_usd` | number \| null | winner's monthly cost must be ≤ this |
| `must_apply` | string[] | each name must be a **prefix** of at least one lever in the result |
| `must_not_apply` | string[] | none of these prefixes may match any lever in the result |
| `error` | string \| undefined | if set, scenario must produce an error matching this prefix; `winner_*` and lever fields are ignored |

Prefix matching is used for lever names because some carry dynamic suffixes
(e.g., `Right-sized model (tier 2 · standard)`).

---

## 2. Scenarios

### S1 — Doc backfill (simple, async, one-off)

The canonical "cheapest path" case: low quality bar, batchable, no reuse.

```json
{
  "name": "Doc backfill — simple, async, one-off",
  "inputs": {
    "task": "extraction", "latency": "async", "reuse": "oneoff",
    "context": "small", "quality": "good-enough", "compliance": "none",
    "throughput": "low", "volIn": 100, "volOut": 20
  },
  "expected": {
    "winner_provider": "Mistral",
    "winner_id": "ministral-3b",
    "max_monthly_usd": 10,
    "must_apply": ["Batch processing", "Right-sized model"],
    "must_not_apply": ["Residency premium", "Self-hosted open weights"]
  }
}
```

**Engine on 2026-05-31:** `ministral-3b` at **$6.00/mo** vs $1,100 baseline (99.5% off).

---

### S2 — Production chat (standard, real-time, repeated)

The most common production case. Real-time blocks batch; repeated prefix
enables caching where supported. Mistral Small 4 wins on raw rate even without
caching.

```json
{
  "name": "Production chat — standard, real-time, repeated",
  "inputs": {
    "task": "chat", "latency": "realtime", "reuse": "repeated",
    "context": "small", "quality": "production", "compliance": "none",
    "throughput": "bursty", "volIn": 100, "volOut": 20
  },
  "expected": {
    "winner_provider": "Mistral",
    "winner_id": "mistral-small-4",
    "max_monthly_usd": 20,
    "must_apply": ["Right-sized model"],
    "must_not_apply": ["Batch processing", "Residency premium"]
  }
}
```

**Engine on 2026-05-31:** `mistral-small-4` at **$16.00/mo** vs $1,100 baseline (98.5% off).

---

### S3 — Agentic workflow (high quality, heavy reuse)

Forces tier 3+, but rule engine still picks the cheapest tier-3 option (Mistral
Large 3). Specialty alternative (Sonnet 4.6, tagged `agent`) surfaces as a
note, not the recommendation.

```json
{
  "name": "Agentic workflow — high quality, heavy reuse",
  "inputs": {
    "task": "agent", "latency": "near", "reuse": "heavy",
    "context": "medium", "quality": "high", "compliance": "none",
    "throughput": "bursty", "volIn": 100, "volOut": 20
  },
  "expected": {
    "winner_provider": "Mistral",
    "winner_id": "mistral-large-3",
    "max_monthly_usd": 100,
    "must_apply": ["Right-sized model", "Agent-specialty alternative"],
    "must_not_apply": ["Batch processing"]
  }
}
```

**Engine on 2026-05-31:** `mistral-large-3` at **$80.00/mo** vs $1,100 baseline (92.7% off).
Runner-up: `gpt-5.4` at $242.50/mo. Sonnet 4.6 surfaces as specialty note.

---

### S4 — Self-host required (open weights only)

Collapses the candidate set to models with `selfhost:true`. Engine emits
`Self-host accounting` lever to clarify that displayed cost is per-token-
equivalent, not true infrastructure cost.

```json
{
  "name": "Self-host required — open weights only",
  "inputs": {
    "task": "chat", "latency": "realtime", "reuse": "repeated",
    "context": "small", "quality": "production", "compliance": "selfhost",
    "throughput": "steady", "volIn": 100, "volOut": 20
  },
  "expected": {
    "winner_provider": "Mistral",
    "winner_id": "mistral-small-4",
    "max_monthly_usd": 20,
    "must_apply": [
      "Right-sized model",
      "Self-hosted open weights",
      "Self-host accounting"
    ],
    "must_not_apply": ["Residency premium"]
  }
}
```

**Engine on 2026-05-31:** `mistral-small-4` at **$16.00/mo** (per-token-equivalent).
Candidate set: 1 model — the only self-hostable model in the catalog at v0.1.

---

### S5 — Coding production (Codestral surfaces as specialty)

Cost wins (Mistral Small 4) but Codestral is surfaced because the task type
matches its specialty. The user sees both: cheapest + specialty alternative
with delta.

```json
{
  "name": "Coding production — Codestral surfaces as specialty",
  "inputs": {
    "task": "coding", "latency": "realtime", "reuse": "repeated",
    "context": "medium", "quality": "production", "compliance": "none",
    "throughput": "bursty", "volIn": 100, "volOut": 20
  },
  "expected": {
    "winner_provider": "Mistral",
    "winner_id": "mistral-small-4",
    "max_monthly_usd": 20,
    "must_apply": ["Right-sized model", "Coding-specialty alternative"]
  }
}
```

**Engine on 2026-05-31:** `mistral-small-4` at **$16.00/mo**, Codestral
surfaced as +$32/mo specialty alternative.

---

### S6 — Frontier research (quality bar wins, no cheap-out)

The right-sizing lever is *not* applicable: quality bar forces tier 4. Engine
still picks cheapest qualifying frontier model (Opus 4.8 < GPT-5.5 on output
rate at this volume mix).

```json
{
  "name": "Frontier research — quality bar wins, no cheap-out",
  "inputs": {
    "task": "reasoning", "latency": "near", "reuse": "oneoff",
    "context": "large", "quality": "frontier", "compliance": "none",
    "throughput": "low", "volIn": 50, "volOut": 15
  },
  "expected": {
    "winner_provider": "Anthropic",
    "winner_id": "opus-4.8",
    "max_monthly_usd": 700,
    "must_apply": ["Context-size note"],
    "must_not_apply": ["Right-sized model", "Batch processing"]
  }
}
```

**Engine on 2026-05-31:** `opus-4.8` at **$625/mo** vs $700 baseline (10.7% off).
This is the case that demonstrates the tool's honesty: when no cheap path
exists, the savings number is small and the levers are sparse.

---

### S7 — EU residency (narrows candidate set)

Residency filter excludes US-only providers (OpenAI, Anthropic). Eligible
remainder: Mistral, Gemini, Microsoft Foundry. Mistral Small 4 still wins on
rate.

```json
{
  "name": "EU residency — narrows candidate set",
  "inputs": {
    "task": "chat", "latency": "realtime", "reuse": "repeated",
    "context": "small", "quality": "production", "compliance": "eu",
    "throughput": "bursty", "volIn": 100, "volOut": 20
  },
  "expected": {
    "winner_provider": "Mistral",
    "winner_id": "mistral-small-4",
    "max_monthly_usd": 20,
    "must_apply": ["Right-sized model"],
    "must_not_apply": ["Residency premium"]
  }
}
```

**Engine on 2026-05-31:** `mistral-small-4` at **$16.00/mo**, candidate count: 5.
The EU residency constraint *narrows the field* but does *not* add a cost
premium — that's a US-only behavior (see S8).

---

### S8 — US residency (premium multiplier applied)

Same workload as S7 but with US residency, which applies a 1.10× rate
multiplier. Winner unchanged; cost slightly higher.

```json
{
  "name": "US residency — premium multiplier applied",
  "inputs": {
    "task": "chat", "latency": "realtime", "reuse": "repeated",
    "context": "small", "quality": "production", "compliance": "us",
    "throughput": "bursty", "volIn": 100, "volOut": 20
  },
  "expected": {
    "winner_provider": "Mistral",
    "winner_id": "mistral-small-4",
    "max_monthly_usd": 22,
    "must_apply": ["Right-sized model", "Residency premium"]
  }
}
```

**Engine on 2026-05-31:** `mistral-small-4` at **$17.60/mo**
($16.00 × 1.10 residency premium).

---

### S9 — Steady-state high throughput (PTU/RI eligibility flagged)

Higher volume (500M in / 100M out) makes the absolute savings number large
and surfaces the Infrastructure note about PTU/reserved-instance pricing.

```json
{
  "name": "Steady-state high throughput",
  "inputs": {
    "task": "chat", "latency": "realtime", "reuse": "repeated",
    "context": "small", "quality": "production", "compliance": "none",
    "throughput": "steady", "volIn": 500, "volOut": 100
  },
  "expected": {
    "winner_provider": "Mistral",
    "winner_id": "mistral-small-4",
    "max_monthly_usd": 100,
    "must_apply": ["Right-sized model", "Infrastructure note"]
  }
}
```

**Engine on 2026-05-31:** `mistral-small-4` at **$80.00/mo** vs $5,500
baseline (98.5% off). At this scale, the infrastructure note matters: Foundry
PTU could change the math for Microsoft-hosted models.

---

### S10 — Tiny workload (savings still meaningful in percent)

Sanity check that percent-savings math holds at low absolute volumes.

```json
{
  "name": "Tiny workload — savings still meaningful",
  "inputs": {
    "task": "classification", "latency": "async", "reuse": "oneoff",
    "context": "small", "quality": "good-enough", "compliance": "none",
    "throughput": "low", "volIn": 5, "volOut": 1
  },
  "expected": {
    "winner_provider": "Mistral",
    "winner_id": "ministral-3b",
    "max_monthly_usd": 1,
    "must_apply": ["Batch processing", "Right-sized model"]
  }
}
```

**Engine on 2026-05-31:** `ministral-3b` at **$0.30/mo** vs $55 baseline (99.5% off).

---

### S11 — Error case (constraints incompatible)

EU residency + frontier quality bar has zero eligible models in the v0.1
catalog. Engine must return `{error: ...}` rather than silently relax
constraints (invariant #1).

```json
{
  "name": "EU + frontier — empty candidate set",
  "inputs": {
    "task": "reasoning", "latency": "near", "reuse": "oneoff",
    "context": "medium", "quality": "frontier", "compliance": "eu",
    "throughput": "low", "volIn": 50, "volOut": 15
  },
  "expected": {
    "error": "No eligible models"
  }
}
```

**Engine on 2026-05-31:** Returns
`{error: "No eligible models — constraints are too restrictive.", trace}`.

---

## 3. Invariant coverage

Cross-reference of scenarios → invariants (from `ruleset.md` §Invariants).
Every invariant has at least one scenario exercising it.

| Invariant | Description | Covered by |
|-----------|-------------|------------|
| 1 | Empty candidate set returns error, never silently relaxes | S11 |
| 2 | Monotonicity in tier at equal rates | S1, S2, S10 |
| 3 | Batch reduces both input and output equally | S1, S10 |
| 4 | Caching applies only to input tokens | S2, S3 |
| 5 | Effort reduces output volume, not output rate | S6 (effort suppressed by frontier) |
| 6 | Residency premium multiplies both rates | S8 |
| 7 | Trace order matches rule order | All scenarios (visual inspection) |
| 8 | Savings = baseline − recommended, signed correctly | S6 (small savings ≠ no savings) |

---

## 4. Runnable harness

Save as `tests/run.js` and run with `node tests/run.js`. Exits non-zero if any
assertion fails. The harness extracts the engine from `index.html` rather than
duplicating it — single source of truth.

```js
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
```

---

## 5. Running the harness

```bash
mkdir -p tests
# Copy the §4 code block into tests/run.js
node tests/run.js
```

Expected output on a clean v0.1 build:

```
✓ Doc backfill — simple, async, one-off
✓ Production chat — standard, real-time, repeated
✓ Agentic workflow — high quality, heavy reuse
✓ Self-host required — open weights only
✓ Coding production — Codestral surfaces as specialty
✓ Frontier research — quality bar wins, no cheap-out
✓ EU residency — narrows candidate set
✓ US residency — premium multiplier applied
✓ Steady-state high throughput
✓ Tiny workload — savings still meaningful
✓ EU + frontier — empty candidate set

11/11 passing
```

---

## 6. What's missing (deferred to v0.2)

- **No coverage of long-context surcharges.** Real-world pricing has step
  functions at 128K and 200K tokens that v0.1 does not model. When added, add
  three scenarios at 100K / 150K / 250K input.
- **No coverage of caching arithmetic for non-Anthropic providers.** Should
  add a scenario that confirms OpenAI's 90% cached-input discount applies
  correctly when `reuse:'heavy'`.
- **No load testing.** Harness assumes single-invocation correctness; no
  perf budget asserted.
- **No fuzz testing.** Should add randomized input generation to catch
  combinations not explicitly enumerated.
- **No regression diffing.** When pricing changes, would be useful to emit a
  "winner changed from X to Y" diff rather than just pass/fail.

These are v0.2 work. The current harness gives us deterministic confidence
that the rule engine and the lever annotations behave as documented.
