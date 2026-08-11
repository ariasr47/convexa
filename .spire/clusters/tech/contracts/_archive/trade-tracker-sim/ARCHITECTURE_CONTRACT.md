# ARCHITECTURE CONTRACT — Ghost-Trade Tracker · AI Reassessment · Opportunity Escalation

> Producer: Architect (this session, **PM-first** — the PM ran first; I validate buildability and
> set the constraint envelope). Consumer: UX/Tech-Writer (next), then Interface/Backend/Frontend.
> Reader has only `.claude/GAMMAFLOW_CONTEXT.md` + `PRODUCT_CONTRACT.md` + this file. No chat history.
> Lane: data-structure *content*, data-flow, component boundaries, isolation/error rules, seams,
> non-goals. **No UI/layout, no endpoint signatures, no payload/JSON field names, no copy, no
> product re-scoping.** The PM's "Product decisions made here" are treated as given.

## Verdict
**Buildable** on the current vendor and architecture, with **one bounded provider-port amendment**
(surface the option's NBBO quote) and **two acceptance-criteria amendments bounced to the PM**
(live P/L is a *modeled mark*, not a real live option price; "Reassess" returns via the external-AI
boundary, not a guaranteed in-app LLM call). All four future-dated seams are specifiable now without
building them.

---

## Binding constraints restated (must not be violated)
**Math invariants**
- **Gamma sourcing unchanged** — vendor gamma for profile/walls; analytic BS gamma *only* for the
  flip ±20% grid. This feature **adds no gamma source** and alters none of: gamma, flip, walls, peak
  GEX, max pain, PCR, VWAP, HV.
- **Rates/greeks model unchanged** — r = 4.5%, dividend yield q, `MIN_GREEK_T = 1/365` floor stay
  as-is. The new per-contract *option-price* mark (below) reuses these and the **cached snapshot IV**
  under the **same fixed-IV-under-spot-move assumption already used by the flip search**
  (GAMMAFLOW_CONTEXT §9); it is an isolated helper that does not touch the protected structures.
- **DTE/expiration-filter scope unchanged** — the filter shapes gamma structure only; max pain & PCR
  stay full-chain. **A tracked contract keeps tracking regardless of the current filter window**
  (its stats are selected from the full snapshot, not the filtered view).

**Product invariants**
- **Dark-pool/off-exchange stays context-only** — capped, toggleable, no directional "smart money."
  Nothing here converts off-exchange data into a trade or reassessment signal.
- **Live-vs-cached isolation is law** — heavy analysis rides the ~60s cached REST bundle; only light
  live values stream over SSE. Trade **record + analysis** ride the cached/durable lane and **never
  blank** on a live drop; **live P/L** rides the live lane and **degrades independently**. Cold-start
  (no successful load ever) remains the *only* blank-screen condition.
- **Honest live-vs-stale** — never present a frozen mark/P-L as live; reuse `live`/`market_session`.
  **No overnight (8 PM–4 AM ET) data** — P/L and alerts freeze honestly overnight.
- **External-AI contract intact** — GammaFlow defines the contract + gate and **does not call an
  LLM**. Reassessment fits this model via a boundary (Q3); GammaFlow assembles the request and
  ingests a structured verdict.
- **Over-trading guard is binding** — all new emphasis, prompts, and alerts inherit the
  "actionable AND changed", de-duped, material-change-only discipline. Accept/reject is always
  user-gated; nothing auto-executes.
- **Single-ticker, on-demand** — no watchlist/portfolio scan.

---

## Feasibility answers (every item, in order)

**Q1 — Live per-contract option price.** There is **no true per-option live stream** today (the live
lane streams only the *underlying* NBBO/flow/flip; per-contract greeks/IV come from the ~60–120s
chain snapshot). Buildable honest source = a **two-part anchored mark**:
- **Anchor (truth):** the option's **NBBO mid from the chain snapshot** — *requires the port
  amendment below* (the snapshot already carries an option `last_quote`; we are not fetching extra).
  This is the entry fill basis (consistent with the PM's "fill = option mid") and the re-anchor point
  every chain refresh (~120s in the live session).
- **Between snapshots (estimate):** re-price the tracked contract at the **live underlying mid** using
  its cached greeks (delta primary; gamma optional) / BS with cached IV, re-anchored to the latest
  snapshot mid. This is a **modeled mark, clearly labeled as an estimate**, exact at each snapshot.
- Fallback when a vendor lacks an option quote: BS-theoretical from cached IV, labeled as such.
- ⇒ See **Amendment A**: the continuous live P/L is this modeled mark, not a real traded price.

**Q2 — Stream isolation with a per-option value.** **No new subscription.** The server keeps the
existing single live SSE session per ticker, streaming the **underlying mid** as today. The
**tracked-contract mark + P/L are computed client-side** from (live underlying mid over SSE) +
(tracked contract greeks/IV/snapshot-mid from the cached lane). The generic live session holds **no
per-user trade state**, so a trade value can never destabilize the existing live tiles, and the
mark degrades exactly with the underlying-mid stream (one isolation surface, unchanged).

**Q3 — Reassessment round-trip.** This phase does **not** make GammaFlow an LLM caller. Define a
**reassessment boundary** (a port): `request → structured verdict`. GammaFlow's responsibility is to
**assemble the position-aware request** (open trade + current market_state + decision-history digest,
an *extension* of the existing external-AI hand-off — same gate/glossary/strategy-prompt family) and
to **ingest a structured verdict object** and drive accept/reject. The phase-1 implementation of the
boundary is the **existing external hand-off** (structured request out via the same artifact/hand-off
mechanism as the strategy prompt; structured verdict in). Whether the round-trip is synchronous
depends entirely on the operator's own AI integration behind the boundary — out of GammaFlow's scope.
A future direct-LLM or webhook integration implements the *same* boundary. ⇒ See **Amendment B**.

**Q4 — Trade-state persistence.** Server stays **stateless/on-demand**. The **client-local durable
store** (browser persistent storage) is the **v1 system of record** for the ghost trade + decision
history (single-user, single-ticker, no real money). It survives reload (persisted) and a live-feed
blip (independent of SSE). Schema is **versioned + exportable** (load-bearing for Q13/back-test). The
record is structured so it can later be persisted server-side *without schema change* (broker/replay
seams). The trade record lives on the **durable lane**, never on the live failure surface.

**Q5 — Trade-aware gate semantics.** Add a **parallel position-aware evaluation** (a sibling of
`ai_eval`, computed only when a trade is open) that **reuses the existing fingerprint/dedupe
primitive** (`state_fingerprint` coarsening + "changed") over a **position-aware fingerprint**
(held contract's relation to walls/flip, P/L band, DTE band, tier). It does **not** overload the
entry gate's "is there an entry edge" semantics — it's a separate surface on the same machinery, so
the existing over-trading dedupe stays intact and the entry gate is unchanged.

**Q6 — Alert evaluation locus & cadence.** **Split by input lane, both edge-triggered once-per-event:**
- **Bundle-class events** (tier change, gate/position fingerprint flip, DTE-threshold, wall/flip
  *re-derivation*): evaluated **per cached bundle (~60s)** via the position-aware fingerprint; the
  alert fires once when the relevant fingerprint component changes (reuses "changed").
- **Live-class events** (price crosses a wall/flip using the **live mid**, P/L hits target/stop):
  edge-detected **client-side** at the SSE throttle (~1.5s) against durable thresholds (walls/flip
  from the bundle; target/stop from the trade record), with an **armed/fired** edge state so each
  crossing fires once, not per tick.
- **No alert fires while `live=false` / overnight / closed** (alerts require fresh inputs).

**Q7 — Opportunity tiering source.** **Reuse; no new score.** Derive
**Dormant → Watch → Actionable → Prime** from the existing `opportunity_score` (operator-config
bands over `GATE_SCORE`) + `ai_eval.ready` (Prime additionally requires *actionable*) + `ai_eval.
changed`/fingerprint (escalation/prompt fire on a **material change into a higher tier**, de-duped —
not while the score merely sits high). Bands are config, not set here.

**Q8 — P/L refresh vs the 60s cache.** **Two-lane coexistence, no extra vendor load:** the analysis
bundle stays ~60s cached (unchanged); P/L feels live by riding the **existing SSE underlying mid**
(~1.5s throttle) with client-side greeks interpolation; the option's true NBBO mid re-anchors only at
the **chain-refresh cadence already running in the live session (~120s)**. So P/L is sub-60s-fresh
off the underlying tick without hammering the vendor or breaking the cache. The mark's honesty is its
label: estimate between snapshots, exact at anchor.

**Q9 — Roll mechanics for a sim.** **No new fetch** (blocks precedent): the replacement contract's
mark/greeks are **selected from the same chain snapshot already fetched** — close the current ghost,
open the replacement, both marked from the snapshot. **Named constraint:** Roll is limited to a
contract **present in the current chain snapshot** (normal expiries/strikes are). If the verdict
names a contract absent from the snapshot, the Roll is deferred/rejected until the next refresh
prices it (minor edge; not a product blocker).

**Q10 — Future broker-swap seam.** Define an **execution/position boundary** (port): open / close /
adjust / mark all go through a `FillSource` + `PositionStore` abstraction. **Phase-1 has exactly one
implementation — the simulator** (mid-mark, no order). The tracking/AI/alert layers depend only on
the abstraction (position state + marks), never on "sim vs real". A future broker adapter implements
the same boundary. **Guardrail honored:** phase-1 ships **no real-order code path at all** — the seam
is an interface with a sim-only implementation.

**Q11 — Back-test replay seam.** Define a **bundle-source abstraction** (`BundleFeed`: live vs
replay-of-historical-`market_data.json`+signals+strike_profile) **and a clock abstraction** (a
supplied "now"). The tracker/decision logic consumes **(bundle, now)** — never the live feed
directly — so trade/decision logic is **identical live vs replay**. Phase-1 ships only the live
implementation; replay drops in behind the same seam. Determinism (PM "Design-for") follows: given
the same bundle sequence + same accept/reject choices + supplied clock, the P/L and decision trail
are reproducible (no hidden wall-clock/live-timing dependence).

**Q12 — Reassessment in replay.** **Depends on Q3 + Q10/Q11 seams; not resolved this phase.** In
replay the **same reassessment boundary** is satisfied by **recorded/cached verdicts keyed per step**
(or a callable hook). Flagged dependency: replay reassessment is blocked on (a) the reassessment
boundary being implemented and (b) a recorded-verdict store; both deferred. The seam (boundary is
replay-pluggable) is specified now so replay isn't precluded.

**Q13 — Decision-history schema durability.** **Confirmed sufficient** if each append-only record
captures (content, not field names): event type (open/close/accept/reject/alert/roll); **clock**
timestamp (supplied "now"); full contract identity (ticker, expiration, strike, right, qty); mark
price **+ basis flag** (snapshot-anchor vs estimate vs theoretical); underlying spot; P/L $ and %
at the event; AI verdict + a stable verdict id (nullable); user choice (nullable); the tier +
position fingerprint at the time; and a **schema version**. With these, a later back-test can score
AI-assisted vs hold-only vs no-AI edge **without re-instrumenting**. This completeness is a **v1
requirement** (cheap now, load-bearing later).

---

## Amendments bounced to PM (un-buildable-as-written ACs → closest buildable form)
**Amendment A — "P/L updates as price moves" implies a live option price that does not exist.**
- *Criterion:* AC "while the market is live, the panel's % and $ P/L update as price moves" (and Q8
  "P/L should feel live").
- *Why un-buildable as implied:* there is no per-option live NBBO stream; only the underlying streams
  live, and the option NBBO mid is only as fresh as the ~120s chain snapshot.
- *Closest buildable:* P/L is a **modeled mark** — snapshot option NBBO mid (exact at each chain
  refresh) **re-anchored**, with a **greeks-based estimate off the live underlying mid between
  snapshots**, **clearly labeled as an estimate** (no hidden-realism claim, consistent with the
  honest-live-vs-stale invariant). *PM to accept the "modeled/estimated mark" framing in copy.*

**Amendment B — "A 'Reassess' action returns a recommendation" implies an in-app synchronous LLM
call.**
- *Criterion:* AC "with a trade open, a 'Reassess' action returns a risk-first recommendation."
- *Why un-buildable as implied:* GammaFlow does not call an LLM (external-AI invariant). It cannot
  *guarantee* a synchronous in-app verdict on click.
- *Closest buildable:* "Reassess" **emits a structured position-aware request** through the
  reassessment boundary and **surfaces the verdict when it arrives** (immediate iff the operator has a
  live integration behind the boundary; otherwise operator-mediated). The accept/reject + decision-
  history machinery is **fully in-app and unconditional**. *PM to accept that round-trip synchrony is
  an operator-integration property, not a GammaFlow guarantee.*

---

## Data structures (content only — names/JSON are downstream)
- **GhostTrade** (durable, client-local): contract identity (ticker, expiration, strike, right),
  side = long, qty, entry mark + basis, entry clock-time, status (open/closed), current mark + basis
  + freshness, realized P/L on close.
- **TrackedContractStats** (cached lane, selected from snapshot, **filter-independent**, no new
  fetch): current option mid/bid/ask, greeks, IV, DTE remaining, strike-vs-spot/walls/flip distances.
- **ReassessmentRequest** (assembled): open trade + current market_state + decision-history digest,
  conforming to the extended external-AI hand-off.
- **Recommendation** (ingested): verdict ∈ {Hold, Trim, Add, Exit, Roll}; replacement contract (Roll
  only); rationale; stable verdict id.
- **DecisionRecord** (append-only, exportable, **versioned**): the Q13 content set.
- **PositionEval** (sibling of `ai_eval`): position-aware coarse fingerprint + `changed` (alert
  dedupe), present only when a trade is open.
- **OpportunityTier**: derived label (Dormant/Watch/Actionable/Prime) + Prime-prompt eligibility.
- **AlertEvent**: type, triggering value, clock-time, once-per-event edge state.

## Provider-port amendment (the one required vendor change)
- Add an **optional option NBBO quote** (bid/ask, hence mid) to the per-contract option contract in
  the provider port. The Massive/Polygon chain snapshot already carries `last_quote`; the adapter maps
  it — **no new request**. Engine/consumers treat it as **optional**: absent ⇒ mark falls back to
  BS-theoretical (labeled), never an error. Every adapter must honor the field (vendor-agnostic port).

## Data-flow & component boundaries
- **Durable lane (client-local store):** GhostTrade + DecisionRecords. Never blanked on SSE drop;
  survives reload; exportable.
- **Cached/bundle lane (REST ~60s):** TrackedContractStats, PositionEval, OpportunityTier, bundle-
  class alert fingerprints — all selected/derived from the **already-fetched snapshot**.
- **Live lane (SSE, existing single session):** underlying mid → **client** computes interpolated
  mark + P/L + live-class alert edge-detection. Degrades independently (stale/offline), freezes
  overnight.
- **Reassessment boundary:** request assembled from durable + cached lanes; verdict ingested;
  accept/reject **mutates the durable store + appends a DecisionRecord**. No auto-apply.

## Isolation & error-handling rules
- **Additive + best-effort:** any failure in tracking/reassessment/alerting → that area shows
  "unavailable"; the **GEX chart, stats, and rest of the dashboard render normally**. Cold-start
  remains the only blank screen.
- **Live P/L follows SSE isolation:** stale/offline flag, keep last value, **never frozen-as-live,
  never blank**; self-heals on feed return (no manual refresh).
- **Trade record is never on the live failure surface** (durable lane).
- **No alert on stale/overnight/closed** (`live=false` / overnight session).
- **Server stays stateless;** the generic live session carries no per-trade state (isolation by
  construction).
- **Add cap is binding** (over-trading): "Add" qty increase is capped per the product invariant.

## Design-for seams (specify, don't build)
1. **Execution/position boundary** (Q10) — `FillSource` + `PositionStore`; sim-only implementation
   this phase; broker adapter later; **no real-order path now**.
2. **Bundle-source + clock abstraction** (Q11) — tracker consumes `(bundle, now)`; live impl only
   now; replay impl later; determinism guaranteed by the supplied clock.
3. **Reassessment boundary** (Q3/Q12) — `request → verdict`; external hand-off impl now;
   recorded-verdict/replay + future direct-LLM impls later.
4. **Versioned exportable DecisionRecord** (Q13) — stable, complete for later edge scoring.

## Non-goals (architect lane)
- No UI/layout, endpoint signatures, payload/JSON field names, or copy.
- No real-broker order path (sim-only); no LLM caller; no auto-execution.
- No new gamma source; no change to gamma/flip/walls/peak/max-pain/PCR/VWAP/HV; no new BS repricing
  of those structures (the per-contract mark is an isolated helper).
- No per-option live stream; no multi-leg/spreads/short/multiple concurrent trades/portfolio P/L.
- No commissions/slippage/taxes/assignment modeling.
- No overnight data; no server-side trade store in v1 (client-durable); no back-test engine, replay
  driver, or external notifications (seams only).

## Open questions for downstream (UX / Interface)
- UI representation of tiers/emphasis, the "estimate vs anchor" mark label, the simulated-trade
  labeling, the alert surface, and accept/reject controls (UX).
- Endpoint signatures, payload/field names, the option-quote wire shape, `PositionEval`/tier wire
  shape, the reassessment request/response schema, and the DecisionRecord export format (Interface).
- Glossary entries: the modeled-mark caveat, position-eval semantics, tier definitions, and the
  reassessment hand-off extension (Tech-Writer).
