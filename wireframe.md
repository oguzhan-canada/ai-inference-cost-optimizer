# Wireframe — One-Page UI

This document is the design intent for `index.html`. It captures the layout, the hierarchy of attention, and the why behind each block — so a future contributor can refactor the visuals without losing the product logic.

---

## Aesthetic direction

**Editorial-financial, dark.** Bloomberg terminal vocabulary (mono numerals, decision trace, tabular figures) softened with editorial typography (Instrument Serif headlines, italic prose tagline). The tool is for AI Platform Leads who read engineering blogs *and* defend budgets — it should feel as serious as a finance dashboard but as legible as a magazine.

Explicitly avoided: SaaS-marketing gradients, generic AI purple, Inter as the body face, bullet-point feature lists, hero illustrations.

**Color tokens** (see `:root` in `index.html` for the actual values):

```
bg          #0d0c0a   warm near-black
surface-1   #15140f   panel
surface-2   #1c1a14   raised
border      #2c2922   subtle separator
text        #ebe7df   warm off-white
accent      #d4a259   muted gold — recommendation, savings
warn        #c66b3d   burnt sienna — baseline/expensive
ok          #7fa37a   sage — passed checks in trace
```

**Type stack:**

```
display:  Instrument Serif (italic for emphasis)
body:     Geist
data:     JetBrains Mono (tabular figures)
```

---

## Top-level layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  FinOps · AI    v0.1 prototype          pricing · 2026-05-31                  │
│                                          providers · 5                        │
│  AI Inference Cost Optimizer             models · 16                          │
│  "Optimize cost without sacrificing      ● rules engine ready                 │
│   enough quality to matter."                                                  │
├──────────────────────────┬───────────────────────────────────────────────────┤
│                          │                                                   │
│  ● WORKLOAD              │  ● RECOMMENDED PATH                               │
│                          │  ┌──────────────────────────────────────────────┐ │
│  01  Task type           │  │  Mistral / Mistral Small 4                   │ │
│  [dropdown]              │  │  Cheaper because: right-sized to a smaller   │ │
│                          │  │  tier · most input served from cache.        │ │
│  02  Latency             │  ├──────────────────────────────────────────────┤ │
│  [dropdown]              │  │ FRONTIER       RECOMMENDED      SAVINGS      │ │
│                          │  │ $1,100/mo      $16/mo           $1,084/mo    │ │
│  03  Reuse pattern       │  │ GPT-5.5...     effective        98% off      │ │
│  [dropdown]              │  ├──────────────────────────────────────────────┤ │
│                          │  │ ▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│  04  Context size        │  │ $0    recommended · $16    baseline · $1,100│ │
│  [dropdown]              │  └──────────────────────────────────────────────┘ │
│                          │                                                   │
│  05  Quality bar         │  ● COST LEVERS APPLIED                            │
│  [dropdown]              │  ┌──────────────────────────────────────────────┐ │
│                          │  │ 01  Right-sized model         −99% base     │ │
│  06  Compliance          │  │     Smallest model that meets...             │ │
│  [dropdown]              │  │ 02  Prompt caching            −56% input    │ │
│                          │  │     70% of input tokens served from cache    │ │
│  07  Throughput          │  └──────────────────────────────────────────────┘ │
│  [dropdown]              │                                                   │
│                          │  ● DECISION TRACE                                 │
│  08  Monthly volume      │  STEP 1  rules engine init    → 16 models        │
│  [in M]   [out M]        │  STEP 2  latency = realtime   → real-time path   │
│                          │  STEP 3  quality=production   → tier ∈ [2,3]     │
│                          │  …                                                │
│                          │                                                   │
│                          │  ● TOP ELIGIBLE CANDIDATES                        │
│                          │  Provider  Model        Tier  In/M  Out/M  Mo    │
│                          │  Mistral   Small 4      T2    $0.10 $0.30  $16   │
│                          │  Mistral   Large 3      T3    $0.50 $1.50  $80   │
│                          │  …                                                │
│                          │                                                   │
│                          │  [ Export JSON ]  [ Copy summary ]               │
└──────────────────────────┴───────────────────────────────────────────────────┘
   sticky on desktop                  scrolls
                                                                                
   ─────────────────  footer: methodology note, links to docs  ──────────────
```

**Grid:** `380px | 1fr` two-column on desktop. Collapses to single column below 920px viewport. Form panel becomes static (no longer sticky) on mobile to avoid awkward partial scrolling.

---

## Visual hierarchy

The page enforces a strict three-tier visual hierarchy that mirrors the decision flow:

1. **The verdict** — top of the right column. Largest type on the page. Gold accent. Cheaper-because sentence in italic serif. The user should know the answer at a glance.

2. **The numbers** — three-cell cost grid (Frontier / Recommended / Savings), with a horizontal cost bar underneath. Mono numerals, tabular alignment. Savings cell glows gold. Baseline cell uses subtle strikethrough.

3. **The reasoning** — Levers, then trace, then alternatives. Each in its own bordered panel. Progressively more technical as you scroll. The levers panel is for the platform lead's defense ("here's why we're paying less"). The trace is for the engineer ("show me the rules that fired"). The alternatives table is for the analyst ("what else was close?").

The form panel on the left stays sticky on desktop so the user can perturb inputs and watch the result update in real time. This is critical to the product's positioning — it's a *decision* assistant, not a one-shot recommender.

---

## Interaction model

- **Live recompute** on every input change (`change` and `input` events). No "Calculate" button.
- **Subtle entrance animations** on first paint — staggered lift on the right-column panels (45ms cascade). Subsequent updates do not re-animate (would feel jittery).
- **No router, no shareable URL state in v0.1.** Use the JSON export to capture a scenario. v0.2 should add query-string state.
- **Two export paths**: full JSON (modal with copy + download) and short summary (clipboard, for Slack/ticket paste).

---

## Decorative restraint

- A single ambient radial-gradient warmth on the body background — not a "glow," just a hint of light from the top-left.
- The verdict block has one bright accent: a top-right gold radial that fades into the panel. Subtle. Reinforces the "this is the answer" framing without overwhelming.
- No icons. The type system carries the hierarchy. The serif italic does the emotional work; the mono does the precision work.
- Numerical badges (`01`, `02`, …) on form labels and lever items establish a typographic rhythm without crowding the content.

---

## Accessibility commitments (v0.1, partial)

- Form `<label>` elements wrap their controls or use explicit `for` linkage (currently the `<label>` precedes the control inside `.field` — refactor to explicit `for`/`id` linkage in v0.2).
- Colour contrast: `--text` on `--bg` is well above 7:1. `--accent` on `--bg` is ≈6:1 (passes AA for large text; flag for AA on small text).
- No motion-reduced media query yet — v0.2 should respect `prefers-reduced-motion` and skip the entrance animations.
- Keyboard navigation: native form behaviour works; focus rings on selects/inputs use the accent gold border. Verify on tab traversal before shipping externally.
- Screen reader: the decision trace block uses no list semantics today; v0.2 should mark it up as an `<ol>` for assistive tech.

---

## What's deliberately missing from v0.1

- A request-rate / per-call token-mix configurator (just monthly totals today).
- A "what if I changed *one* input" comparison view (would help A/B reasoning).
- Persistence (no localStorage in v0.1 — the brief asks for export, not storage).
- Multi-language. UI strings are English-only.
- Brand customization. CSS variables make this a one-edit job but no UI surface for it yet.
- Per-provider deep links into pricing pages from the recommendation block.

Each is a v0.2 candidate.
