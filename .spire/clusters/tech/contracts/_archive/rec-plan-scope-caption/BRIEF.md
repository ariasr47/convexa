# rec-plan-scope-caption — brief
Goal:            Close the surviving half of `ai-rec-grounding` SPEC §9.5: a produced-trade
                 recommendation still lets a reader infer *"no clause means checked"* onto stated
                 plan fields (`Structure`, `Strike(s)`, `Expiration`, `Entry trigger`,
                 `Time horizon`, `Confidence`) because only stop / target / invalidation carry
                 grounding clauses. Ship **one section-level caption** with the plan row (or on
                 the analysis surface that now holds the long form — `DecisionCard.tsx` + the
                 drawer/sheet from `ai-rec-decision-card`) stating those plan fields are not
                 checked. Pattern already shipped: `REASONING_PROSE_NOT_CHECKED` in
                 `pages/ticker/widgets/ai-rec/copy.ts`. **Must not become standing chrome** on the
                 `local_rules` path — `recommendation.rs:841-849` still emits `decision: trade`
                 with `strikes: []`, `expiration: null`, and a **stated** `structure` /
                 `entry_trigger` / `confidence` whenever a setup exists (the exact always-on
                 condition that cut this caption on line-budget at `rec-absence-literals-hole`).

Decision impact: A trader who sees a checked stop/target/invalidation and a bare stated
                 structure or trigger can treat the plan as verified and enter or size on a field
                 nobody checked. That is a **wrong trade**, the same class as the last two
                 AI-grounding ships (asserted numbers, then omitted numbers). **Observed by:** an
                 LLM-produced `trade` rec with a grounding clause on a risk/exit field and a
                 stated unchecked plan field shows exactly one section-level caption; a
                 `local_rules` rec does not grow a permanent banner; the reserved no-entry `—`
                 is unchanged. After this ships, §9.5 may be recorded closed — **not before**.

Feasibility:     pass — **frontend-only, `NO_BACKEND_CHANGE`.** `key_source` already rides the
                 rec payload, so the caption can stay off the local-rules path without a wire
                 change. Placement is a council/GATE-V call (pinned plan row vs analysis
                 drawer); the copy pattern and the closed plan-field vocabulary already ship.
                 Re-grounded this gate: the `{dteMin ?? '?'}` / containment-caption seam from
                 §7af is **already closed** in `dteWindowCaption` (both bounds required; wording
                 is a property of the request, not a containment claim). Do not re-open it here.

Effort:          S  (one caption, one placement, existing copy idiom; the hard part is the
                 local-rules exclusion, not new UI)

Invariant watch: `ai-asserted-numbers-are-traceable` (**HARD — this is the omission/halo half
                 the key now also covers**: an absent check must not render as a reserved
                 literal of another state, and must not be inferable as "checked") ·
                 `absent-is-not-none` · `digested-labels-not-raw-dump` (do not invent a new
                 per-field marker or re-derive a label from a scalar) · the caption states a
                 **scope boundary**, never a per-rec diagnosis of why a field is bare ·
                 `theme-token-discipline` · `single-motion-moment` (no new animation) ·
                 `additive-keeps-score-byte-identical` (copy-only; empty `apps/api` diff) ·
                 `cited-code-is-verified-not-assumed` (watch-list — cite
                 `DecisionCard.tsx` / `copy.ts` / `recommendation.rs`, not the Python-era
                 `AiRecPanel` line numbers from older backlog rows)

Context tags:    frontend,ui,ai

Source:          OPEN_THREADS §7af / §7ah named residual; `rec-absence-literals-hole` SPEC §9
                 item 5 half two (binding record rule: do not record §9.5 closed while this
                 stands); UX R1 at that council (`REASONING_PROSE_NOT_CHECKED` pattern);
                 future-dated when the caption was cut on line-budget (decisions.md §C #17/#23).

Considered:      rec-plan-scope-caption (CHOSEN — the only survivor whose failure mode is a
                 **wrong trade**; it is the named residual of the last two AI-grounding ships;
                 the decision-card layout is new placement evidence, but the local-rules
                 always-on condition is **unchanged** and binds the design) ·
                 sse-connection-ceiling / S5c (culled: decision-impact **N/A**, availability
                 class — **re-tested, not inherited**. `docs/TECH_DEBT.md` marks S5c resolved
                 at `86adf3b`, but that commit touched `apps/api/main.py` +
                 `src/core/live.py` (Python, now under `archive/api-python/`). Live Rust
                 `config.rs` never reads `MAX_LIVE_SESSIONS` / `MAX_LIVE_SUBSCRIBERS`; they
                 sit unused in `apps/api/.env.example`. `routes/stream.rs` caps symbols per
                 request at 120, not concurrent subscribers. **Still open on the live single
                 container.** Strongest N/A-class candidate; do not pick a backend feature
                 until `project-context-s2-is-python-era` is repaired) ·
                 degradation-visibility (culled: decision-impact **N/A**, operational
                 correctness — **RISING 4th consecutive gate**. Still cannot win the cull.
                 Queued for an owner override rather than a fifth re-derivation) ·
                 project-context-s2-is-python-era (culled: system-of-building, **N/A** — still
                 unpaid; 23 Python-era markers in `PROJECT_CONTEXT.md` §2. Do not bundle. Fix
                 before the next backend feature; own reviewable diff) ·
                 score-lab-b0b-outcomes (culled: **N/A** until N accumulates; never synthesise
                 outcomes; still needs `MASSIVE_API_KEY` at run time) ·
                 hygiene batch — ci-standing-red + ports-free-is-ipv4-only +
                 cargo-fmt-whole-crate-drift + :8000 orphan (culled: tooling **N/A**.
                 `ci-standing-red` **weakened**: HEAD `593f601` CI Frontend succeeded
                 2026-08-16; the item stays until a dedicated pass retires it) ·
                 project-context-shard-sizes (culled: system-of-building **N/A** — discovery
                 pack again elided the Pool, 1173 lines, and the Ledger, 601 lines; escape
                 hatch used) ·
                 split-decision-log (culled: **CLOSED this gate** — `model/store.ts` is
                 read-only legacy; write paths deleted at the v3 cutover. Stale pool row) ·
                 signed-out-refused-affordances (culled: **SHIPPED 2026-08-10** —
                 IMPROVEMENT_BACKLOG 5.1, `shared/ui/Refused`. Stale "displaced to L4" row) ·
                 DTE-window `?` / containment caption (culled: **CLOSED** in
                 `ai-rec-decision-card` — `dteWindowCaption` requires both finite bounds) ·
                 roadmap X4 ledger checkpoint (culled: **not yet a build item** — still gated
                 on N≥20 closed outcomes; remains the next edge-program gate) ·
                 volume-profile POC/CVD (culled: real decision-impact but Effort M and not
                 pulled; do not jump the residual the last two ships named) ·
                 sticky condensed header (culled: UX-polish **N/A**) ·
                 responsive-layout / §5.6 (culled: blocked-on owner device sign-off)
