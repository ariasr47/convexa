# PRODUCT CONTRACT — DEX · Vol/OI · IV Skew · Term Structure

> Producer: Product Manager (this session). Consumer: UX/Tech-Writer (next session).
> Input: GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md. No chat history.
> Lane: user stories, feature scope, dashboard behavior, acceptance criteria, and resolution of
> the Architect's "open questions for the PM." **No UI layout, no endpoints, no payload/field
> names, no math derivations, no thresholds-as-code** — those are downstream (UX/Interface/Eng).

## Feature & user value
A longer-dated swing trader watching a single ticker today sees dealer **gamma** structure (GEX
walls, flip, magnet) plus vol context. This feature adds four **chain-snapshot** reads that round
out the positioning + volatility picture, all riding the existing cached bundle (no new fetch, no
effect on the live stream):

1. **Net Dealer Delta Exposure (DEX)** — the delta analogue of GEX: which way dealer hedging
   *pressure* leans, aggregate and per-strike, beside the gamma profile the user already reads.
2. **Volume-to-Open-Interest (Vol/OI)** — turnover intensity: where today's option activity is
   large relative to standing positions ("fresh positioning"), per-strike and chain-wide.
3. **IV Skew** — a single "fear vs greed" slope (downside-IV vs upside-IV at the swing tenor) so
   the user can read whether the market is paying up for crash protection or for upside.
4. **Term Structure** — ATM IV across expirations (contango vs backwardation) so the user can see
   whether near-dated vol is elevated (event/stress) or calm relative to longer tenors.

Net value: a fuller positioning/vol read with **zero new noise sources** — same data, same cache,
same trust model — and richer context handed to the downstream AI. All four are framed as
**read context, not buy/sell signals**, consistent with the over-trading guard.

## User stories
- As a swing trader, I want to see **net dealer delta (DEX)** alongside net GEX so I can tell which
  way dealer hedging leans, not just how sticky price is.
- As a swing trader, I want **DEX broken out per strike on the same profile** as GEX so I can see
  where delta exposure concentrates relative to the walls and flip.
- As a swing trader, I want DEX presented as **dealer-positioning context with an explicit
  caveat**, never as a "dealers are bullish/bearish, so buy/sell" instruction.
- As a swing trader, I want to see **which strikes have unusually high volume vs their open
  interest** so I can spot fresh positioning being put on today.
- As a swing trader, I want a **chain-wide Vol/OI headline** so I can gauge overall turnover
  intensity at a glance.
- As a swing trader, I want Vol/OI clearly labeled **activity, not direction** (no side), so I
  don't read a bullish/bearish call into raw turnover.
- As a swing trader, I want a single **IV skew read** at my swing tenor that tells me whether
  downside protection is bid (fear) or upside is bid (greed/complacency).
- As a swing trader, I want to see the **IV term structure** (near vs far) labeled
  contango/backwardation so I know if near-dated vol is stressed.
- As a swing trader, I want all four to be **always available with the bundle** (no extra toggle to
  remember) and to **degrade quietly** — if one can't be computed, the rest of the dashboard is
  unaffected.
- As a swing trader, I want these to **never flicker or update from the live stream** — they are
  snapshot reads that change only when a new bundle loads, so they stay stable while I analyze.

## Scope
**In:**
- A **DEX** read: a chain-level net headline (with a gross call/put split available) **and**
  per-strike DEX on the same profile rows as GEX. Scoped to the **same DTE/expiration window as the
  gamma structure** (per the Architecture scope table).
- A **Vol/OI** read: a chain-level headline **and** per-strike Vol/OI with **per-strike "unusual"
  highlighting**. Scoped to the **full chain** (like PCR/max-pain), independent of the DTE window.
- An **IV Skew** read: a single scalar slope at one anchor tenor (nearest expiration ≥ 7 DTE), plus
  the two underlying reference IVs and the tenor used, so it is auditable.
- A **Term Structure** read: an ordered ATM-IV-by-tenor curve **plus** a scalar contango/
  backwardation state, spanning available tenors independent of the DTE window.
- **User-facing definitions** for each (what it measures, what it does *not* claim).
- **Best-effort + independent degradation:** any one metric missing → that metric only shows an
  "unavailable" state; the chart, stats, and the other three render normally.
- All four added as **downstream-AI context** (new glossary entries with caveats).

**Out:**
- **Any scoring / gate / setup wiring in v1.** None of the four touches `opportunity_score`, adds a
  setup, or affects the AI gate / `state_fingerprint`. Display + AI-context only (see Behavior).
- **Any directional "smart-money" claim for Vol/OI** — turnover intensity only, no side.
- **Any "trade this" instruction from DEX** — dealer-positioning context with caveat only.
- **Multi-session / historical** skew, term-structure, or Vol/OI **trends** — single-snapshot only.
- A **separate toggle** for these metrics (decided: always-on — see Q7).
- UI layout, component states/naming, endpoint/payload shapes, math, and threshold *values as
  shipped code* (UX / Interface / Eng own these; this contract sets the product rules they encode).

## Resolution of the Architect's open questions (binding PM decisions)
1. **Surfacing granularity (per metric):**
   - **DEX → both.** Chain-level net headline + per-strike on the existing profile (it is free in
     the same loop and the per-strike form is its main value next to GEX). A gross call/put split is
     available for the headline.
   - **Vol/OI → both.** Chain-wide headline + per-strike, with per-strike "unusual" **highlighting**
     as the primary product hook (that's where fresh positioning shows up).
   - **IV Skew → scalar headline only.** One slope + its two reference IVs + the tenor. No curve.
   - **Term Structure → curve + state.** The ATM-IV-by-tenor points (for a small chart/sparkline)
     **and** a one-word state (contango/backwardation) with the near-vs-far read.
2. **DEX framing.** Present as **"dealer delta positioning"** — a neutral magnitude + direction
   descriptor of where dealer delta hedging leans, **with a binding caveat** that it is positioning
   context, not a buy/sell signal, and that the hedging implication is indirect. **No bullish/
   bearish verdict, no "dealers are long/short so do X."** Exact wording is UX/Tech-Writer's; the
   *constraint* (neutral, caveated, non-directional-as-instruction) is binding here.
3. **Vol/OI "unusual" threshold.** Ship a **fixed, operator-tunable default**: a strike is flagged
   "unusual / fresh positioning" when its **session volume meets or exceeds its standing open
   interest** (i.e. Vol/OI ≥ 1.0) — the classic, explainable unusual-activity heuristic. A fixed
   rule (not an adaptive percentile) is predictable and easy to caption; an adaptive/percentile
   variant is documented **future work**. **Emphasis:** per-strike highlighting is the headline
   behavior; the chain-wide number is secondary context. The exact default value is encoded
   downstream but must be a **single, explainable cutoff**, not a black box.
4. **IV skew reference points.** **Accept the Architect default:** **±25-delta** (vendor delta to
   bucket), **fixed-moneyness fallback** (≈ ±5% OTM) when delta is unavailable, at the **nearest
   expiration ≥ 7 DTE** (same anchor as ATM IV). "Fear vs greed" copy rule (binding intent, exact
   words downstream): **downside IV richer than upside = "fear / downside hedging bid"**; **upside
   richer or flat = "greed / complacency / upside bid"**; near-symmetric = "balanced." Framed as a
   read of what vol is paying for, **not** a price-direction call.
5. **Term-structure display buckets.** Display **nominal 7 / 14 / 30 / 60 / 90 DTE** buckets, each
   mapped to the **nearest available expiration**; if a bucket has no nearby expiration it is simply
   omitted (never faked). The engine emits the full available curve; **display samples these five.**
   Label **upward-sloping = contango ("normal")**, **downward-sloping = backwardation ("near-term
   stress / event")**, with the near-vs-far relationship stated plainly. Exact labels/copy are UX's.
6. **Scoring / gate.** **None in v1.** All four are **display + AI-context only.** They do not feed
   `opportunity_score`, do not create setups, and do not change the AI gate or `state_fingerprint`.
   Rationale to honor downstream: the user is prone to over-trading and these are context reads;
   manufacturing a score nudge from them would create false edge. **Any future scoring of any of the
   four must be capped / confluence-only and is out of scope here** (mirrors the dark-pool rule).
7. **Toggle.** **Always-on. No new toggle, no request flag.** Unlike dark-pool, these add **no extra
   fetch** and carry **no kill-switch liability** (no separate vendor cost, no per-print side
   claim). They ride the bundle unconditionally and degrade per-metric on failure. (They are
   **not** placed under the existing dark-pool toggle either — they are unrelated to off-exchange.)
8. **Wire contract** (field names, profile-row additions, sub-objects) → **deferred to the Interface
   contract**, as the Architect specified. Not decided here.
9. **Glossary / AI contract** → **Tech-Writer must add a glossary entry per metric**, each stating
   its reliability tier and the binding caveats below (esp. Vol/OI "no side," DEX "positioning not
   instruction," skew/term "single-snapshot, no history"). Called out in "Constraints for the next
   role."

## Behavior rules (per metric)

### DEX (Net Dealer Delta Exposure)
- Shown as a **chain-level net DEX** read **and** a **per-strike DEX** series on the same profile as
  GEX, scoped to the **selected DTE/expiration window** (moves with the swing window, like GEX).
- Presented as **dealer delta positioning context**: a magnitude and a neutral directional
  descriptor of where dealer delta leans. **Binding:** it must **not** be labeled, colored, or
  captioned as a buy/sell signal or a "dealers are bullish → go long" instruction. A plain-language
  caveat that it is indirect positioning context is required.
- A gross **call/put DEX split** may be surfaced alongside the net, mirroring the call/put/total GEX
  breakdown the user already sees.
- **Best-effort:** if DEX can't be computed (e.g. vendor delta missing chain-wide), the DEX read
  shows "unavailable" and **GEX and the profile render unchanged**.

### Vol/OI (Volume-to-Open-Interest)
- Shown as a **chain-wide Vol/OI headline** plus **per-strike Vol/OI**, scoped to the **full chain**
  (independent of the DTE window — same basis as the full-chain OI, PCR, max pain).
- **Per-strike highlighting is the primary hook:** strikes whose Vol/OI meets/exceeds the
  single explainable cutoff (default ≥ 1.0, Q3) are flagged as **"unusual / fresh positioning."**
- **Binding caveat:** Vol/OI is **turnover intensity only — no side, no direction.** It must never
  be labeled bullish/bearish or "smart money." (Same caveat class as dark-pool.)
- A strike with **zero or missing OI, or no volume**, simply has **no Vol/OI** (blank, not zero, not
  flagged). Missing vendor volume chain-wide → Vol/OI shows "unavailable" and nothing else changes.

### IV Skew
- A **single scalar slope** at the anchor tenor (nearest expiration ≥ 7 DTE), with the **two
  reference IVs and the tenor/expiration** shown so the read is auditable.
- Interpreted per the **fear/greed copy rule** in Q4 — a read of **what volatility is paying for**,
  explicitly **not** a price-direction prediction.
- **Best-effort:** too few or zero-IV contracts at the tenor → skew shows "unavailable"; the rest of
  the dashboard is unaffected.

### Term Structure
- An **ATM-IV-by-tenor curve** (engine emits all available; display samples 7/14/30/60/90 DTE,
  Q5) plus a **contango/backwardation state** and the near-vs-far relationship.
- Scoped **across tenors, independent of the DTE window** (term structure is cross-tenor by
  definition — like max pain/PCR it ignores the filter).
- **Best-effort:** if too few tenors are available, show the points that exist (or "unavailable" if
  none); never fabricate a missing bucket.

### Cross-cutting behavior (all four)
- **Always-on, ride the cached bundle**, polled ~60s behind the existing freshness/`stale` flag.
  They share the **same staleness/age signaling** as the rest of the static stats.
- **Never live, never per-tick.** None updates from the SSE stream; they change **only when a new
  bundle loads.** On a live-stream drop they behave exactly like the GEX chart and other static
  stats (stay visible from the last bundle) — they are **not** "live" fields and must never be
  marked offline/stale by the live watchdog.
- **Independent per-metric degradation.** A failure in one shows "unavailable" for that metric only
  — never an error screen, never affecting GEX/profile, the other three, or the live path.
- **Display + AI-context only** in v1 (no score/gate/setup effect — Q6).

## Constraints the next role (UX/Tech-Writer) must not violate
- **No directional instruction.** DEX = neutral positioning context with caveat; Vol/OI = turnover
  with **no side**; skew/term = "what vol is paying for," not a price call. No bullish/bearish
  buy/sell verdict, color, or copy for any of the four.
- **No scoring/gate impact** is to be implied in copy or layout — these are read context, not edge.
- **Always-on, no toggle.** Do not design a toggle, a request flag, or fold them under the
  dark-pool switch.
- **Snapshot, not live.** Copy/states must present these as bundle/snapshot reads with normal
  staleness — never as live fields, never as multi-session/historical trends.
- **Per-metric "unavailable" state** is required for each; one missing metric must never read as a
  chart/bundle problem.
- **Auditability surfaces** must be preserved in the UX: skew exposes its two reference IVs + tenor;
  term structure exposes its per-tenor points; Vol/OI's "unusual" flag traces to a single
  explainable cutoff. Don't hide the inputs behind a lone verdict.
- **Glossary is mandatory:** one entry per metric stating reliability tier + the caveats above
  (Vol/OI "no side"; DEX "positioning, not instruction"; skew/term "single snapshot, no history").

## Acceptance criteria (observable without reading code)
- [ ] The bundle shows a **net DEX** read and, on the GEX profile, a **per-strike DEX** series, both
      reflecting the **currently selected DTE/expiration window** (they change when the window
      changes, in step with GEX).
- [ ] DEX is presented as **dealer-positioning context with a visible caveat**; nowhere is it
      labeled or styled as a buy/sell signal or "dealers bullish/bearish → do X."
- [ ] The bundle shows a **chain-wide Vol/OI** number and **per-strike Vol/OI**, computed over the
      **full chain** (unchanged when the DTE/expiration window changes).
- [ ] Strikes at/above the **unusual cutoff** (default Vol/OI ≥ 1.0) are **visibly flagged** as
      fresh positioning; strikes with no/zero OI or no volume show **no Vol/OI** (blank, not flagged).
- [ ] Vol/OI carries a **"no side / activity not direction"** caveat and is never labeled
      bullish/bearish or "smart money."
- [ ] An **IV skew** read appears at the **nearest tenor ≥ 7 DTE**, showing the **slope plus its two
      reference IVs and the tenor**, with fear/greed framed as "what vol is paying for," not a price
      call.
- [ ] A **term-structure** read appears as an **ATM-IV-by-tenor curve** sampled at ~7/14/30/60/90
      DTE (nearest available) **plus a contango/backwardation label**; absent buckets are omitted,
      not faked.
- [ ] All four are **present without any toggle** and obey the **existing staleness/age** signaling
      like the other static stats.
- [ ] None of the four **changes the opportunity score, creates a setup, or alters the AI gate** —
      verifiable: at a state where one would "fire," the score and gate state are unchanged from
      before the feature.
- [ ] On a **live-stream drop**, all four **stay visible from the last bundle** and are **not**
      marked offline/stale; they update **only when a new bundle loads**, never per-tick.
- [ ] If **any one metric fails to compute** for a cycle, that metric shows **"unavailable"** while
      the GEX chart, the other three metrics, and all other stats render normally.
- [ ] If the **vendor provides no per-contract volume**, **Vol/OI shows "unavailable"** and DEX,
      skew, term structure, GEX, and the profile are **unaffected**.
- [ ] Each metric has a **glossary entry** stating its reliability tier and binding caveat.
