# Pricing Source Map

**Snapshot date:** 2026-05-31
**Verification method:** Direct read of provider documentation, cross-checked against the project's `cost-optimization-techniques-v2.md` reference doc.
**Refresh cadence (recommended):** Monthly for production use; weekly during pricing-volatile periods (e.g. when a major provider releases a new tier).
**Currency:** All prices in USD per million tokens (USD/MTok) unless otherwise noted.

This map is the single source of truth for every number embedded in `index.html`'s `MODELS` array. When updating prices, update this file *and* the corresponding entry in the HTML in the same commit.

---

## Mistral

| Model | Input $/MTok | Output $/MTok | Cached Input | Source | Verified |
|---|---|---|---|---|---|
| Ministral 3B | 0.10 | 0.10 | — (not documented) | docs.mistral.ai | 2026-05-31 |
| Mistral Small 4 | 0.10 | 0.30 | — | docs.mistral.ai | 2026-05-31 |
| Mistral Large 3 | 0.50 | 1.50 | — | docs.mistral.ai | 2026-05-31 |
| Codestral | 0.30 | 0.90 | — | docs.mistral.ai | 2026-05-31 |

**Notes**
- Mistral does not document a prompt-caching feature; the `cache` flag is `false` for all Mistral models.
- Batch API: 50% off across the board, file-based, 24-hour turnaround.
- Mistral Small 4 and Mistral Medium 3.5 are open-weight (Apache 2.0) — eligible for self-host. Only Small 4 is included in the v0.1 catalog (Medium 3.5 pricing not enumerated in the reference doc).
- Self-host break-even: typically attractive at sustained API spend of $1–5K/mo; depends on workload and infra costs.

---

## OpenAI

| Model | Input $/MTok | Cached Input | Output $/MTok | Source | Verified |
|---|---|---|---|---|---|
| GPT-5.4 nano | 0.20 | 0.02 | 1.25 | developers.openai.com | 2026-05-31 |
| GPT-5.4 mini | 0.75 | 0.075 | 4.50 | developers.openai.com | 2026-05-31 |
| GPT-5.4 | 2.50 | 0.25 | 15.00 | developers.openai.com | 2026-05-31 |
| GPT-5.5 (baseline) | 5.00 | 0.50 | 30.00 | developers.openai.com | 2026-05-31 |
| GPT-5.5 pro | 30.00 | — | 180.00 | developers.openai.com | 2026-05-31 |

**Notes**
- Prompt caching is automatic on GPT-4o+ models. Cached input at 10% of base rate.
- Batch API: 50% off, 24-hour turnaround, separate enqueued-token quota.
- Regional residency adds ~+10% for models released March 2026+.
- `reasoning_effort` parameter on reasoning-capable models (low/medium/high).
- GPT-5.5 pro is excluded from the candidate set in v0.1 (premium tier; mostly out of scope for cost optimization).

---

## Anthropic

| Model | Input $/MTok | Cache Hit | Output $/MTok | Source | Verified |
|---|---|---|---|---|---|
| Claude Haiku 4.5 | 1.00 | 0.10 | 5.00 | platform.claude.com | 2026-05-31 |
| Claude Sonnet 4.6 | 3.00 | 0.30 | 15.00 | platform.claude.com | 2026-05-31 |
| Claude Opus 4.5 / 4.6 / 4.7 / 4.8 | 5.00 | 0.50 | 25.00 | platform.claude.com | 2026-05-31 |
| Claude Opus 4.1 (legacy) | 15.00 | 1.50 | 75.00 | platform.claude.com | 2026-05-31 |

**Notes**
- Opus 4.5 through 4.8 share the same price; the catalog uses Opus 4.8 as the canonical entry.
- Opus 4.7+ uses a new tokenizer that may consume up to 35% more tokens for equivalent text. Factor into cost comparisons when migrating from 4.6 or earlier.
- Prompt caching is explicit; two TTLs: 5-min (write 1.25× base, read 0.1×) and 1-hour (write 2× base, read 0.1×).
- `effort` parameter unique to Claude: low / medium / high / xhigh / max. Affects all tokens (text + tool calls + thinking).
- Batch API: 50% off, usually <1 hour turnaround.
- Residency: `inference_geo: "us"` adds 1.1× multiplier for Opus 4.6+ and Sonnet 4.6+.
- Fast mode is 2–6× standard pricing — excluded from v0.1 cost paths.

---

## Google Gemini

| Model | Input $/MTok | Cached Input | Output $/MTok | Source | Verified |
|---|---|---|---|---|---|
| Gemini 3.5 Flash-Lite | 0.25 | 0.025 | 1.50 | ai.google.dev | 2026-05-31 |
| Gemini Flash 3.5 | not enumerated in reference doc — **omitted from v0.1** | — | — | ai.google.dev | — |
| Gemini Pro 3.1 | not enumerated in reference doc — **omitted from v0.1** | — | — | ai.google.dev | — |

**Notes**
- v0.1 includes only Gemini Flash-Lite because it is the only Gemini model with explicitly documented per-MTok pricing in the reference doc. Add Flash and Pro to the catalog once verified pricing is captured.
- Four pricing tiers exist (Standard / Batch / Flex / Priority). Batch and Flex both ~50% off. Priority is 1.8× premium.
- Context caching is a strength — both implicit (auto on 2.5+) and explicit (manual TTL).
- Google Search grounding: 5K prompts/month free, then $35/1K queries.

---

## Microsoft Foundry

Foundry hosts OpenAI models with the same per-token pricing as direct OpenAI plus three additional capacity-buying options. Catalog entries `foundry-gpt54-mini` and `foundry-gpt54` are listed separately because they expose:

- **Provisioned Throughput (PTU)**: fixed hourly capacity, cheaper than pay-per-token above ~60–70% utilization. Cached tokens **free** on PTU.
- **EU residency** options not present on direct OpenAI.
- **Priority Processing** (premium per-token, low-latency SLA).
- **Developer Tier** (cheapest, no SLA, fine-tuning eval only).

| Deployment | Per-token cost vs Standard | When to use |
|---|---|---|
| Global Standard | 1.0× | Default starting point |
| Global Batch | 0.5× | Bulk processing |
| Provisioned (PTU) | Fixed hourly | Consistent high-volume |
| Priority Processing | premium | Revenue-critical low-latency only |
| Developer Tier | ~0.3–0.5× | Eval workloads, no SLA |

PTU economics are surfaced as a recommendation note when `throughput=steady`, rather than modeled as a distinct price (capacity sizing is workload-dependent).

### Microsoft Phi-4 Family (SLMs)

Microsoft's own small language models, available on Azure AI Foundry as serverless API and as open weights for self-hosting (MIT license).

| Model | Input $/MTok | Output $/MTok | Params | Context | Source | Verified |
|---|---|---|---|---|---|---|
| Phi-4 mini | 0.075 | 0.30 | 3.8B | 128K | azure.microsoft.com/pricing | 2026-05-31 |
| Phi-4 | 0.125 | 0.50 | 14B | 16K | azure.microsoft.com/pricing | 2026-05-31 |
| Phi-4 mini reasoning | 0.08 | 0.32 | 3.8B | 128K | azure.microsoft.com/pricing | 2026-05-31 |
| Phi-4 multimodal instruct | 0.08 | 0.32 | 5.6B | 128K | azure.microsoft.com/pricing | 2026-05-31 |

**Notes**
- **Only Phi-4 mini and Phi-4 are included in the v0.1 catalog.** Reasoning and multimodal variants are documented for reference but omitted because: (a) reasoning models' thinking tokens inflate costs unpredictably, and (b) multimodal pricing involves image token conversion rates not yet modeled.
- **Open-weight (MIT license)** — both models can be self-hosted. Break-even depends on GPU costs vs API spend; typically attractive above ~$500–2K/mo sustained API spend given the small model sizes.
- **Phi-4 mini competes directly with Ministral 3B** at tier 1: cheaper input ($0.075 vs $0.10) but more expensive output ($0.30 vs $0.10).
- **Phi-4 competes with Mistral Small 4** at tier 2: slightly more expensive input ($0.125 vs $0.10) and output ($0.50 vs $0.30), but with Microsoft enterprise support and Azure ecosystem integration.
- Prompt caching is not documented for Phi-4 models on Foundry serverless; `cache` flag is `false`.
- Batch API is available through Foundry's batch processing pipeline.

---

## Cohere

Excluded from v0.1 generation-cost candidate set. Cohere is positioned as a retrieval/rerank provider; its cost play is *architectural* (rerank → reduce candidates before sending to a generation model elsewhere). Surface as an architectural recommendation in v0.2 when context size is large and retrieval is in scope.

- **Embed 4**: ~$4–5/hr dedicated.
- **Rerank 4**: filter top-K results before LLM generation; documented as yielding 90%+ reduction in tokens sent to expensive generation models.
- **Enterprise Model Vault**: dedicated instances $5–10/hr.

---

## Composite-discount math

The decision engine stacks discounts in this order:

```
effective_input  = (1 − cache_hit_rate) * base_input + cache_hit_rate * cached_input
effective_output = base_output

if async_eligible_for_batch:
    effective_input  *= 0.5
    effective_output *= 0.5

effective_input  *= residency_premium    # 1.0 or 1.1
effective_output *= residency_premium

# Effort lever reduces output token *consumption* by ~35% rather than the per-token rate
output_tokens_effective = monthly_output_M * (effort_applied ? 0.65 : 1.0)

monthly_cost = effective_input * monthly_input_M + effective_output * output_tokens_effective
```

The 35% effort reduction estimate comes from the reference doc's "30–70% savings on reasoning models" claim, taking the conservative end. A future calibration step (with paired evals) should sharpen this.

---

## Caveats for the researcher

1. **All pricing is provider-published list price.** Negotiated enterprise rates, committed-spend discounts, and credit programs are not modeled.
2. **Long-context surcharges** (some OpenAI/Gemini models charge 2× input above a context threshold) are flagged as a context-size note but not algorithmically priced. Add to v0.2.
3. **Self-host costs** (Mistral open-weight models) are not modeled — only the eligibility filter is. v0.2 should add a GPU-cost calculator (e.g. estimating per-token equivalent for A100/H100 throughput).
4. **The Anthropic tokenizer change (Opus 4.7+, +35% tokens)** is not yet reflected in the cost math. Add as a model-level multiplier when migrating workloads from Opus 4.6 or earlier.
5. **Foundry PTU sizing** requires a separate model (PTU/hr × hours/mo vs pay-per-token monthly). Surfaced as a note in v0.1.
