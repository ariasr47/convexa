# tradeable-rec-inputs — brief
Goal:            Close the AI recommendation's missing-input gap (Tier 1 of the 24-item program,
                 items 1+2+3): (1) expose candidate option quotes/greeks for a bounded ±15% strike
                 band via a dedicated endpoint the AI pulls deliberately (NOT on the bundle — the
                 chain snapshot already carries OI + Δ/Γ/Θ/V + IV + per-contract NBBO, so this is
                 re-exposure at serialization, no new vendor fetch); (2) an owner-entered
                 account/risk block (account size, per-trade risk cap) plus open-positions context
                 so `max_risk`/`position_size` can be filled with real numbers (sizing CONTEXT only
                 — never execution); (3) expected move from the ATM straddle, computed from the
                 chain already in hand, self-describing (window/basis). Outcome: the rec's output
                 schema (`max_risk`, `position_size`, `exit_plan.target`, `exit_plan.stop`) becomes
                 fillable with bundle-traceable numbers instead of structurally unanswerable.
                 Binding framing carried from the source analysis: better inputs should mostly make
                 `no_trade` BETTER-ARGUED, not convert it to trades — if adding fields suddenly
                 makes everything a trade, something is wrong.
Decision impact: Entry/exit/sizing on the owner's own trades — the difference between an advisory
                 prose rec and an actionable, risk-sized one. Observed: the rec cites candidate
                 quotes / expected move / the risk block in its output; `no_trade` verdicts argue
                 from liquidity and expected-move facts; the outcome ledger records rec-driven
                 entries whose sizing traces to real numbers.
Feasibility:     pass — conductor triage 2026-07-27 (recorded in BACKLOG §C, code-verified): no new
                 vendor spend; the chain snapshot already carries OI + greeks + IV + NBBO; daily
                 bars already extended to 400 sessions. The cost is exposure + payload shape, not
                 API quota. Item 1 likely needs its own endpoint (bundle-size + AI-context-window
                 pressure). NOTE for the council: the backend is Rust (`apps/api`, Axum/Tokio) —
                 any `.py` path cited in older pool notes is the retired tree.
Effort:          M–L (Tier 1 scoped as one feature; items individually S–M)
Invariant watch: additive-keeps-score-byte-identical (HARD — every field is AI-context/display,
                 never a scoring/gate/fingerprint input) · best-effort-isolated-or-null ·
                 digested-labels-not-raw-dump (item 1 is in DIRECT TENSION — a ±15% band across
                 expirations approaches the raw dump the rule forbids; the recorded resolution is a
                 dedicated endpoint the AI pulls deliberately, not bundle payload — the council must
                 hold this line) · model-read-carries-its-assumptions (expected move carries its
                 window/basis/sample and is advisory, never a forecast) · no-real-order-path
                 (item 2 is sizing context; no broker, no order/execution surface) ·
                 absent-is-not-none (no-NBBO vs not-computed vs not-entered are distinct states
                 carried to the consumer) · live-vs-static-isolation (each new datum declares
                 live-derived vs static) · server-side-gate-enforcement (if the risk block is a
                 per-user server-side setting, its write gate is server-enforced).
Context tags:    architecture,data,ai,features
Source:          BACKLOG §C `tradeable-rec-inputs` (owner-supplied downstream-AI analysis
                 2026-07-27 + conductor viability triage) · named "pick it next" runner-up at
                 GATE I 2026-08-11 (b).
Considered:      tradeable-rec-inputs Tier 1 (CHOSEN — the 2026-08-11 sequencing deferral was
                 re-tested and OVERTURNED: the score lab measures the composite
                 `opportunity_score`, while these items feed the AI REC — a different judgment,
                 measured by the outcome ledger, not the lab; the lab's own question needs weeks of
                 diary accumulation regardless, and idling the strongest product candidate behind
                 it serves nothing) · score-lab-b0b-outcomes (RUNNER-UP — S-sized, unlocks V3b and
                 the lab's full-power cells, but needs MASSIVE_API_KEY present at run time; queue
                 as the next quick backend fast-path) · ai-rec-grounding (culled: Value H but
                 strongest AFTER rec-inputs exist — more asserted numbers to trace; natural
                 successor) · index-first-defaults N3 (REMOVED from the cull set: SHIPPED +
                 ARCHIVED 2026-08-01 — the resume claim "still Not started" was stale, inherited
                 from the un-updated roadmap doc) · X4 ledger checkpoint (blocked-on N≥20 closed
                 outcomes — owner habit N2) · degradation-visibility (culled: operational-
                 correctness class, no trading decision named this round) · ports-free-IPv6 +
                 :8000-orphan fix (culled: tooling chore, cull N/A — stays flagged to owner) ·
                 sticky-condensed-header (culled: UX polish, below Tier 1) ·
                 signed-out-refused-affordances (stands DISPLACED to L4 by owner 2026-08-01) ·
                 horizontal-scale (premature by its own trigger — no second replica; the S5c
                 ceiling already shipped 2026-07-28) · gamma-unification spike (culled: reopens
                 locked core-math canon; the measure-first spike is a deliberate owner initiation)
                 · market-backdrop reshape (owner-deferred, parked) · monetization de-risking +
                 vendor decision (blocked-on owner decisions, not builds).
