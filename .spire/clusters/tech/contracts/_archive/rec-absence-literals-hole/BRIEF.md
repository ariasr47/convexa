# rec-absence-literals-hole — brief

Goal:            Six fields on the AI recommendation card render a bare `—` when the model omits
                 them: `Structure`, `Strike(s)`, `Expiration`, `Entry trigger` (code-verified at
                 `AiRecPanel.tsx:1081,1084,1090,1100`) plus `Time horizon` and `confidence`
                 (`:1153,:1158` — **two more than the backlog entry named**). `—` is **reserved
                 vocabulary**: the card's `no_trade` branch defines it as *"No entry, so there is
                 nothing to size."* All six sit in the **trade** branch, so today a card headed
                 **`Trade · long`** can print `Strike(s): —` — the no-entry literal on a card that
                 just told you to enter. Route all six through the shipped `fieldLiteral` closed
                 lookup (`literals.ts:50`) so an omission renders an in-vocabulary literal
                 (`not given` / `unavailable` / `not set`) distinct from the no-trade `—`, and
                 extend the backend's `RecField` enum so the wire carries a reason token for them.

Decision impact: A trader reading `Trade · long` with `Strike(s): —` cannot tell **"the model never
                 named a strike"** from **"no strikes apply."** The first is a rec you must not act
                 on; the second is a rec with nothing to act on. Acting on a silently-omitted strike
                 or expiration is a wrong trade in a real position — the same failure class
                 `ai-rec-grounding` shipped to close for *asserted* numbers, left open for
                 *absent* ones. **Observed by:** force a `trade` verdict whose `structure` /
                 `strikes` / `expiration` / `entry_trigger` are omitted upstream — each field renders
                 its own in-vocabulary literal, and the reserved `—` appears nowhere outside the
                 `no_trade` branch. Closes `ai-rec-grounding` SPEC §9.5's named halo residual: a
                 reader can no longer generalize "no grounding marker = checked" from the marked
                 fields to these six, which carry no marker, tint, clause or tooltip.

Feasibility:     pass — **but as BOTH LANES, not the FE-only display fix the backlog entry implies.**
                 Re-grounded in code this gate (the standing "backlog code references go stale" rule,
                 which has now bitten three times): `apps/api/src/services/rec_inputs/field_reasons.rs:5`
                 defines `RecField { MaxRisk | PositionSize | ExitTarget | ExitStop |
                 InvalidationLevel }` — the risk/exit fields only. **No reason token exists on the wire
                 for any of the six structure/context fields**, so the frontend cannot distinguish an
                 omission from anything else without a backend addition. Both sides are extensions of
                 live modules, not new subsystems: the backend widens an existing enum + its
                 serializer; the frontend re-points six call sites at a closed lookup that already
                 ships in the same file and is already spec'd, tested (`literals.spec.ts`) and
                 canon-bound. Line numbers in the 2026-08-13 backlog entry (`753/1044/1053/1063`) are
                 **stale** — the file moved to `pages/ticker/widgets/ai-rec/`.

Effort:          S–M  (backend S: one enum + its emit path · frontend S: six call sites, no new
                 component and no new copy pattern · the sixth-field discovery and the wire addition
                 are what lift it off a bare S)

Invariant watch: `absent-is-not-none` (**HARD — this is the rule the defect violates**: "we do not
                 know" must not collapse into "we checked and there is nothing," enforced in the
                 **type or the closed vocabulary, never in prose") · `digested-labels-not-raw-dump`
                 (the wire token stays authoritative; the browser must **never re-derive** a literal
                 by testing a null — `fieldLiteral` switches on the token, and the six new call sites
                 must too) · `structural-over-prose-enforcement` (the closed `FieldLiteral` union is
                 the enforcement; poison it — reintroduce a bare `?? '—'` — and a scan must go red,
                 and that scan must be proven non-vacuous) · `theme-token-discipline` (tokens only,
                 dark/light parity) · `additive-keeps-score-byte-identical` (display + wire-reason
                 only; `opportunity_score` / `opportunity_tier` / `state_fingerprint` byte-identical,
                 and the rec is not a scoring input) · `best-effort-isolated-or-null` (a missing
                 reason token degrades to a literal, never an HTTP error) ·
                 `ai-asserted-numbers-are-traceable` (**watch-list key, 1 instance** — this feature is
                 its second: grounding covered the numbers the AI *asserts*, this covers the ones it
                 *omits*. See the queued canon question below.)

Context tags:    frontend,ui,ai

Source:          BACKLOG §B `rec-absence-literals-hole` (NEW 2026-08-13 — raised by the UX voice at
                 `ai-rec-grounding` R1, code-verified, and **deliberately cut from that feature**),
                 pre-registered as the strongest successor by the 2026-08-13 RESUME overlay and by
                 the `ai-rec-grounding` GATE I note. Re-tested this gate rather than inherited —
                 CONFIRMED, and its scope revised UP (six fields, both lanes).

Considered:      rec-absence-literals-hole (CHOSEN — the only survivor whose failure mode is a wrong
                 trade rather than a slower, dimmer or unmeasured one; small; closes the just-shipped
                 feature's own named residual; binds to a promoted canon key whose enforcement
                 machinery already ships in the target file) ·
                 score-lab-b0b-outcomes (culled: **decision-impact N/A** this gate — it improves no
                 trading decision until N accumulates, and it needs `MASSIVE_API_KEY` at run time,
                 which is not verified present. Unchanged from three gates running. **Never
                 synthesize outcomes** — if the key is unavailable the item waits) ·
                 degradation-visibility (culled: decision-impact **N/A**, operational-correctness
                 class — the cull cannot promote it. **Flagged RISING for a third consecutive gate**
                 and it grew again this ship: `ai-rec-grounding` added more nullable best-effort
                 fields to a system that still aggregates no null rates. Recorded so a later gate
                 does not re-derive this judgement) ·
                 S5c SSE connection ceiling (culled: decision-impact **N/A**, availability class —
                 but it is the last genuine MEDIUM from the security review and it stopped being
                 theoretical when the app went live; it can take the current single container down.
                 Strongest N/A-class candidate in the pool) ·
                 hygiene batch — ci-standing-red + ports-free-is-ipv4-only + cargo-fmt-whole-crate-drift
                 + the :8000 orphan (culled: decision-impact **N/A**, tooling class — though all four
                 cost the last two sessions real time, one QA pass having to **rename a running
                 binary** to get a trustworthy measurement) ·
                 project-context-shard-sizes (culled: system-of-building class — **but escalated by
                 direct evidence from this gate**: the discovery pack elided the BACKLOG **Pool**
                 (1123 lines) and the **Ledger** (575 lines) as over-budget, i.e. discovery's own
                 pack dropped the primary discovery surface and both had to be read directly. See
                 the BACKLOG note) ·
                 split-decision-log (culled: data-integrity class, decision-impact N/A — and
                 `outcome-ledger` already unions both stores and de-dupes, so the harm is bounded
                 today; the stranded-write defect stands) ·
                 market-backdrop / index-sector context via ETF proxies (culled on effort + a needed
                 fresh feasibility reshape: index data is `NOT_AUTHORIZED` and **must not be
                 re-probed**; SPY/QQQ/SMH proxies are in-tier. Effort M) ·
                 signed-out-refused-affordances (culled: **owner-displaced to L4** by the 2026-08-01
                 roadmap adoption — it only matters when strangers use the app) ·
                 responsive-layout (culled: blocked-on owner device review; the environment cannot
                 verify true phone width) ·
                 roadmap X4 ledger checkpoint (culled: **not yet a build item** — gated on N≥20
                 closed outcomes, which is not reached; it remains the next edge-program gate)
