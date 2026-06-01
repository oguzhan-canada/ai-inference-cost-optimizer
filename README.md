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
├── pricing-sources.md          # Source map: every price cited, with provider doc URL and date.
├── ruleset.md                  # The decision tree, formally specified.
├── schema.md                   # The JSON I/O schema (inputs + recommendation result).
├── wireframe.md                # One-page wireframe & layout intent.
├── validation-set.md           # Test scenarios with expected outcomes.
└── tests/
    └── run.js                  # Extracted validation harness.
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
- **16 models, 5 providers** — a deliberately curated v0.1 scope. Not every model from every provider is included; the selection emphasizes practical cost comparison over exhaustive coverage.
- **No live benchmarks.** Tier assignments are editorial, not empirical. A model classified as "tier 2" may outperform some "tier 3" models on specific tasks.
- **No persistence.** The page is stateless. Use the JSON export to save a decision.
- **Mistral price dominance is real.** Mistral's published per-token rates are significantly lower than competitors at equivalent tiers. The engine reflects this accurately — it is not a bug but a legitimate pricing advantage that may or may not persist.

See `validation-set.md` for the scenarios this prototype was tested against, and `ruleset.md` for the precise rule semantics.
