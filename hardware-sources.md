# Hardware & Throughput Source Map (Self-host Economics)

**Snapshot date:** 2026-06-14
**Scope:** the `HARDWARE` and `THROUGHPUT` tables embedded in `index.html`, consumed by the **Self-host Economics** tab and its `selfHostCost()` and `ownedHourly()` engines.
**Verification method:** compiled from public cloud GPU pricing pages, neocloud price lists, the SkyPilot pricing catalog, and published vLLM throughput benchmarks. Cross-checked for internal consistency (price-per-FLOP and tokens-per-dollar ordering across GPUs).
**Currency:** USD per GPU-hour (`$/hr`). Throughput in output tokens/second (`tok/s`).

> **Read this first — honesty discipline.** Every `$/hr` and `tok/s` figure here is a **representative, illustrative snapshot**, not a quote and not a guarantee. GPU prices move weekly (spot especially), and throughput swings widely with precision, batch size, sequence length, and serving stack. The tab states a **cost *structure*** (fixed GPU capacity vs. linear API spend, and the volume where they cross), not a price you will be billed. **Re-verify against live pricing and benchmark on your own traffic before any decision.** Spot/preemptible figures exclude eviction and restart overhead.

This file is the single source of truth for every number in the `HARDWARE` and `THROUGHPUT` arrays. When you change a value in the HTML, change the matching row here in the same commit (mirrors the `pricing-sources.md` convention).

---

## 1. GPU price snapshot (`HARDWARE`)

Four GPUs spanning the cost/VRAM range that matters for open-weight serving: two 24 GB cards for small models, two 80 GB cards for mid-size models. Each carries three price bases — hyperscaler **on-demand**, hyperscaler **spot/preemptible**, and the cheapest mainstream **neocloud** on-demand.

| id | GPU | VRAM | On-demand $/hr | Spot $/hr | Neocloud $/hr | Source category |
|---|---|---|---|---|---|---|
| `l4` | NVIDIA L4 | 24 GB | 0.71 (GCP) | 0.21 (GCP) | 0.44 (RunPod) | GCP GPU pricing · SkyPilot catalog · RunPod |
| `a10g` | NVIDIA A10G | 24 GB | 1.01 (AWS g5) | 0.35 (AWS g5) | 0.75 (RunPod) | AWS EC2 g5 · SkyPilot catalog · RunPod |
| `a100-80gb` | NVIDIA A100 80 GB | 80 GB | 3.43 (AWS/GCP) | 1.57 (GCP) | 1.19 (RunPod) | AWS p4de / GCP a2-ultra · SkyPilot catalog · RunPod |
| `h100-80gb` | NVIDIA H100 80 GB | 80 GB | 6.88 (AWS p5) | 2.50 (AWS p5) | 2.49 (Lambda) | AWS EC2 p5 · SkyPilot catalog · Lambda |

**Source categories (re-verify on the build date):**

- **GCP GPU pricing** — `cloud.google.com/compute/gpus-pricing` (L4, A100 80 GB on-demand and spot).
- **AWS EC2 pricing** — `aws.amazon.com/ec2/pricing/on-demand/` and the g5 (A10G) / p5 (H100) instance pages; per-GPU figures derived from single-GPU instance hourly rates.
- **SkyPilot catalog** — `github.com/skypilot-org/skypilot-catalog` and `sky show-gpus`, which aggregates per-region on-demand and spot `$/hr` across AWS/GCP/Azure and several neoclouds. This is the cross-cloud cross-check used in the AI-cost lane of this program.
- **RunPod** — `runpod.io/pricing` (community/secure-cloud on-demand for L4, A10G, A100 80 GB).
- **Lambda** — `lambdalabs.com/service/gpu-cloud` (H100 on-demand).

**Notes & assumptions**

- Per-GPU price = instance hourly rate ÷ GPUs per instance (multi-GPU instances are normalized to one GPU; NVLink/interconnect benefits are not credited).
- **Spot = preemptible.** The model uses the spot rate as-is; it does **not** add the cost of checkpoint/restart, capacity unavailability, or the engineering to make a workload eviction-tolerant. Treat spot results as a best case.
- Neocloud is the cheapest mainstream on-demand alternative, not a spot rate — included so users can compare a managed hyperscaler against a price-leader.
- Figures are list/catalog prices. Committed-use discounts, reserved capacity, private rates, and region variance are **not** modeled.

### 1b. Purchase price & board power — for the **Buy / owned** model

The **Buy** column amortizes a card's purchase price and adds its electricity draw. Two new per-GPU fields back this:

| id | GPU | `buy_usd` (purchase) | `tdp_w` (board power) | Source category |
|---|---|---|---|---|
| `l4` | NVIDIA L4 | 2,500 | 72 | L4 PCIe street price · NVIDIA datasheet TDP |
| `a10g` | NVIDIA A10G | 3,000 | 150 | A10/A10G street price · NVIDIA datasheet TDP |
| `a100-80gb` | NVIDIA A100 80 GB | 17,000 | 300 | A100 80 GB PCIe street price · NVIDIA datasheet TDP |
| `h100-80gb` | NVIDIA H100 80 GB | 28,000 | 350 | H100 80 GB PCIe street price · NVIDIA datasheet TDP |

- **Purchase prices** are illustrative street/list snapshots for the **PCIe** card (not SXM/HGX baseboard), USD, single unit, before tax, shipping, or volume discount. Secondary-market prices vary widely — treat as a starting point and edit in the UI.
- **TDP** is the card's rated board power in watts from NVIDIA datasheets (L4 72 W, A10G 150 W, A100 80 GB PCIe 300 W, H100 80 GB PCIe 350 W). SXM variants draw materially more (e.g., H100 SXM ≈ 700 W) — switch the value if you model SXM.
- Both values **auto-fill into the UI from the selected GPU** and are fully editable; any user override is treated as authoritative by the engine.
- Source categories (re-verify on the build date): NVIDIA product datasheets (`nvidia.com` L4 / A10 / A100 / H100 datasheets) for TDP; aggregated retail/reseller listings for purchase price.

---

## 2. Throughput snapshot (`THROUGHPUT`)

Sustained **output** (decode) tokens/second under vLLM at a serving batch, for each VRAM-feasible `(model, GPU)` pair. The open-weight catalog spans **eight** models: the three advisor-catalog models — **Phi-4 mini** (3.8 B), **Phi-4** (14 B), **Mistral Small 4** (~24 B) — plus five **self-host-only** additions (Track A.3) — **Llama 3.1 8B**, **Qwen2.5 7B**, **Gemma 2 9B**, **Qwen2.5 32B**, and **Llama 3.3 70B**. (The five additions live in a separate `SELFHOST_EXTRA` list so they appear only in the Self-host tab and never alter the Cost Advisor's recommendations.) Pairs that do not fit in VRAM are **omitted on purpose** — their absence is how the engine marks a combination *infeasible* (see §4).

| model | GPU | precision | out tok/s | prefill_factor | assumptions |
|---|---|---|---|---|---|
| Phi-4 mini | `l4` | fp16 | 2500 | 8 | batch ≥ 32, ~1K in / 256 out |
| Phi-4 mini | `a10g` | fp16 | 2400 | 8 | batch ≥ 32, ~1K in / 256 out |
| Phi-4 mini | `a100-80gb` | fp16 | 7000 | 8 | batch ≥ 32, ~1K in / 256 out |
| Phi-4 mini | `h100-80gb` | fp16 | 9000 | 8 | batch ≥ 32, ~1K in / 256 out |
| Phi-4 | `l4` | fp8 | 900 | 8 | FP8 to fit 24 GB; batch ≥ 32 |
| Phi-4 | `a10g` | fp8 | 850 | 8 | FP8 to fit 24 GB; batch ≥ 32 |
| Phi-4 | `a100-80gb` | fp16 | 2750 | 8 | batch ≥ 32, ~1K in / 256 out |
| Phi-4 | `h100-80gb` | fp16 | 3600 | 8 | batch ≥ 32, ~1K in / 256 out |
| Mistral Small 4 | `a100-80gb` | fp16 | 2000 | 8 | batch ≥ 32, ~1K in / 256 out |
| Mistral Small 4 | `h100-80gb` | fp16 | 2550 | 8 | batch ≥ 32, ~1K in / 256 out |
| Llama 3.1 8B | `l4` | fp16 | 1400 | 8 | batch ≥ 32, ~1K in / 256 out |
| Llama 3.1 8B | `a10g` | fp16 | 1300 | 8 | batch ≥ 32, ~1K in / 256 out |
| Llama 3.1 8B | `a100-80gb` | fp16 | 4200 | 8 | batch ≥ 32, ~1K in / 256 out |
| Llama 3.1 8B | `h100-80gb` | fp16 | 5400 | 8 | batch ≥ 32, ~1K in / 256 out |
| Qwen2.5 7B | `l4` | fp16 | 1500 | 8 | batch ≥ 32, ~1K in / 256 out |
| Qwen2.5 7B | `a10g` | fp16 | 1400 | 8 | batch ≥ 32, ~1K in / 256 out |
| Qwen2.5 7B | `a100-80gb` | fp16 | 4500 | 8 | batch ≥ 32, ~1K in / 256 out |
| Qwen2.5 7B | `h100-80gb` | fp16 | 5800 | 8 | batch ≥ 32, ~1K in / 256 out |
| Gemma 2 9B | `l4` | fp16 | 1200 | 8 | fp16 ~18 GB; batch ≥ 16 on 24 GB cards |
| Gemma 2 9B | `a10g` | fp16 | 1100 | 8 | fp16 ~18 GB; batch ≥ 16 on 24 GB cards |
| Gemma 2 9B | `a100-80gb` | fp16 | 3800 | 8 | batch ≥ 32, ~1K in / 256 out |
| Gemma 2 9B | `h100-80gb` | fp16 | 4900 | 8 | batch ≥ 32, ~1K in / 256 out |
| Qwen2.5 32B | `a100-80gb` | fp8 | 1500 | 8 | FP8 ~32 GB to leave KV room; batch ≥ 16 |
| Qwen2.5 32B | `h100-80gb` | fp8 | 1950 | 8 | FP8 ~32 GB to leave KV room; batch ≥ 16 |
| Llama 3.3 70B | `a100-80gb` | fp8 | 700 | 8 | FP8 ~70 GB/card; modeled as **TP×2 — 2 cards/replica** (single-card is impractically tight) |
| Llama 3.3 70B | `h100-80gb` | fp8 | 1100 | 8 | FP8 ~70 GB/card; modeled as **TP×2 — 2 cards/replica** (single-card is impractically tight) |

**Source category (re-verify on the build date):**

- **vLLM benchmarks & docs** — `docs.vllm.ai` (benchmarking guide and throughput tables) and `blog.vllm.ai` performance posts, plus each model's card (`huggingface.co/microsoft/Phi-4`, `…/Phi-4-mini-instruct`, `…/mistralai`). The tok/s above are **representative of published vLLM decode throughput at the stated batch**, rounded to two significant figures. They are *not* a guarantee for your sequence lengths, your batch profile, or your vLLM version.
- **Open-weight additions (Track A.3) — Llama 3.1 8B, Qwen2.5 7B, Gemma 2 9B, Qwen2.5 32B, Llama 3.3 70B.** Their `out tok/s` are **illustrative figures interpolated from the Phi-4 / Mistral anchors by parameter count and GPU class** (memory-bandwidth tier), then rounded — not independently benchmarked. Model sizes, context windows, and licenses are from each model card (`huggingface.co/meta-llama/Llama-3.1-8B-Instruct`, `…/Llama-3.3-70B-Instruct`, `…/Qwen/Qwen2.5-7B-Instruct`, `…/Qwen2.5-32B-Instruct`, `…/google/gemma-2-9b-it`). **Treat them as order-of-magnitude placeholders and benchmark your own stack before deciding.**

**Provenance tag (`source`):** every `THROUGHPUT` row carries a `source` field — `'measured'` for the Phi-4 / Mistral anchors (representative of published vLLM throughput) and `'est'` for the five interpolated open-weight additions. The engine returns it as `throughput_source`, and the Self-host tab surfaces it directly: the model picker appends "· est. tput" and the Throughput readout shows an **est.** badge whenever the selected pair is interpolated. This makes the "clearly-labeled estimate" promise literally true per-model rather than a blanket caveat.

**Why these pairs (VRAM feasibility)**

- A served model needs roughly `params × bytes/param` for weights, **plus** KV-cache and activation headroom (often 1.3–2× the weight footprint at a real batch).
- **Phi-4 mini (3.8 B)** fits comfortably on all four GPUs in fp16.
- **Phi-4 (14 B)** needs ~28 GB in fp16, so on the 24 GB cards it is listed at **fp8** (≈14 GB weights) to leave KV-cache room; on 80 GB cards it runs fp16.
- **Mistral Small 4 (~24 B)** needs ~48 GB in fp16 — it does **not** fit the 24 GB L4/A10G at a usable batch, so those pairs are omitted and the engine reports them infeasible. It runs on the 80 GB cards.
- **Llama 3.1 8B (8 B)** and **Qwen2.5 7B (7 B)** fit all four GPUs in fp16 (~14–16 GB weights).
- **Gemma 2 9B (9 B)** fits all four in fp16 (~18 GB) but is tight on the 24 GB cards, so L4/A10G are listed at a smaller batch (≥ 16).
- **Qwen2.5 32B (32 B)** needs ~64 GB in fp16; it is listed at **fp8** (~32 GB) on the 80 GB cards only — it does **not** fit the 24 GB cards, so those pairs are omitted.
- **Llama 3.3 70B (70 B)** is ~140 GB in fp16 (two cards) and ~70 GB in **fp8**. Although ~70 GB *fits* one 80 GB card on paper, a single card leaves almost no KV-cache headroom, so the engine **models it as tensor-parallel across 2 cards** (`gpus_per_replica: 2`): the per-replica capacity is the table's tok/s, and the cost model provisions GPUs in pairs (2, 4, 6 …). This is the honest provisioning — its self-host cost and break-even reflect two cards, not a single-card lower bound.

**`prefill_factor`** — input (prefill) is compute-bound and runs far faster than output (decode), which is memory-bandwidth-bound. The model approximates `prefill tok/s ≈ out_tok_s × prefill_factor` and uses it to convert input volume into an output-token-equivalent load. `8` is a deliberately conservative, round placeholder across all pairs; calibrate per stack.

---

## 3. The cost model (what the numbers feed)

`selfHostCost(model, hw, basis, volIn_M, volOut_M, opts)` is pure and deterministic. With `opts = { utilCeiling: 0.7, minReplicas: 1, hoursPerMonth: 730, includePrefill: true, apiRef }`:

```
capacityPerGpuMonth = out_tok_s × 3600 × hoursPerMonth × utilCeiling      // output tokens / GPU / month
outEquivVol         = volOut_M·1e6 + (includePrefill ? volIn_M·1e6 / prefill_factor : 0)
gpusNeeded          = max(minReplicas, ceil(outEquivVol / capacityPerGpuMonth))
monthly             = gpusNeeded × $/hr × hoursPerMonth
perMTokOut          = monthly / volOut_M
floorPerMTokOut     = $/hr / (out_tok_s × 3600 × utilCeiling) × 1e6        // asymptotic unit cost at full utilization
breakevenVolOut_M   = smallest output volume (holding the in:out ratio) where self-host monthly ≤ API monthly
```

- **Self-host is a step function** (you rent whole GPUs by the hour, idle or not); **the API is linear** (pay per token). So the headline answer is a **break-even volume**, not a flat `$/MTok`.
- `utilCeiling` (default 70%) models the gap between theoretical and sustained throughput. `minReplicas` is an availability floor (GPUs always on).
- `floorPerMTokOut` is the unit cost a single GPU asymptotes to at full utilization — the best self-host can ever do on that GPU at that price.
- Break-even compares against an **API reference** (default: the same model's own list price from `MODELS`; selectable to any catalog model).

### 3b. The Buy / owned effective `$/hr` — `ownedHourly(hw, o)`

`selfHostCost` accepts an optional `opts.overrideUsdHr`. When it is set and positive, the engine **skips the rental price lookup** and uses that figure as the GPU's hourly cost, labelling the result `owned`. The **Buy** column derives that hourly figure from first principles instead of a rental rate:

```
HOURS_PER_YEAR = 8766                                       // 365.25 × 24
cardPerHr    = purchase_usd / (lifeYears × HOURS_PER_YEAR)  // straight-line amortization of the card
powerPerHr   = (tdp_w / 1000) × usdPerKwh × pue             // electricity × cooling/overhead (PUE)
hostingPerHr = hostingPerMonth / 730                        // server/rack/colo/ops slice per GPU
ownedUsdHr   = cardPerHr + powerPerHr + hostingPerHr
```

Defaults (all editable in the UI): `lifeYears 3`, `usdPerKwh 0.12`, `pue 1.5`, `hostingPerMonth 250`; `purchase`/`tdp` default to the GPU's `buy_usd`/`tdp_w`. Returns `null` (Buy column blanks out) if purchase or life is non-positive.

**Worked example — H100 80 GB at defaults:** card `28000 / (3 × 8766) = $1.065/hr` + power `(350/1000) × 0.12 × 1.5 = $0.063/hr` + hosting `250 / 730 = $0.342/hr` ≈ **$1.47/hr**. Versus the same card at **spot $2.50/hr** or **neocloud $2.49/hr**, owning is cheaper *if kept busy*. For a cheap **L4**, owned ≈ `0.095 + 0.013 + 0.342 = $0.45/hr` — **more** than L4 spot `$0.21/hr`, because the flat `$250/mo` hosting dominates a cheap card. That inversion is exactly why the tab shows Rent and Buy side by side rather than assuming one always wins.

**Rent and Buy use the same `gpusNeeded`.** Owning amortizes the card over a *useful life*, but the monthly bill still multiplies by the number of GPUs your *utilization* demands (the engine's `ceil`/`minReplicas` logic) — so **owning only wins when the GPU stays busy.** Idle owned hardware is sunk capital you cannot hand back, making rental the safer choice at low or spiky utilization. The Buy break-even is computed against the same API reference as Rent.

---

## 4. Feasibility rule

A `(model, GPU)` pair is **feasible iff a `THROUGHPUT` row exists** for it. The UI disables/flags pairs with no row, and `selfHostCost` returns `{ feasible: false, reason }` for:

1. a model that is not open-weight (`selfhost !== true`),
2. a `(model, GPU)` pair with no benchmark row (VRAM-infeasible or simply not measured), or
3. a price basis the GPU does not list.

This keeps the tool honest: it never invents a throughput number to fill a gap.

---

## 5. Caveats for the researcher

1. **Prices are list/catalog snapshots, not a feed.** Re-run this audit before any external use; spot rates in particular can move day to day.
2. **Throughput is illustrative.** Real tok/s depends on precision, batch size, sequence-length distribution, speculative decoding, chunked prefill, and vLLM version. Benchmark your own workload.
3. **Spot risk is unpriced.** Eviction, capacity gaps, and restart/checkpoint engineering are real costs the spot basis ignores.
4. **Engineering time, networking, storage, and egress are out of scope.** Rent prices the GPU-hour; Buy adds amortized capital, power × PUE, and a flat hosting/ops slice — but **neither** prices the engineers who build and run the serving stack, nor networking, storage, data egress, or model-update labor. At small scale these usually dwarf the rent-vs-buy gap, which is why the tab is a *cost-structure* tool, not a TCO quote.
5. **Limited multi-GPU interconnect modeling.** Per-GPU prices are normalized from instance rates; NVLink tensor-parallel speedups/penalties are not separately credited. Most modeled models fit on a single GPU. **Llama 3.3 70B** is the exception: it is provisioned as **tensor-parallel across 2 cards** (`gpus_per_replica: 2`), so its GPU count and cost are doubled relative to a single card — an honest floor for a 70 B, though real TP throughput scaling across NVLink is still not separately credited.
6. **Refresh cadence (recommended):** monthly for GPU prices; re-benchmark throughput whenever the serving stack or precision changes.
