# score-lab-signal-comparison — brief

Goal:            The weekly score-lab answers one question per run — how well `opportunity_score`
                 ranks large moves — and the 2026-08-11 slice says it fails (AUC 0.467, lift@top10
                 0.17, Pearson ≈ −0.02). **⚠ CORRECTED 2026-08-12 (GATE C, S2 verification):** the
                 original wording here said "the same slice also shows `structure_event` ranking
                 almost perfectly (AUC 0.932)". **That is wrong and it propagated into the spec
                 before being caught.** `structure_event` is a **LABEL**, not a signal, and has no
                 AUC of its own. All three figures in the deep dive's global table are the SAME
                 candidate — `opportunity_score` — ranked against three different labels:
                 `large_abs_move` 0.467 · `up_move` 0.569 · `structure_event` 0.932. The doc's own
                 prose settles it ("Top-score rows hit wall/flip path labels almost perfectly").
                 The true finding is sharper than the error: **the composite score ranks structure
                 events almost perfectly while ranking large moves worse than chance — one
                 candidate, two labels, opposite outcomes** — and since the score is largely built
                 from proximity to the walls and the flip while `structure_event` means price
                 reached a wall or crossed the flip, that 0.932 is substantially **definitional
                 coupling**, not predictive power (SPEC AC-76 marks it). The per-symbol
                 correlations that INVERT (SPY +0.51 vs QQQ −0.31) were found **by hand for the
                 write-up**, not produced by the tool — that part stands.
                 Make the lab **comparative and per-symbol by default**: score a named set of
                 candidate signals — `opportunity_score`, vol-normalized GEX magnitude, and level
                 geometry (distance-to-flip / distance-to-wall) — against the same KPI on the same
                 slice, always split by symbol as well as pooled. The diary is accumulating daily;
                 every week the lab runs non-comparatively is a week of data that answers only the
                 question we already know the answer to.
Decision impact: Improves the meta-decision gating every other one — **which of our own signals
                 deserves trust**. Today a score change is unarguable in either direction: we know
                 the composite fails on one thin window and nothing else has ever been ranked.
                 Observed when the weekly report carries an AUC / lift@top10 / precision /
                 calibration row **per candidate signal per symbol**, so a proposal under
                 `[score-change-is-deliberate-and-measured]` can be argued or refuted on evidence
                 instead of asserted. Direct prerequisite for roadmap gate X4.
Feasibility:     pass — verified in code at this gate, no new capture and no vendor call.
                 `StructureSample` (`apps/api/src/services/scanner/store.rs:73-134`) already carries
                 `score`, `score_drivers`, `net_gex`, `atm_iv`, `hv_30d`, `iv_hv_ratio`,
                 `dist_to_flip_pct`, `dist_to_wall_pct`, `flip`, `call_wall`, `put_wall` — every
                 candidate signal below is derivable from captured fields. `score_lab.rs` already
                 computes AUC, lift@top10, precision@top10 and calibration bins for one scalar; the
                 work is generalizing that to a named set and grouping by symbol. Vol-norm reuses the
                 shipped `libs/quant-engine/src/vol_gex.rs` formula (ATM-IV-preferred, HV fallback)
                 over the captured scalars rather than re-deriving it.
Effort:          S–M
Invariant watch: `[score-change-is-deliberate-and-measured]` — this feature MEASURES ONLY. It
                 changes no weight, constant, gate threshold or fingerprint basis; ranking a
                 candidate signal is not adopting it, and no result here authorizes a score change
                 on its own (the deep dive's own bar: multi-day / multi-week first).
                 `[additive-keeps-score-byte-identical]` — `opportunity_score` / `opportunity_tier` /
                 `state_fingerprint` stay byte-identical; the lab is a read over captured diary rows,
                 never a second transform.
                 `[operator-vs-trader-path-separation]` — research CLI + artifacts stay OFF every
                 trader/bundle route, read-only and side-effect-free (no vendor fetch, no recompute,
                 no cache mutation).
                 `[model-read-carries-its-assumptions]` — every reported metric carries its horizon,
                 window, sample count and basis (which vol scalar was used; which label was scored).
                 The current doc's hand-written "not a product ruling" hedge should become a property
                 of the output, not a human preamble a reader may skip.
                 `[absent-is-not-none]` — "n=0 because no sample carried the input" must not render
                 identically to "computed, no effect". The driver-attribution cells failed exactly
                 this way in the 2026-08-11 run: every cell read `n = 0` and only a hand-written note
                 explained why.
                 `[best-effort-isolated-or-null]` — a sample missing one candidate's inputs is
                 excluded from that candidate's row and **counted**, never silently zeroed.
                 Vol-norm GEX stays a **magnitude** read and is never folded into the score without
                 its own deliberate score-changing feature (`X2_VOL_NORMALIZED_GEX_STATUS.md` §"Do
                 not"). Ranking it here is explicitly not adopting it.
Context tags:    backend,engine,signals
Source:          `docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md` §"What it *does* justify" items 2
                 and 3, plus `docs/research/X2_VOL_NORMALIZED_GEX_STATUS.md` §"Suggested remaining
                 work" item 2 ("add optional `net_gex_vol_norm` (and basis) onto structure samples
                 for score-lab/structure labs"). The `docs/ROADMAP_2026-08.md` queue is drained above
                 X4, which this unblocks.
Considered:      score-lab-signal-comparison (CHOSEN — the only candidate whose value decays weekly
                 while the diary accumulates, S–M, backend-only, unblocked, and named by the freshest
                 evidence in the repo) ·
                 tradeable-rec-inputs Tier 1 items 1+2+3 — candidate contract quotes/greeks, account/
                 risk block, expected move (culled: strongest PRODUCT candidate and it passes the
                 decision-impact test emphatically, but Effort M–L/XL, needs a full council, and item
                 1 carries a live tension with `[digested-labels-not-raw-dump]`. Deferred on
                 SEQUENCING, not merit: it enriches the inputs feeding a headline judgment whose
                 ranking value was just measured as unestablished. Runner-up — pick this next, or now
                 if the owner wants product over measurement) ·
                 ai-rec-grounding — every AI-asserted number traceable to a computed field (culled:
                 Value H and it passes the cull, but it is a GUARD on rec numbers that largely cannot
                 be filled with real values until tradeable-rec-inputs lands; sequence it with or
                 after that item, not before) ·
                 score-drivers-capture-integrity (culled: RE-ASSESSED DOWN at this gate — the deep
                 dive's "autonomous follow-up (code)" is **already satisfied in current code**.
                 `projection.rs:126` populates `score_drivers` from signals, `store.rs:129`
                 `from_row` copies them into the sample, `pg_scan.rs:426` persists them, and
                 `store.rs:944 structure_sample_carries_score_drivers` tests it — all landed
                 2026-08-10 in `13656ad`. The null cells in the 2026-08-11 run are **older captures**,
                 which the doc itself hedged and which must not be repaired. Genuine residual is one
                 S-sized piece: nothing logs when an ok row yields null drivers, so nobody can tell a
                 pre-fix row from a live regression. Fold that log into this feature) ·
                 sticky condensed ticker header (culled: last gate's runner-up and still the best
                 Ticker UX quick win, but improves no trading decision directly — UX-polish class) ·
                 ports-free-is-ipv4-only (culled: real and it silently degrades every run-the-app
                 verification gate, but tooling class, Effort S — do it in passing, not as a feature) ·
                 vol_regime display gap (culled: Value M-low, a GATE-V quick win) ·
                 auth-schema-migrations (culled: infra, no trigger yet — the next ordered/stateful
                 Postgres change is the honest trigger) ·
                 scanner holiday calendar (culled: `classify_session()` still has no holiday calendar
                 so a market holiday sweeps as its weekday; cost-class, Effort S) ·
                 Phase-2 SEO prerender (culled: actionable but reach/marketing class, and the owner
                 deferred the public-facing track 2026-08-01) ·
                 HORIZONTAL SCALE stages 1–3 (blocked-on: a second replica or genuine concurrent
                 users — no decision impact at one user; its safety half, the S5c SSE ceiling, is the
                 only piece that protects the container that exists today) ·
                 ledger checkpoint X4 (blocked-on: N≥20 closed outcomes via owner habit N2, which the
                 owner deferred 2026-08-01 — this feature is the other half of what X4 will need) ·
                 market-backdrop (blocked-on: index data `NOT_AUTHORIZED`; a separate asset-class
                 subscription, NOT a tier upgrade — do not re-probe) ·
                 gamma-unification (blocked-on: the owner-decided measurement spike first).
