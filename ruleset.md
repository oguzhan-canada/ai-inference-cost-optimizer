# Ruleset — Decision Tree Specification

**Engine version:** 0.1
**Implementation:** `index.html` → `decide(inputs)` function
**Determinism:** Total. Same inputs → same outputs. Same trace.
**Philosophy:** Cheapest viable, with the viability check enforced by tier filters and compliance gates, not by judgment.

The brief specified six ordered rules. This document expands each into precise filter and scoring semantics.

---

## Rule 1 — Async or real-time?

**Input:** `latency` ∈ {`realtime`, `near`, `async`}.

| Value | Effect |
|---|---|
| `realtime` | No batch eligibility. Standard per-token rates apply. |
| `near` | No batch eligibility today (sub-minute SLA incompatible with 24h batch turnaround). Reserved for future Priority/Flex routing in v0.2. |
| `async` | Enable Batch API lever. Applies 0.5× multiplier to *both* effective input and effective output for any model where `batch === true`. |

**Trace line:** `STEP 2  latency=<value>  →  <batch eligible | real-time path>`

---

## Rule 2 — Simple or complex?

**Inputs:** `task` and `quality`.

Two floors apply; the higher one wins:

```
quality_floor:  good-enough=1, production=2, high=3, frontier=4
task_floor:     classification=1, extraction=1,
                chat=2, summarization=2,
                reasoning=3, coding=2, agent=3
min_tier = max(quality_floor, task_floor)
```

An upper bound prevents over-shooting:

```
quality_max:    good-enough=2, production=3, high=4, frontier=4
task_buffer:    reasoning=+1, agent=+1, others=+0
max_tier = min(4, max(quality_max, min_tier + task_buffer))
```

Candidate set: `{ m ∈ MODELS : min_tier ≤ m.tier ≤ max_tier }`.

**Why a buffer?** Reasoning- and agent-heavy tasks benefit from one tier of "headroom"; the engine considers both the floor model and one tier above, then lets cost ranking decide.

**Trace line:** `STEP 3  quality=<value> task=<value>  →  tier ∈ [<min>, <max>]`

---

## Rule 3 — Repeated context or one-off?

**Input:** `reuse` ∈ {`oneoff`, `repeated`, `heavy`}.

| Value | Cache hit rate |
|---|---|
| `oneoff` | 0% — caching lever disabled |
| `repeated` | 70% — typical for shared system prompts and few-shot scaffolding |
| `heavy` | 90% — typical for document-QA loops where the same document is referenced repeatedly |

The lever applies *only* to models where `cache === true`. Cached input is priced at the model's `cached_input` rate (~10% of base) for the hit portion; the miss portion stays at base.

```
effective_input = (1 − hit_rate) * base_input + hit_rate * cached_input
```

Write costs (Anthropic 5-min cache: 1.25× base on the first write) are not modeled — for any sustained workload at `repeated` or `heavy`, write cost is amortized below noise (break-even at 1–2 reads per the reference doc).

**Trace line:** `STEP 4  reuse=<value>  →  cache hit rate <X>%`

---

## Rule 4 — Compliance or residency need?

**Input:** `compliance` ∈ {`none`, `us`, `eu`, `selfhost`}.

| Value | Filter | Premium |
|---|---|---|
| `none` | none | 1.0× |
| `us` | model.residency includes `us` or `global` | 1.10× (premium applied to all candidates) |
| `eu` | model.residency includes `eu` | 1.0× (no premium today; some providers may charge) |
| `selfhost` | model.selfhost === true | 1.0× (open-weight only) |

**Trace line:** `STEP 5  compliance=<value>  →  <filter / premium description>`

**Edge case:** If `selfhost` returns an empty candidate set (no eligible models pass the tier+specialty filter), the engine returns `{ error: 'No eligible models — constraints are too restrictive.' }` rather than silently relaxing. This is the desired behavior — the user should know their constraints are incompatible, not be quietly downgraded.

---

## Rule 5 — Bursty or steady-state?

**Input:** `throughput` ∈ {`low`, `bursty`, `steady`}.

| Value | Effect |
|---|---|
| `low` | Default pay-per-token. No note. |
| `bursty` | Default pay-per-token. No note (PTU would over-provision). |
| `steady` (and `latency != async`) | Add a recommendation note: *consider Microsoft Foundry PTU or Cohere Vault for fixed-capacity pricing above ~60–70% utilization*. Cost is not algorithmically adjusted — PTU sizing is workload-dependent. |

**Trace line:** `STEP 6  throughput=<value>  →  <PTU note added | pay-per-token>`

---

## Rule 6 — Lowest-cost eligible model

For every candidate that survived rules 1–5, compute monthly cost:

```
effort_factor = (allow_effort_reduction AND model.effort) ? 0.65 : 1.0
allow_effort_reduction = (quality != 'frontier') AND NOT (task='reasoning' AND quality='high')

eff_input  = ((1 − hit) * base_in + hit * cached_in) * (async ? 0.5 : 1) * residency_premium
eff_output = base_out * (async ? 0.5 : 1) * residency_premium

monthly = eff_input  * volume_in_M
        + eff_output * volume_out_M * effort_factor
        + specialty_tiebreak
```

`specialty_tiebreak` is a tiny negative epsilon (−$0.0001) applied to coding-specialty models when `task=coding`. Used only to break exact-tie scenarios; not large enough to override real price differences.

The engine sorts candidates ascending by `monthly`. Index 0 is the winner. Indices 1–5 appear in the alternatives table.

**Trace line:** `STEP 9  candidates after filters  →  N models`
**Trace line:** `STEP 10 winner  →  <provider> · <name>  @  $<monthly>/mo`

---

## Specialty-aware notes (post-decision)

After the winner is selected, the engine surfaces *informational* notes when:

- **Coding task** but the winner is not a coding-specialty model. The note names the cheapest coding-specialty candidate and the cost delta.
- **Agent task** but the winner is not an agent-specialty model. Same treatment.
- **Self-host required** — adds an "accounting" note clarifying that the displayed dollar figure is per-token-equivalent, not actual self-host compute cost.

These notes do not change the recommendation. They make the cost/quality trade-off legible.

---

## Baseline definition

The baseline is fixed at **GPT-5.5 real-time, no caching, no batching, no effort tuning**:

```
baseline_cost = 5.00 * volume_in_M + 30.00 * volume_out_M
```

Chosen because GPT-5.5 is the frontier-tier reference point in the reference doc's pricing table. Anthropic Opus 4.8 is cheaper per token ($5/$25) but the brief framed savings against "a frontier-model path"; in practice teams default to whichever frontier model their evaluation set sanctioned, and GPT-5.5 is the most commonly defaulted baseline.

**To change the baseline:** edit `BASELINE_ID` in `index.html`.

---

## Lever annotation table

| Lever | Triggered when | Impact label | Kind |
|---|---|---|---|
| Batch processing | `latency=async` AND `model.batch` | `−50%` | savings |
| Prompt caching | `reuse ∈ {repeated, heavy}` AND `model.cache` | `−<hit%×81>% input` | savings |
| Reasoning effort = medium | quality ≠ frontier AND task ≠ reasoning-at-high AND `model.effort` | `−35% output` | savings |
| Right-sized model | `winner.tier < 4` | `−<X>% base` (vs baseline list price) | savings |
| Self-hosted open weights | `compliance=selfhost` AND winner is open-weight | `fixed cost` | note |
| Residency premium | `compliance=us` AND premium > 1.0× | `+10%` | note |
| Infrastructure (PTU) | `throughput=steady` AND not async | `see docs` | note |
| Context-size warning | `context=large` | `see docs` | note |
| Self-host accounting | `compliance=selfhost` | `see infra` | note |
| Specialty alternative | task is coding/agent AND winner is not specialty | `+$<delta>/mo` | note |
| Model note | winner has free-text `note` field | `—` | note |

---

## Invariants the engine must preserve

These are testable assertions for the validation harness:

1. **No empty winner without an error.** If the candidate set is empty, return `{ error: '...' }`. Never silently relax constraints.
2. **Monotonicity in tier:** at equal effective rates, lower tier wins. (Achieved by ranking on cost, since lower tier = lower base rate, with equal levers.)
3. **Batch reduces both input and output** equally for batch-supporting models.
4. **Caching applies only to input tokens.** Output is never cached.
5. **Effort reduces output volume**, not output rate. (Modeled as a multiplier on `volume_out_M`.)
6. **Residency premium multiplies both input and output rates.**
7. **The trace order matches the rule order.** STEP 1 always fires first; STEP 10 always fires last.
8. **Savings = baseline − recommended** is always reported with sign; a negative result (recommended is more expensive) should be displayed as "no savings", not as a positive number.
