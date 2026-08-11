# broker-option-grouping — brief

Goal:            The broker book renders every option leg as its own row, so a ticker held as a
                 multi-leg structure reads as N unrelated single-leg `partial` positions with no
                 combined cost. Collapse a ticker's option legs into ONE expandable row carrying a
                 **netted entry cost** and a leg count, expandable to today's per-leg rows
                 unchanged. **The group is NEVER named a structure.** Webull supplies no
                 strike/expiry/right on `/account/positions` (§7z, settled fact — `symbol` is the
                 bare underlying), so *grouping by underlying is a FACT* while *calling it a
                 vertical is a GUESS*.
                 **⚠ CORRECTED 2026-08-06 at council R2 — this BRIEF's original framing was factually
                 wrong, and the correction STRENGTHENS the rule.** The claim "the owner's real book
                 pairs cleanly today (4 apparent verticals + 1 lone NVDA call)" is false; it was
                 inherited from `OPEN_THREADS.md` §7z and `RESUME.md`, both of which repeat it.
                 Measured directly from the captured book
                 (`apps/api/tests/fixtures/broker/positions_raw.json`) at this gate: **14 holdings —
                 5 equity rows + 9 option legs — splitting TSLA 3 · AAPL 2 · META 2 · NVDA 1 ·
                 PLTR 1**, i.e. **3 groups + 2 lone legs**, not 4 groups + 1. And TSLA's three legs
                 are **+10 / −4 / +4** — mismatched sizes. So a qty+opposite-side pairing heuristic
                 does not merely become wrong "the day two same-sized spreads sit on one ticker":
                 **it would mis-pair the owner's ACTUAL book today.** The rejected alternative is
                 not a future hazard, it is a present one. (Note AAPL carries both an equity row and
                 a 2-leg option group — the equities-excluded ruling has a live instance.)
                 The netted figure must inherit the
                 existing withheld-state discipline — if ANY leg's cost basis is `not_supplied`,
                 the group's net entry goes to its withheld literal, never a partial sum and never
                 0. Upgrades automatically to real structures if a contract-detail lookup ever
                 lands (§7z R7: `/trade/instrument` is LIVE but echoes — a parameter/entitlement
                 question for Webull, NOT a proven ceiling).

Decision impact: Improves the **position-management read on the real book** — what risk am I
                 actually carrying on this name, and what did it cost me net. Today a 2-leg NVDA
                 position shows as two rows with two per-leg costs and no combined basis, so
                 "am I up or down on this trade" requires mental arithmetic against a figure the
                 app declines to compute. Observed: the owner's live 13-position book renders its
                 option legs as ~5 ticker groups instead of 9 loose rows; each group's netted
                 entry cost matches hand arithmetic (the same arithmetic the owner already
                 confirmed row-by-row at the broker-connect live verify); a group with any
                 cost-basis-less leg shows the withheld literal rather than a wrong number; and no
                 group anywhere carries a structure name.

Feasibility:     pass — FE-only, no new data. `features/trading/broker/brokerView.ts` is already
                 the pure `BrokerBook → PositionView[]` projection (no store, no React, no fetch,
                 clock injected); grouping is a pure layer over its output. Renderers exist for
                 both form factors (`BrokerPositionRow.tsx` desktop, `BrokerPositionCard.tsx`
                 mobile — **both must be covered**; §7z records `ModeledPl` already diverging
                 between them for `unrecognized`, so a desktop-only grouping would deepen an
                 existing split). Expect an empty `apps/api` diff.

Effort:          S–M

Invariant watch: `absent-is-not-none` (HARD, and the live edge of this feature) — a group is a
                 **count + a net**, never an unearned label; the five distinct not-a-number
                 literals must stay distinct through the grouping layer, and in particular the
                 broker-only fifth literal **`not provided`** (a fact the FEED never carried,
                 `brokerView.ts:NOT_PROVIDED`) must never collapse into the shipped
                 **`not recorded`** (a fact OUR record never held) or into `unavailable`. A netted
                 figure computed across legs is the classic place a boundary quietly collapses
                 three different unknowns into one blank. ·
                 `model-read-carries-its-assumptions` — the netted cost rests on the
                 **RECONSTRUCTED ×100 multiplier** (§7z, four guards, owner ruling: resolved
                 exactly 100 on all 9 captured rows, otherwise withheld and never defaulted); the
                 group's basis must stay self-describing rather than presenting a reconstructed
                 aggregate as a broker-supplied fact. ·
                 `additive-keeps-score-byte-identical` — FE-only presentation; empty `apps/api`
                 diff is the proof. ·
                 `live-vs-static-isolation` — the group's marks/P&L are live-derived (dim + offline
                 on an SSE drop), the netted ENTRY is static and keeps rendering. ·
                 `theme-token-discipline` — tokens only, dark/light parity, zero hex. ·
                 `no-real-order-path` + `single-shared-sim-entry-dialog` — untouched: this is a
                 read surface, it opens no entry flow. ·
                 `loss-free-durable-migration` — expected NOT to bite (broker rows are not
                 persisted; `brokerView` never touches a `convexa.*` key). If a durable UI-pref
                 key (e.g. per-group expand state) is introduced, it binds.

Context tags:    frontend,ui,features,state,conventions

Source:          `OPEN_THREADS.md` §7z "Deferred seams (named, not built)" — the first-named seam
                 off the broker-connect live verify, owner-chosen 2026-08-05 straight off using
                 the feature against their own book. Harvest source = **usage friction** (the
                 owner is the user). `BACKLOG.md` roadmap queue item 3.

Open ruling to   §7z records an UNRULED item that sits on exactly the rows this feature
settle at R3:    restructures: **`Build reassessment` renders on `partial` option rows carrying
                 `position: null`.** Grouping changes what a "row" is for those legs, so the
                 ruling should be settled here rather than re-touching the same surface twice.
                 Route it as a council R3 **product** conflict to the owner (one question), not as
                 an architect call.

Considered:      broker-option-grouping (CHOSEN — owner pick 2026-08-05 off live usage friction;
                 FE-only, unblocked, seam already named and shaped) ·
                 vol-normalized-gex / X2 (culled-for-now: the strongest decision-impact item in the
                 pool — the independent backtest found raw GEX had no predictive power while
                 vol-normalized did — but it is a heavier GATE-M math track and the roadmap's own
                 next-in-line; the owner deliberately slotted the small live-usage item ahead of
                 it one day ago. **Not dropped — the next big rock**) ·
                 split-decision-log (culled: **re-assessed downward at this gate.** The §B entry
                 reads as an evidence-leak emergency, but outcome-ledger's reader already
                 **unions both durable logs and de-dupes**, so the ledger is not losing evidence
                 today. Remaining harm is store-split integrity + a migration hazard, Value M, not
                 the emergency the entry implies) ·
                 distance-to-spot on the key levels (culled: best raw value/effort in §B — Value H
                 · Effort S — but not off the live-usage signal; **the strongest small alternative
                 if a quick win is wanted over X2**) ·
                 ai-rec-grounding (culled: Value H and a liability item, but no AI-touching feature
                 is in flight; promotes `ai-asserted-numbers-are-traceable` on its first instance) ·
                 alerts v1 / X3 (culled: queued behind X2; needs a delivery-mechanism decision) ·
                 scanner-market-hours-gate (parked: only bites once deployed, and N1 deploy has not
                 run — do it before the scanner's first deploy, not before) ·
                 degradation-visibility (parked: operational, Value M–H, no concrete pull yet) ·
                 auth-schema-migrations (parked: schedule alongside the next real Postgres exercise) ·
                 M-2 2018-CA-bundle + M-5 (parked: security-review Mediums, triaged non-blocking,
                 transport-layer) ·
                 responsive-layout (parked: needs an owner device review to finish. The §B entry's
                 "exists ONLY on this machine — never pushed" alarm is **STALE** — verified at this
                 gate: `origin/feat/responsive-layout` exists at `a7b92eb`, identical to local,
                 0 ahead / 0 behind. §B corrected) ·
                 SnapTrade adapter (blocked-on: L4 external users) ·
                 signed-out-refused-affordances (already displaced to L4)
