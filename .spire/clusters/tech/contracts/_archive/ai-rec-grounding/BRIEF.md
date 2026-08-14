# ai-rec-grounding — brief

Goal:            Every number the AI recommendation asserts must resolve to a computed field the app
                 owns — a bundle value, a candidate-contract quote, or the rec's own echoed input —
                 verified **server-side at serialization**, before the browser ever renders it as
                 fact. Today exactly ONE assertion class is verified: `rec_inputs/cited.rs` matches
                 the contract the rec names against the candidate set under a closed
                 `CitedState { cited | right_undetermined | off_set | none }`, and
                 `rec_inputs/cap_check.rs` checks the parsed `max_risk` against the user's cap.
                 Every other asserted figure — `exit_plan.stop`, `exit_plan.target`,
                 `position_size`, and any price/level the prose names — is rendered verbatim from
                 the model with nothing comparing it to a number we computed. This feature
                 GENERALIZES the shipped `cited` mechanism from the named contract to every asserted
                 number: each one resolves, or it is not rendered as fact (dropped, or carried as an
                 explicitly unverified state — the PM/UX call at council). It also folds in the
                 measured `max_risk` prompt defect below, because that is the same surface and the
                 same session.

Decision impact: A fabricated strike, stop or target is a **wrong trade**, not a cosmetic bug — the
                 trader sizes and places against a number the app presented as computed. Observed
                 three ways, all without reading code: (1) a scripted hallucinating provider (the
                 `ScenarioLLMProvider` registry behind `AI_REC_SCENARIOS_ENABLED`) asserts levels
                 that exist nowhere in the bundle, and the rendered card shows them refused or
                 marked unverified rather than as fact; (2) on a real rec, every rendered figure is
                 traceable to a named source; (3) `cap_check` resolves to a real verdict on a rec
                 whose `max_risk` prose the model wrote — the V10 harness measured
                 `cap_check: not_checkable` on **4 of 4** after-arm trades because
                 `max_risk.rs` returns `NotParseable` whenever the prose names two *different*
                 dollar figures in one sentence. The parser is right; the prompt is what changes.

Feasibility:    pass — and **re-grounded UP at this gate**. The 2026-07-16 backlog entry predates
                 `tradeable-rec-inputs` (shipped 2026-08-13) and describes this as greenfield. It is
                 not. Verified in code this gate: `apps/api/src/services/rec_inputs/`
                 (`cited.rs` · `cap_check.rs` · `field_reasons.rs` · `max_risk.rs` · `digest.rs`)
                 is the verification seam, already shaped exactly right — a private-field `CitedKey`
                 with no partial constructor, a closed serialized state enum, one parse for one
                 consumer, and `RecField { MaxRisk | PositionSize | ExitTarget | ExitStop }` already
                 enumerating the four fields that need this. `field_reasons.rs` today explains only
                 **absence** (`NotGiven`/`Unavailable`); it does not verify **presence**. That is the
                 gap, and it is an extension of a live module rather than a new subsystem.
                 FE precedent also in hand: `ai-rec.risk.spec.tsx` §1 already guards "Levels in play
                 is bundle-sourced, never LLM-sourced" — the instinct exists, un-generalized.
                 No new vendor call, no new data dependency.

Effort:          M

Invariant watch: `ai-asserted-numbers-are-traceable` — its **FIRST instance**; the key sits on the
                 DECISION_LEDGER watch list at **0 instances**, deliberately unpromoted as
                 aspirational ("an aspirational rule is not canon", 2026-07-16 canon review). It
                 promotes on ship, on evidence.
                 `absent-is-not-none` (HARD) — verified / unverified / not-applicable is a
                 **three-state**, never a boolean, and the distinction must survive to the client
                 render; a number we never checked must not read as a number we checked and passed.
                 `structural-over-prose-enforcement` (watch list, 3 instances) — the traceability
                 rule must be enforced by construction, not by a prose note the next rec field
                 forgets; poison the guard and the build must go red.
                 `digested-labels-not-raw-dump` — a verification state is a closed wire token the FE
                 renders through a lookup; never re-derived client-side from the raw figures.
                 `additive-keeps-score-byte-identical` (HARD) — the rec is a one-way leaf; entry
                 gate / `opportunity_score` / `opportunity_tier` / `state_fingerprint` stay
                 byte-identical.
                 `best-effort-isolated-or-null` — a verification failure degrades the rec surface
                 alone, never an HTTP error, never the bundle or SSE.
                 `model-read-carries-its-assumptions` · `no-real-order-path` (sizing context only,
                 never execution) · `theme-token-discipline` (any new FE state treatment).
                 **Explicitly NOT reopened:** the `max_risk` parser's two-different-figures
                 ambiguity rule. It is by design and correct. The fix is the prompt, never a parser
                 loosening — recorded at `tradeable-rec-inputs` GATE S and binding here.

Context tags:    ai,prompt,strategy,glossary,architecture,backend,api,ui
                 (`personas` deliberately OMITTED — it is the tag on the 530-line §6 feature-state
                 section, so including it loaded 971 of 1110 lines and defeated the sharding. The
                 rec is persona-conditioned, but the council needs the AI/prompt seam and the
                 architecture, not the whole feature inventory.)

Source:          BACKLOG §B `ai-rec-grounding` (RAISED 2026-07-16, canon review, owner agreed) +
                 OPEN_THREADS §7ad deferred seam `rec-prompt-single-figure-max-risk` (measured 4/4
                 at the V10 before/after run, 2026-08-13). Pre-registered as the strongest successor
                 by the 2026-08-12 GATE I ("now strictly MORE valuable post-ship — the rec asserts
                 more numbers to trace") and by the 2026-08-13 RESUME overlay, which directed this
                 gate to **re-test rather than inherit** that judgement. Re-tested and CONFIRMED,
                 with the feasibility read revised upward (see above).

Considered:      ai-rec-grounding (CHOSEN — Value H · Effort M; only candidate whose failure mode is
                 a wrong trade rather than a degraded or slower one; feasibility re-grounded UP;
                 promotes a 0-instance watch key on real evidence) ·
                 rec-prompt-single-figure-max-risk (FOLDED IN, not culled — S-sized, same surface,
                 and the cap check IS a traceability check; splitting it means touching the rec
                 twice) ·
                 score-lab-b0b-outcomes (culled: sequencing — S-sized and genuinely valuable, but it
                 measures the composite `opportunity_score`, a different judgment from the AI rec,
                 and its cells need weeks of diary accumulation regardless; strongest runner-up,
                 pick next if a backend fast-path is wanted. Needs `MASSIVE_API_KEY` at run time;
                 **never synthesize outcomes** — if the key is unavailable the item waits) ·
                 degradation-visibility (culled: Value M–H but decision-impact N/A — operational
                 correctness, not a trading decision; grew more valuable this ship since
                 tradeable-rec-inputs added several nullable best-effort fields, so it rises next
                 cycle) ·
                 ci-standing-red (culled: real and corrosive — a standing-red CI trains everyone to
                 ignore it — but decision-impact N/A, machine-integrity class; pairs naturally with
                 the ports-free item as a single hygiene batch) ·
                 ports-free-is-ipv4-only + the :8000 orphan rewriting `data/scan.json` (culled:
                 decision-impact N/A, but note it bit **two** QA passes on the last feature, one of
                 which had to rename a running binary to get a trustworthy measurement; batch it
                 with ci-standing-red) ·
                 S5c SSE connection ceiling (culled this cycle, flagged rising: the last genuine
                 MEDIUM from the security review and the one that can take the single live container
                 down — it stopped being theoretical when the app went live in production;
                 decision-impact N/A, availability class) ·
                 split-decision-log (culled: Value re-assessed M at the 2026-08-06 gate and that
                 holds — outcome-ledger's reader unions both durable logs and de-dupes, so no
                 evidence is being lost today; remains a store-integrity + migration hazard) ·
                 market-backdrop ETF-proxy reshape (culled: Value H and buildable in-tier via
                 SPY/QQQ + SMH — index data is `NOT_AUTHORIZED` and must NOT be re-probed — but it
                 conditions reads rather than correcting a false one) ·
                 ledger checkpoint X4 (BLOCKED: needs N≥20 closed outcomes via owner habit N2; not
                 schedulable) ·
                 sticky condensed header / ticker input ergonomics (culled: Value M, UX-polish
                 class) ·
                 signed-out-refused-affordances (culled: owner-displaced to L4 — it only matters
                 when strangers use the app) ·
                 responsive-layout device review (not a feature — owner chore, needs a real phone) ·
                 V7 evening quote-fill (not a feature — conductor/owner chore, one run in a
                 20:00–23:00 ET window against the shipped harness; response ladder pre-committed in
                 the archived SPEC §7) ·
                 auth-schema-migrations (culled: Value M, and correctly scheduled alongside the next
                 real Postgres exercise rather than standalone).
