# Schema — Inputs, Models, and Result

**Format:** JSON. All keys snake_case. All money in USD. All token volumes in millions (MTok) for monthly figures.
**Schema version:** 0.1.

This document is the contract between the UI, the decision engine, and any downstream consumer of the exported JSON.

---

## 1. Inputs

The seven decision dimensions plus monthly volume.

```jsonc
{
  "task":       "classification | extraction | chat | summarization | reasoning | coding | agent",
  "latency":    "realtime | near | async",
  "reuse":      "oneoff | repeated | heavy",
  "context":    "small | medium | large",     // <4K | 4K–32K | 32K–200K
  "quality":    "good-enough | production | high | frontier",
  "compliance": "none | us | eu | selfhost",
  "throughput": "low | bursty | steady",
  "volIn":      100,                           // monthly input volume, MTok
  "volOut":     20                             // monthly output volume, MTok
}
```

All fields are required. The UI guarantees they are populated from `<select>` defaults.

---

## 2. Model catalog entry

Stored in `index.html` as elements of the `MODELS` array. Source of truth for cost computation.

```jsonc
{
  "id":            "ministral-3b",            // stable slug, used in JSON export
  "provider":      "Mistral",                  // human display
  "name":          "Ministral 3B",
  "tier":          1,                          // 1 simple · 2 standard · 3 complex · 4 frontier
  "input":         0.10,                       // base $/MTok
  "output":        0.10,
  "cached_input":  null,                       // null means caching not supported / not documented
  "batch":         true,                       // Batch API supported
  "cache":         false,                      // prompt caching supported
  "effort":        false,                      // effort/reasoning_effort parameter supported
  "residency":     ["global", "us", "eu"],     // serving regions available
  "selfhost":      false,                      // open-weight, self-deployable
  "specialty":     "coding",                   // optional; "coding" or "agent"
  "note":          "open-weight (Apache 2.0)"  // optional free-text note surfaced as a lever
}
```

When adding a model:
1. Add the entry to `MODELS` in `index.html`.
2. Add a row to `pricing-sources.md` with the source URL and verification date.
3. If it changes the cheapest-path for any test case, update `validation-set.md`.

---

## 2a. Self-host hardware & throughput entries

Two snapshot tables in `index.html` feed the **Self-host Economics** tab and its `selfHostCost()` (rent) and `ownedHourly()` (buy) engines. Source of truth for both: `hardware-sources.md`. All figures are illustrative snapshots (see that file).

### `HARDWARE` entry (a GPU offering)

```jsonc
{
  "id":      "l4",                 // stable slug, used in the self-host export
  "gpu":     "NVIDIA L4",          // human display
  "vram_gb": 24,                   // VRAM; gates which models fit
  "buy_usd": 2500,                 // illustrative purchase price (PCIe card, USD) — feeds the Buy column
  "tdp_w":   72,                   // rated board power (W) — feeds the Buy column's power term
  "prices": [                      // ≥1 basis; each is one RENTAL purchasing option
    { "cloud": "GCP",    "basis": "on-demand", "usd_hr": 0.71 },
    { "cloud": "GCP",    "basis": "spot",      "usd_hr": 0.21 },  // spot = preemptible
    { "cloud": "RunPod", "basis": "neocloud",  "usd_hr": 0.44 }
  ]
}
```

`buy_usd` and `tdp_w` auto-fill the UI's owned-GPU inputs when a GPU is selected; `ownedHourly()` amortizes them into an effective `$/hr` (see `hardware-sources.md §3b`).

### `THROUGHPUT` entry (a benchmarked model × GPU pair)

```jsonc
{
  "model_id":       "phi-4-mini",  // must match a MODELS id with selfhost:true
  "gpu_id":         "l4",          // must match a HARDWARE id
  "precision":      "fp16",        // serving precision (fp16 | fp8 | …)
  "out_tok_s":      2500,          // sustained output (decode) tokens/sec at the stated batch
  "prefill_factor": 8,             // input (prefill) tok/s ≈ out_tok_s × prefill_factor
  "source":         "measured",    // provenance: "measured" (anchors) | "est" (interpolated). Optional; defaults to "measured".
  "gpus_per_replica": 1,           // tensor-parallel degree (cards per replica). Optional; defaults to 1. Llama 3.3 70B = 2.
  "assumptions":    "batch≥32, ~1K in / 256 out"
}
```

**Feasibility is encoded by presence:** a `(model, GPU)` pair is feasible **iff** a `THROUGHPUT` row exists. Omit oversized/unmeasured pairs — the engine returns `{ feasible: false, reason }` for them rather than guessing.

When adding hardware/throughput:
1. Add the `HARDWARE` and/or `THROUGHPUT` entry in `index.html`.
2. Add the matching row to `hardware-sources.md` (price/throughput, source category, date).
3. Add or re-record any affected assertion in `tests/selfhost.run.js`.

---

## 3. Result (exported JSON)


What you get from the "Export JSON" button.

```jsonc
{
  "generated_at":           "2026-05-31T14:22:18.401Z",
  "pricing_snapshot_date":  "2026-05-31",
  "schema_version":         "0.1",

  "inputs": { /* see §1 */ },

  "recommendation": {
    "provider":          "Mistral",
    "model":             "Mistral Small 4",
    "model_id":          "mistral-small-4",
    "tier":              2,
    "effective_per_mtok": {
      "input_usd":  0.10,
      "output_usd": 0.30
    },
    "monthly_cost_usd":  16.00,
    "why_cheaper":       "right-sized to a smaller tier."
  },

  "baseline": {
    "model":             "GPT-5.5",
    "monthly_cost_usd":  1100.00,
    "assumption":        "frontier model, real-time, no caching, no batching, no effort tuning"
  },

  "savings": {
    "monthly_usd":       1084.00,
    "pct_off_baseline":  0.9855
  },

  "levers_applied": [
    {
      "name":   "Right-sized model (tier 2 · standard)",
      "impact": "−99% base",
      "kind":   "savings",
      "note":   "Smallest model that meets the stated quality bar — the highest-leverage lever in most workloads."
    },
    {
      "name":   "Model note",
      "impact": "—",
      "kind":   "note",
      "note":   "open-weight (Apache 2.0)"
    }
  ],

  "alternatives": [
    {
      "provider":              "OpenAI",
      "model":                 "GPT-5.4 nano",
      "monthly_cost_usd":      45.00,
      "delta_vs_winner_usd":   29.00
    }
    // …up to 4 entries
  ],

  "decision_trace": [
    "STEP 1  rules engine init  →  16 models in catalog",
    "STEP 2  latency = realtime  →  real-time path",
    "STEP 3  quality=production task=chat  →  tier ∈ [2, 3]",
    "STEP 4  reuse=repeated  →  cache hit rate 70%",
    "STEP 5  compliance=none  →  no filter",
    "STEP 6  throughput=bursty  →  pay-per-token preferred (no PTU)",
    "STEP 7  effort lever = eligible (reduce to medium)",
    "STEP 9  candidates after filters  →  7 models",
    "STEP 10 winner  →  Mistral · Mistral Small 4  @  $16.00/mo"
  ]
}
```

---

## 3a. Self-host export (Self-host Economics tab)

The **Export JSON** button on the Self-host Economics tab emits its own document (independent of the advisor export above). It reuses the shared JSON modal. As of **schema 0.3** it reports all three options — **API**, **Rent**, **Buy** — side by side, and folds an optional engineer / ops cost into the two self-host lines.

```jsonc
{
  "generated_at":   "2026-06-14T14:22:18.401Z",
  "snapshot_date":  "2026-06-14",          // from SELFHOST_SNAPSHOT_DATE
  "schema_version": "0.3",

  "inputs": {
    "model_id":             "phi-4-mini",
    "gpu_id":               "l4",
    "rental_basis":         "spot",        // on-demand | spot | neocloud (drives the Rent column only)
    "vol_in_mtok":          100,
    "vol_out_mtok":         20,
    "util_ceiling":         0.70,
    "min_replicas":         1,
    "engineer_monthly_usd": 0,             // optional people cost added to Rent & Buy (0 = off, the default)
    "compare_vs":           "phi-4-mini"   // API reference model id
  },

  "cheapest_at_volume": "api",             // "api" | "rent" | "buy" — lowest monthly at the user's volume

  "api": {
    "compare_vs":             "phi-4-mini",
    "input_usd_per_mtok":     0.075,
    "output_usd_per_mtok":    0.30,
    "monthly_at_volume_usd":  13.50        // API reference cost at the user's volume (scales with use)
  },

  "rent": {                                // GPUs rented by the hour at rental_basis
    "model_id":               "phi-4-mini",
    "gpu_id":                 "l4",
    "gpu":                    "NVIDIA L4",
    "vram_gb":                24,
    "rental_basis":           "spot",
    "cloud":                  "GCP",
    "usd_hr":                 0.21,
    "precision":              "fp16",
    "out_tok_s":              2500,
    "throughput_source":      "measured",   // provenance of out_tok_s: "measured" | "est"
    "gpus_needed":            1,
    "gpus_per_replica":       1,            // tensor-parallel cards per replica (Llama 3.3 70B = 2)
    "utilization":            0.007,        // fraction of capacity used at this volume
    "monthly_cost_usd":       153.30,       // gpus_needed × usd_hr × 730 (+ engineer_monthly_usd)
    "engineer_monthly_usd":   0,            // optional people cost, already included in monthly_cost_usd above (0 = off)
    "per_mtok_out_usd":       7.665,        // monthly ÷ vol_out (null if vol_out = 0); includes engineer cost
    "floor_per_mtok_out_usd": 0.033,        // asymptotic unit cost at full utilization (marginal — excludes the fixed engineer_monthly_usd)
    "breakeven_volout_mtok":  244,          // output MTok/mo where Rent ≤ API (null if none in range)
    "delta_vs_api_usd":       -139.80       // api_monthly − rent_monthly (positive ⇒ rent cheaper)
  },

  "buy": {                                 // owning the GPUs; amortized effective $/hr (null if no purchase price)
    "effective_usd_hr":       0.4505,       // = card + power + hosting (see ownedHourly, hardware-sources.md §3b)
    "usd_hr_breakdown": {
      "card":    0.0951,                    // purchase_usd / (life_years × 8766)
      "power":   0.0130,                    // (tdp_w/1000) × usd_per_kwh × pue
      "hosting": 0.3425                     // hosting_per_month / 730
    },
    "assumptions": {
      "purchase_usd":     2500,
      "life_years":       3,
      "tdp_w":            72,
      "usd_per_kwh":      0.12,
      "pue":              1.5,
      "hosting_per_month": 250
    },
    "gpus_needed":            1,            // same as Rent — set by throughput × utilization
    "gpus_per_replica":       1,            // same as Rent — tensor-parallel cards per replica
    "utilization":            0.007,
    "monthly_cost_usd":       328.89,       // gpus_needed × effective_usd_hr × 730 (+ engineer_monthly_usd)
    "engineer_monthly_usd":   0,            // same optional people cost as Rent (people cost is rent/buy-agnostic)
    "per_mtok_out_usd":       16.44,
    "floor_per_mtok_out_usd": 0.072,        // marginal — excludes the fixed engineer_monthly_usd
    "breakeven_volout_mtok":  523,          // output MTok/mo where Buy ≤ API (null if none in range)
    "delta_vs_api_usd":       -315.39,      // api_monthly − buy_monthly
    "delta_vs_rent_usd":      -175.59       // rent_monthly − buy_monthly (positive ⇒ buy cheaper than rent)
  },

  "assumptions": {
    "util_ceiling":    0.70,
    "min_replicas":    1,
    "hours_per_month": 730,
    "include_prefill": true
  },

  "caveats": [ "…", "…" ]                   // illustrative snapshots, rent/buy formulas, "owning only wins if busy", spot=preemptible, validate on traffic; engineering/ops time included only when engineer_monthly_usd > 0
}
```

If the selected `(model, GPU)` pair is infeasible, the export is instead `{ "feasible": false, "reason": "…", "inputs": { … } }`. If no purchase price is set, `buy` is `null`.

---

## 4. Field semantics

### `recommendation.effective_per_mtok`

The rates *after* batch, caching, and residency multipliers have been applied. **Not** the same as `model.input / model.output` from the catalog. Use these numbers when reporting "what the workload actually costs per token."

### `recommendation.why_cheaper`

A short, human-readable sentence assembled from which levers fired. Intended for ticket/Slack paste. Examples:

- `"right-sized to a smaller tier · batched at half price."`
- `"most input served from cache · reasoning effort capped to medium."`
- `"this is the cheapest eligible model for the constraints given."` (when no optimization levers applied)

### `levers_applied[].kind`

- `"savings"` — this lever produced a measurable cost reduction.
- `"note"` — this lever is informational (compliance premium, infra recommendation, specialty alert, etc.).

Downstream consumers can filter on `kind` to show only the dollar-impacting levers if desired.

### `decision_trace`

Verbatim trace lines. Stable enough for grep but **not** a stable machine-parseable format — use the structured fields above for programmatic consumption. The trace exists for human verification ("did the engine see what I expected?").

---

## 5. Versioning policy

- **`schema_version`** in the export is the contract between exporter and consumer.
- Bump the *minor* version (e.g. 0.1 → 0.2) when fields are added.
- Bump the *major* version when fields are renamed or semantics change.
- Old consumers should reject exports with unknown major versions and warn on unknown minor versions.

---

## 6. Validation harness JSON

Each entry in `validation-set.md` corresponds to one of these JSON shapes:

```jsonc
{
  "name":             "Customer chat — standard, real-time, repeated",
  "inputs":           { /* see §1 */ },
  "expected": {
    "winner_provider": "Mistral",         // or null if any provider acceptable
    "winner_id":       "mistral-small-4", // or null
    "max_monthly_usd": 25.00,             // assertion: winner must come in below this
    "must_apply":      ["Right-sized model"],   // levers required
    "must_not_apply":  ["Batch processing"]     // levers that must not fire
  }
}
```

The harness lives in the validation-set doc as runnable Node code. v0.2 should extract it into a proper `tests/` folder with a CI step.
