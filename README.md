# AI Inference Cost Optimizer — FinOps Decision Assistant

A rule-based cost advisor that recommends the cheapest viable AI inference path for a given workload — and explains why it's cheaper. Not a calculator. A FinOps decision assistant.

🔗 **Live demo:** [oguzhan-canada.github.io/ai-inference-cost-optimizer](https://oguzhan-canada.github.io/ai-inference-cost-optimizer/)

**Status:** v0.1 prototype · self-contained single-page web app · GitHub-Pages-ready.
**Pricing snapshot:** 2026-05-31 (verified against six provider documentation sets).
**Positioning:** *Optimize cost without sacrificing enough quality to matter.*

---

## The Three Competing Objectives

Successful AI applications require balancing three competing objectives:

| Objective | What it means | Tradeoff |
|-----------|---------------|----------|
| **Accuracy** | Model quality, output correctness, instruction-following | Higher-tier models cost more per token |
| **Latency** | Response time, user experience | Real-time locks out batch discounts (typically 50% off) |
| **Cost** | Per-token spend, infrastructure, operational overhead | Cheapest model may not meet quality or compliance needs |

**There is no universal formula.** The optimal solution depends on the business requirements, workload characteristics, and acceptable tradeoffs. This tool helps you navigate those tradeoffs systematically.

---

## Why 16 Models?

The dashboard evaluates **16 curated models across 5 providers** (Mistral, OpenAI, Anthropic, Google Gemini, Microsoft Foundry). The number is mostly practical:

- **Manageable scope** — covers the models most likely to matter for cost comparison without overwhelming the rule framework.
- **Tier coverage** — at least one model per price tier (simple → standard → complex → frontier) from the major providers.
- **Transparency** — a small catalog keeps the decision engine auditable and the trace readable.
- **Extensible** — the `MODELS` array in `index.html` is the single source of truth. Adding a model is one JS object.

Cohere is excluded from v0.1 pending verified 2026 pricing; Gemini is represented only by Flash-Lite (the only model with explicitly documented pricing at snapshot date). Microsoft Foundry includes both OpenAI-hosted models (GPT-5.4 mini, GPT-5.4) and Microsoft's own Phi-4 SLMs (Phi-4 mini, Phi-4) — the latter being open-weight (MIT) and self-hostable. This is a deliberate accuracy-over-coverage choice.

---

## Disclaimer

> **This is a high-level comparison tool for directional guidance only.**
>
> - Pricing is a snapshot (verified 2026-05-31) and may change at any time.
> - Quality assessments are based on tier classifications, not live benchmarks or evals.
> - The tool does **not guarantee** that the recommended model will meet your specific accuracy, latency, or compliance requirements.
> - Always verify pricing against current provider documentation and run your own evaluations before committing to a production path.
> - No warranty is expressed or implied. This is a FinOps decision *assistant*, not an oracle.

---

## What it does

You describe a workload along seven small dimensions — task type, latency, reuse pattern, context size, quality bar, compliance constraint, throughput pattern — plus your monthly volume estimate. The engine walks a deterministic rule tree, applies stacking cost levers (batch, caching, reasoning effort, right-sizing), filters by compliance, and ranks every eligible model by effective monthly cost. You get:

- **A recommended provider/model path**, with a one-line "why cheaper."
- **An estimated monthly cost** at your volume.
- **The savings versus a frontier baseline** (GPT-5.5 real-time, no optimizations), in both dollars and percent.
- **An itemized list of levers used**, with the impact of each.
- **A decision trace** — every rule that fired, in order.
- **The next five eligible candidates** so you can see the trade space, not just the verdict.
- **An exportable JSON result** for piping into reports, eval harnesses, or tickets.

This product complements (and lives upstream of) the larger **AI Inference Cost Optimizer** project: where the Optimizer diagnoses *existing* spend, this prototype helps you *route the next workload* cheaply from the start.

### Routing Impact tab

A second, **independent** calculator (it does not touch the Cost Advisor engine or its validation set). It isolates one question: *how much does model routing cut an inference bill?* — list prices only, no caching/batching/effort levers, so any saving shown is attributable to routing alone. You enter one shared workload — input and output volume (in millions of tokens), an easy/intermediate/difficult mix (you set the easy and intermediate shares from dropdowns; the difficult share auto-fills the remainder, capped at 100%), and an average request size (tokens/request) — and the tab prices that workload across three routing layers, then consolidates them:

- **Native — in-cloud routing** (two cards, side by side): each hyperscaler's own managed router, measured against that cloud's own frontier model.
  - **AWS Bedrock — Intelligent Prompt Routing**: in-family Claude ladder (Haiku 4.5 → Sonnet 4.6 → Opus 4.8), a per-request fee ($1.00 / 1,000 routing requests — the request count is derived from input volume and the request-size input, so there is no separate requests field), vs an all-Opus baseline. Vendor claim: up to 30%.
  - **Azure AI Foundry — Model Router**: cross-family within Azure (GPT-5.4 nano → GPT-5.4 → GPT-5.5), a per-input-token router fee (~$0.14 / 1M input, tracker-derived), vs an all-GPT-5.5 baseline. Azure publishes no headline savings figure, so the card states that explicitly.
- **Cross-provider gateway**: one configurable gateway that can route each tier to *any* model in the 16-model catalog, across vendors, under four fee models (percentage markup on routed spend, zero-markup BYOK, flat subscription, or self-host). You pick the per-tier model because the cost/quality tradeoff is yours to make — the gateway classifies difficulty, it does not auto-pick the cheapest.
- **Specialist recommender**: a per-request model picker modeled as an overlay *behind* the gateway (a Not Diamond-style fee: ~$10 / 10,000 recommendations, first 10,000 free). Its break-even is measured against the gateway's own free routing — never the do-nothing baseline — to avoid double-counting the gateway's savings.

A closing **"one workload, every layer"** table compares all layers on the single workload: net $/mo is the comparable figure (percentages are each layer against its own baseline and are not comparable across rows), and the lowest-net real option is highlighted. Each card shows baseline → routed inference → net (incl. fee), a per-tier breakdown, and an honest headline that **flips to "costs more"** when a difficult-heavy mix makes routing uneconomic. Two standing caveats are surfaced: the mix assumes **equal tokens-per-request across tiers** (harder tasks usually emit more output, so this likely overstates savings), and each cheap tier is assumed **quality-acceptable** for its slice — validate on real traffic. Figures use list prices only, are per-cloud (not comparable across clouds), and are vendor-stated. Google (Vertex AI Model Optimizer, preview) is deferred pending a verified Gemini Flash/Pro price snapshot.

### Self-host Economics tab

A third, **independent** calculator (it does not touch the Cost Advisor engine, its validation set, or the Routing tab). It answers the one question the advisor's self-host filter leaves open: *self-hosting an open-weight model is not a per-token price — it is fixed GPU capacity, so at what monthly volume does running your own GPUs beat paying the API, and is it cheaper to **rent** or **buy** those GPUs?*

You pick an open-weight model — **Phi-4 mini, Phi-4, Mistral Small 4**, plus five popular community models added for coverage (**Llama 3.1 8B, Qwen2.5 7B, Gemma 2 9B, Qwen2.5 32B, Llama 3.3 70B**) — a GPU (L4, A10G, A100-80GB, or H100-80GB), a **rental basis** (on-demand / spot / neocloud), a utilization ceiling and min-replica (HA) floor, your monthly input/output volume, and an API model to compare against. A **Buy / owned-GPU** group (purchase price, useful life, board power/TDP, electricity, PUE, hosting — all auto-filled from the GPU and editable) drives a third cost line. The tab computes — via the pure, unit-tested `selfHostCost()` (rent) and `ownedHourly()` (buy) engines — the GPUs needed and three monthly costs side by side: **API**, **Rent**, **Buy**, with the cheapest highlighted and a **break-even output volume** for each of Rent and Buy versus the API. An always-visible **"How this is calculated"** box states the three formulas, what's included/excluded, and the key honesty caveat. An inline SVG chart plots the three lines (API, Rent, Buy) with both break-even points; a JSON **Export** emits `api` / `rent` / `buy` blocks (see `schema.md` §3a).

> The five community models live in a separate `SELFHOST_EXTRA` list, **not** the advisor `MODELS` catalog — so the Cost Advisor still runs its validated 11-model set unchanged. Their API reference prices are an *illustrative* Together AI size-tier snapshot (see `pricing-sources.md` → *Open-weight serverless*); larger models (32B/70B) are infeasible on the 24 GB L4/A10G and the engine reports them so. **Llama 3.3 70B is provisioned as tensor-parallel across 2 cards (`gpus_per_replica: 2`, shown as a `TP×2` badge)** so its cost and break-even reflect two GPUs, not an optimistic single card. Every throughput figure carries a **measured-vs-estimated** provenance tag: the three Phi-4/Mistral anchors are `measured` (representative of published vLLM throughput); the five additions are interpolated `est.` figures, surfaced per-model as an `est.` badge in the picker and Throughput readout.

The core insight it makes visible: **self-host is a step function, the API is linear** — so the honest output is a break-even, not a flat rate. Below break-even the API wins (the GPU sits idle); above it your own GPUs win — and **owning only beats renting if you keep the GPU busy** (idle owned hardware is sunk capital, so at low utilization renting is safer). Every GPU `$/hr`, purchase price, and `tok/s` is an **illustrative snapshot** sourced in `hardware-sources.md`; **spot = preemptible** (eviction overhead unmodeled); throughput varies with precision/batch/sequence length. The tab states a *cost structure*, not a quote, and excludes engineering time/networking/storage — validate on your traffic.

---

## How it works

The rule tree (see `ruleset.md` for the full specification) executes in the order the brief specified:

1. **Async or real-time?** → If async, the Batch API lever becomes available (50% off both input and output).
2. **Simple or complex?** → Bounds the eligible model tier band given the quality bar and task floor.
3. **Repeated context or one-off?** → Sets the cache hit rate (0 / 70% / 90%) and enables the caching lever for providers that support it.
4. **Compliance or residency need?** → Filters providers (US, EU, self-host) and applies any residency premium (e.g. +10% for Anthropic/OpenAI US-residency on March-2026+ models).
5. **Bursty or steady-state?** → Adds a PTU/dedicated-instance recommendation when utilization would justify it (Microsoft Foundry PTU).
6. **Lowest-cost eligible model** wins. Effort lever applies to output tokens where the quality bar permits.

Every lever, premium, and filter is auditable in the **decision trace** displayed on screen and in the JSON export.

---

## File layout

```
/
├── index.html                  # The prototype — one self-contained file. Open in any browser.
├── README.md                   # This file.
├── pricing-sources.md          # Source map: every API price cited, with provider doc URL and date.
├── hardware-sources.md         # Source map for the Self-host tab: GPU $/hr + vLLM throughput, with dates.
├── ruleset.md                  # The decision tree, formally specified.
├── schema.md                   # The JSON I/O schema (advisor result + self-host export).
├── wireframe.md                # One-page wireframe & layout intent.
├── validation-set.md           # Test scenarios + invariants with expected outcomes.
└── tests/
    ├── run.js                  # Advisor validation harness (11 scenarios).
    └── selfhost.run.js         # Self-host Economics invariant harness (43 assertions: rent + buy + open-weight catalog + provenance tags + 70B TP×2).
```

No build step. No dependencies. Drop the folder into a GitHub repo, enable GitHub Pages on `main` branch (root), and it's live.

---

## Deploying

**GitHub Pages**
1. Push the folder to a new GitHub repo.
2. Settings → Pages → Source: `main` / `/ (root)` → Save.
3. The site is live at `https://<user>.github.io/<repo>/` within ~60 seconds.

**Vercel**
1. `vercel` from the project folder. Accept defaults.
2. Vercel detects it as a static site; no build configuration needed.

**Local**
```
python3 -m http.server 8000
# open http://localhost:8000
```

---

## Stack rationale (and what it deliberately is *not*)

This prototype is one HTML file. Pricing, ruleset, and rendering are all in the same document. That is a deliberate choice for a v0.1 prototype:

- **No build step** means the artifact is the deployment. Any contributor can edit pricing or rules in a single file.
- **No framework dependency** means the prototype outlives any specific React/Vue/Svelte fashion cycle.
- **CSS variables** carry the design tokens so a brand or theme swap is one block of edits.
- **Plain `<script>`** means the decision engine is testable in vanilla Node — see the validation set's harness.

The brief asked for the *recommended* open-source UI stack. Given the brief's GitHub-Pages-or-Vercel deployment target, **a single static HTML file with vanilla JS is the recommendation for v0.1**. For v0.2 (when the pricing table grows past ~30 models, when scenarios need shareable URLs, or when adding multi-page eval views), upgrade to:

- **Astro** (content-first, ships zero JS by default, deploys to Pages and Vercel cleanly), with
- **`<script>`-island** components for the interactive decision panel, and
- **JSON files** in `/src/data/` for pricing and rules — easier to PR-review than mutations of a single HTML file.

React/Next is overkill for a tool that doesn't need routing, server state, or authentication.

---

## Known limitations

- **Pricing is a snapshot, not a feed.** Re-run the `pricing-sources.md` audit before any external use. AI inference prices move fast.
- **Quality bar is self-reported.** The tool trusts the user's quality assessment; there's no eval loop. A specialty-mismatch note fires when a coding/agent-specialty model is bypassed for cost reasons.
- **Volume model is monthly totals.** Token mix per request is implicit. For workloads with unusual input/output ratios (e.g. agent loops), break the volume into per-call rates externally.
- **Self-host economics are now modeled (open-weight only).** The Self-host Economics tab turns the advisor's self-host disclaimer into a real GPU-capacity break-even (`selfHostCost()` + `ownedHourly()` + `hardware-sources.md`). It compares **API vs renting vs buying** GPUs: rent uses on-demand/spot/neocloud `$/hr`; buy amortizes purchase price over a useful life and adds power (TDP × `$/kWh` × PUE) and flat hosting. Ops, networking, storage, spot-eviction recovery, and engineering time are out of scope, and GPU `$/hr`, purchase prices, and throughput are all illustrative snapshots.
- **16 models, 5 providers** — a deliberately curated v0.1 scope. Not every model from every provider is included; the selection emphasizes practical cost comparison over exhaustive coverage.
- **No live benchmarks.** Tier assignments are editorial, not empirical. A model classified as "tier 2" may outperform some "tier 3" models on specific tasks.
- **No persistence.** The page is stateless. Use the JSON export to save a decision.
- **Mistral price dominance is real.** Mistral's published per-token rates are significantly lower than competitors at equivalent tiers. The engine reflects this accurately — it is not a bug but a legitimate pricing advantage that may or may not persist.

See `validation-set.md` for the scenarios this prototype was tested against, and `ruleset.md` for the precise rule semantics.

---

## Case Study

The **[EDA Copilot](https://github.com/oguzhan-canada/eda-copilot)** project demonstrates these cost optimization principles in practice. A production GraphRAG system was built for **$240** against an original **$2,685** budget (91% cost reduction), operating at **~$0.01 per query**. Techniques included free-tier arbitrage, Anthropic Batch API (50% savings), tiered processing, and QLoRA fine-tuning on budget GPU instances.

📄 [Cost Optimization Paper](https://oguzhan-canada.github.io/eda-copilot/cost-optimization.html) · 🌐 [Live Dashboard](https://oguzhan-canada.github.io/eda-copilot/)
