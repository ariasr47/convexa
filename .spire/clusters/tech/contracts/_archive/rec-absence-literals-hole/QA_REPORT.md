# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| On a **trade** card where none of the six was named, each of the six slots displays an absence literal from the closed vocabulary, and `—` appears in **none** of the six. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On a **trade** card with three named and three not: the three named slots display the producer's text exactly as today and only the three unnamed slots change. A fully-specified rec renders identically to before this feature. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On a **no_trade** card the five plan fields render **no row at all** — no row, label, placeholder, skeleton, ghost or reserved mark. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| On a **no_trade** card the four risk slots render the reserved mark with copy unchanged from today. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| No absence literal from this feature renders on any of those five plan fields on a `no_trade` card — the negative-space guard against reading AC-3a as an instruction to add rows. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| The conviction chip is the single carve-out from AC-3c: on a `no_trade` card an absent conviction renders `not given` as text — **never** the reserved mark, **never** nothing. `:956-996` keeps a **zero-line diff**; `:943-944` sits outside it. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| Rendering the three conditions **through the selector** — never-stated on a trade card, candidate-set-missing on a trade card, the reserved mark on a `no_trade` risk slot — produces three **pairwise-distinct** slot strings, each legible without hover, tooltip, colour or focus. **Proven non-vacuous:** collapsing any two conditions onto one literal (e.g. pointing the sibling selector's `unavailable` arm at `not_given`) makes this check go **red**. Comparing three string constants without exercising the selector does not satisfy this row. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| With **no per-field reason information at all** (pre-feature or degraded), the card renders in full, all six slots show **`not given`**, and no slot shows `—`, an empty cell, or `null` / `undefined` / `NaN`. No error state, no HTTP failure surfaces. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| A reason token this build does not recognise renders **`not given`** — never the raw token, never blank, never `unavailable`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| A field returned as `""`, whitespace-only, or (for strikes) `[]` is treated as **not named** and shows its absence literal — not a named value rendered as a blank cell. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On an SSE drop while a rec is on screen, all six slots keep exactly what they were showing: no flip to an absence literal, to `—`, or to a dimmed/offline treatment. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| On stale / stale-born / superseded, the six are unchanged; only the existing as-of / stale strips change. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd |
| On a trade card **not** on the local-rules path missing one or more of Structure / Strike(s) / Expiration / Entry trigger, **exactly one** card-level standing line renders, stating the rec is not actionable as given and naming the missing field(s). With all four named, no such line renders. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| On a trade card that **is** on the local-rules path, **no** standing line renders however many of the four are unnamed; per-row literals still render and the shipped local-rules line is unchanged. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On a trade card whose response declares **no** grounding path at all (pre-feature or degraded) with one or more of the four unnamed, the standing line **does** render. An exemption requires an affirmative local-rules declaration; missing information is never an exemption. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| A trade card missing **only** Time horizon and/or Confidence shows the absence literal on those slots, **no** standing line, and Accept behaves exactly as on a fully-specified card. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| Accepting a trade rec whose strike was never named opens the entry surface with **no strike a single confirm can submit**: no chain-derived strike, no nearest-available snap, no zero — plus a one-line reason naming the field. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Same for expiration: no defaulted, inferred or carried-over expiration (specifically, not the first chain expiration). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Accepting a trade rec whose structure was never named produces **no option direction a single confirm can submit** — including when the rec states a `bias` — and the surface states the read named no structure. There is no structure input to leave empty, so the observable is the derived direction. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| The reason line states only that the read did not give the field. It names **no cause**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd |
| The refusal to seed keys on the **value being absent**, not on a reason token being present: a response with no reason information at all but an absent strike still refuses to seed, and the reason line says only that the read did not give it. A degraded response never becomes a blocked Accept. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| **The submit gate itself is proven, not assumed.** A draft whose strike, expiration or option direction is unstated is **rejected by the confirm control**; a fully-stated draft is accepted. **Proven non-vacuous:** removing any one conjunct from the submit predicate makes this check go **red** for that field, and the check exercises the predicate (a fully-stated draft passes in the same run). Covers the case a superficial implementation produces — a dialog that *looks* unseeded but still submits. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Accepting a trade rec whose structure, strike and expiration **were** named seeds the entry surface exactly as today, byte-identical — and opening the dialog **without** a rec prefill keeps today's nearest-strike / first-expiration / `call` defaults unchanged. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| In every state above the rec is never withheld, blanked, greyed, hidden or re-verdicted: the verdict headline for a given response is identical to today, and the producer's own words for every named field render unchanged. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| A card carrying both this feature's standing line and the shipped grounding line shows **both, never merged**, visibly distinguishable, neither restating the other's fact — and **at most two** card-level statements render on any card. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd |
| Across every state exercised by AC-1 through AC-14, `—` appears in the **rendered value slots and chip labels** of the plan fields, risk fields and conviction chip **only** on `no_trade` cards, and there only in the four risk slots. The sweep reaches those slots from their **label text** (§7 Layer 2); card-level lines, tooltips and reasoning prose are **outside the queried set by construction**, not by exemption. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Reintroducing a bare `?? '—'` at any of the six render sites makes the build go **red** in two independent places: `nx typecheck` (the typed literal) and `nx test` (the label-anchored render guard). Restoring the code makes both green. Both are demonstrated **non-vacuous** — the render guard proves it resolved **every one of its enumerated slots** (§7 Layer 2 arm (a)), and the pattern scan's poison is written in an **escaped** form. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| The distinct absence strings rendered on the card are a subset of the shipped closed vocabulary **plus exactly one addition, `unrecognized`**. No other absence word appears. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,ARTIFACT:.spire/clusters/tech/context/DESIGN_SYSTEM.md |
| The panel's existing non-rec states — unavailable, error, cooldown, daily cap, no key, signed-out — display current copy unchanged, and no absence literal from this feature appears on a card carrying no rec. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| For the same request, `opportunity_score`, `opportunity_tier` and `state_fingerprint` are **byte-identical** before and after this feature. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A committed artifact records, across whatever trade-verdict recs the gate actually observes, how many carried an unnamed position-defining field, and records **N honestly** — no floor, no threshold, non-gating. A zero observed rate on the model path does **not** retire the feature. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,ARTIFACT:.spire/clusters/tech/contracts/rec-absence-literals-hole/QA_REPORT.md |
| When any of the six carries a **value**, its rendering is byte-identical to `main`: no clause, marker, chip, tint, type-register change or tooltip. (Carries `ai-rec-grounding` AC-25 forward.) | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| `not set` and its `Set your risk inputs` action never render on any of the six — none of them depends on owner input. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| A conviction stated **off Convexa's scale** renders the single new word `unrecognized`; the raw string never reaches the chip or the DOM, and the slot never reads `not given`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| `unavailable` renders on Strike(s) / Expiration only, only from an explicit `missing_input: candidate_set`, never from a fallthrough, and **never on the local-rules path**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The Expiration DTE caption renders only beside a stated expiration (the `value` member), never beside an absence literal, and never when either bound is unknown — no `?` reaches the DOM. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The DTE caption reads as §4 pins it: a statement about the **request**, not a containment claim about the value. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| Loading, empty, error, no-key and every gated state render **no field row at all** for the six — no skeleton, placeholder or ghost. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.test_cmd |
| Every absence literal is real text in the value slot (a screen reader reads it without hover), ≥11px, and meets contrast in **dark and light**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd |
| The six reason keys ride **every** produced response, **including the local-rules path** — verified on a response body, not on the LLM path alone. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| `grounding` is byte-identical: the shipped `checked == 4` guard passes **UNEDITED**, the user-visible `n of m` pair prints the same two integers against a GATE-Q baseline, and none of the six enters that denominator. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A tally test pins `RecField` at exactly 5 and `RecPlanField` at exactly 6, and a route-level test pins `field_reasons` at **exactly eleven keys with exact spellings** — they are hand-built with `json!`, so a typo'd key would otherwise silently render an absence literal on every field at once. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| On a local-rules trade card, `Time horizon` renders `not given` — the input-independent constant no longer renders as the read's own words. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd |
| The tip on all six absence literals is **producer-neutral** (naming no AI and no rule), and `RISK_FIELD_COPY` and the four shipped risk fields are unchanged. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd |
| Composition review on the local-rules card (`trade`, `strikes: []`, `expiration: null`): literals present, tip contradicting nothing on the card, card coherent beside the shipped local-rules line. **The fixture requires configured key material and consumes one in-process cap unit** (§7). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd |
| The change set touches only the §2.6 allow-list: **empty diff under `libs/quant-engine/`** and every signals / scoring / SSE module. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| The surface Accept opens is still the ONE shared simulated entry dialog — no fork, no second dialog — it stays `SIMULATED` behind its mandatory confirm, and no broker / order / execution path is reachable from it. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |

SUMMARY: 47 PASS / 0 FAIL / 0 UNVERIFIABLE
GATE Q: PASS

---

## GATE Q re-run — 2026-08-14, scoped to AC-18 only

**What changed in the tree.** Exactly one line: `.spire/clusters/tech/context/DESIGN_SYSTEM.md` gained
its `## Amendments` row (`git diff --stat` → `1 file changed, 1 insertion(+)`). Verified rather than
accepted: `apps/` and `libs/` are unchanged (`AiRecPanel.tsx` still hashes to `6e81e3ddf471663c`, the
same SHA-256 prefix recorded during the poison drills), no contract and no spec file moved, and the
conductor's planning-surface edits touch no AC.

**Whether that row could reach any other criterion — checked, not assumed.** No test, guard or Rust
source reads `DESIGN_SYSTEM.md`. Every `import.meta.glob` source scan in the dashboard is rooted at
`/src/app/**` and the ai-rec scans at `./**`; none reaches `.spire/**`, and the only in-repo mentions
of `DESIGN_SYSTEM` are prose comments in `tint.spec.tsx`, `literals.spec.ts` and
`ai-rec.grounding.spec.tsx`. Appending a documentation row is inert with respect to the other 46
criteria, so the instruction not to re-run them is sound. **They are not re-run.**

**AC-18 re-verified on substance, not on the presence of the word.**

| Requirement | Observed |
| --- | --- |
| Establishes `unrecognized` as a member of the closed not-a-number vocabulary | ✔ "One new member of the closed not-a-number vocabulary: `unrecognized`" |
| Distinct from `not given` (did not answer) | ✔ "never a synonym for `not given` (which means it did not answer)" |
| Distinct from `unavailable` (an input failed) | ✔ "never for `unavailable` (which asserts an input failed)"; and it is named "the only member meaning **the read answered, off our scale**" |
| Does not contradict the shipped literals | ✔ Row lists the set as `—` / `unavailable` / `not given` / `not set` / `size not suggested`, which matches the code exactly (`RISK_FIELD_COPY.dash/unavailable/notGiven/notSet` + `SIZE_NOT_SUGGESTED`) and matches the prior 2026-08-12 amendment's own list |
| Does not contradict SPEC §4's tip wording | ✔ The tip in the row is **byte-identical** to SPEC §4 **and** to the shipped `PLAN_FIELD_COPY.unrecognized.tip` in `copy.ts` — all three compared programmatically, all three equal |
| Carries the single-emit-site constraint | ✔ "Emitted from **exactly one site** (the confidence enum validation) so it cannot become a second `unavailable`" — matches the backend, where `unrecognized_value_is_unconstructable_from_any_other_field` poison-proves it |
| Provenance is real | ✔ `council/decisions.md` §C is headed "Controller rulings — declared, not asked (OPERATOR_REPORTS §4.2, default-with-veto)" and **#21 exists**, ruling exactly one addition from exactly one place, recorded as a DESIGN_SYSTEM Amendments row on the 2026-08-12 precedent. The row's "declared default-with-veto; not overturned" is accurate |
| Well-formed canon | ✔ 3-column row matching the table's header, last row in the table, the `low\|medium\|high` pipes correctly escaped so the table is not broken, dated 2026-08-14 |

The row is **not** the verbatim string SPEC §4 and PLAN V8 drafted — it is a superset. It carries every
element those two required and adds the explicit three-way distinctness, the full member list, and the
chip-suppressed rendering rule. Nothing it adds contradicts the spec, the shipped copy or the prior
amendment, and the one element where drift would have mattered — the tip — is byte-identical to both
other sources. **Accepted on substance.**

**The rendered set, compared against what was recorded live this session (no fresh run).** The distinct
absence strings actually rendered are `not given` (observed live on Strike(s), Expiration and Time
horizon), `—` (observed in exactly the four risk slots of a `no_trade` card, and never in a trade-card
value slot), `unavailable` (only from the explicit `candidate_set` pair, Strike(s)/Expiration only) and
`unrecognized` (off-scale conviction). `not set` never renders on any of the six (AC-23). That set is a
subset of the shipped closed vocabulary **plus exactly the one addition this row licenses**, and no
other absence word appears — `literalCopy` is total over exactly
`{value, dash, not_set, unavailable, not_given, unrecognized}` with no other branch.

**New verdict: AC-18 PASS.** Count moves from 46 PASS / 1 UNVERIFIABLE to **47 PASS / 0 FAIL /
0 UNVERIFIABLE**; **GATE Q: PASS**. The bounce recorded in the first pass is resolved — it was a
conductor/owner action, it was taken, and it was checked rather than trusted. **No amendment remains
open, and none was ever bounced to Backend or Frontend.**

---

## Independent conformance (system-1)

Re-run by QA, not inherited. Backend served on `:8010` from a clean build of the shipped tree.

| Receipt | Verdict | Endpoints |
| --- | --- | --- |
| Builder `conformance-receipt.json` (`:8010`, 2026-08-14T23:12:25Z) | PASS | 2/2 |
| **QA `conformance-receipt-qa.json` (`:8010`, 2026-08-15T00:01:14Z) — authoritative** | **PASS** | **2/2** |

The two agree. No bounce rule fires. `GET /api/ticker/{ticker}` and `GET /api/recommendation/status/{ticker}` each pass with 4/4 required fields present and well-typed.

### INTERFACE_CONTRACT §1a — the three layers, closed

- **Layer 1 (in-process):** `cargo test -p api-rust -p quant-engine` exit 0; `--lib` = **261 passed, 0 failed** on a forced-clean rebuild. (The lane reported 243→257; the observed lib tally is 261. Recorded as observed, not adjudicated.)
- **Layer 2 (live HTTP) — RUN, not recorded as a gap.** With `AI_REC_LOCAL_ONLY=1` and an admin-resolved key, a real `POST /api/recommendation/SPY` returned `status: "produced"`, `grounding.card: "local_rules"`, `key_source: "shared_admin"`. The captured body was walked against the §1a path list and all five cross-checks:
  1. `field_reasons` carries **exactly eleven keys** with the exact spellings. ✔
  2. Every non-null `reason` ∈ `{not_given, unavailable, unrecognized_value}`; `unrecognized_value` appears nowhere on this body. ✔
  3. Every `missing_input` is null and no `reason` is `unavailable` — the iff holds vacuously and correctly. ✔
  4. On a `grounding.card == "local_rules"` body, **no** `field_reasons.*.reason` equals `"unavailable"` — observed even though `strategy.strikes == []` and `strategy.expiration == null`, which is exactly the case a naive implementation would have mislabelled. ✔
  5. `grounding.counts` identical to the pre-feature baseline (below). ✔
- **The gated `Value::Null` edge the backend was asked to name — OBSERVED, not assumed.** A rec issued by a user whose key does not resolve returned the early-return envelope (`status: "unavailable"`, `unavailable_reason: "no_key"`, `strategy: null`) and it **still carried all eleven `field_reasons` keys**, six of them `not_given`. INTERFACE_CONTRACT rule 2's "including the early-return `Value::Null` branches" is therefore observed on a live HTTP body, not inferred.
- **Cost, stated honestly:** the fixture made **no provider call and spent no provider money**, but it **required configured key material and consumed in-process cap units** (`cap.remaining_today` 50 at start). It is not free.

### AC-20 / AC-31 — the observed baseline (closes SPEC §9 open question 5)

The pre-feature commit `5f16202` was built in a throwaway worktree with a **dedicated cargo target dir** (so no stale artifact could impersonate it) and served on `:8011`. Its identity was proved before it was trusted: the base body carries **5** `field_reasons` keys and `strategy.time_horizon: "1–5 sessions"`.

| Datum | BASE (`5f16202`) | NOW | Identical |
| --- | --- | --- | --- |
| `signals.opportunity_score` | `79` | `79` | yes |
| `signals.opportunity_tier` | `actionable` | `actionable` | yes |
| `ai_eval.state_fingerprint` | `155a1eaa299d` | `155a1eaa299d` | yes |
| `grounding.card` | `local_rules` | `local_rules` | yes |
| `grounding.counts` | `{checked:2, traced:2, untraced:0, not_checkable:0}` | `{checked:2, traced:2, untraced:0, not_checkable:0}` | yes |
| `grounding.fields` keys | 5 shipped | 5 shipped | yes |
| **whole `grounding` block** | — | — | **byte-identical** |
| `strategy.time_horizon` | `"1–5 sessions"` | `null` | **changed as AC-33 requires** |
| `field_reasons` key count | 5 | 11 | **+6 as designed** |

`grounding.rs` has an empty diff against `$BASE`; `the_denominator_excludes_the_dollar_risk_figure_and_the_suggested_size` passes **UNEDITED**; none of the six appears in `grounding.fields`.

### AC-36 — empty diff against each lane's `$BASE`, not against `main`

`$BASE = 5f16202` (the pre-work commit both lanes recorded), evaluated against the **working tree** so the uncommitted frontend is included:

- `libs/quant-engine/` — empty. ✔
- `apps/api/src/services/signals*`, `apps/api/src/routes/`, `apps/api/src/services/analytics.rs` — empty. ✔
- Full changed-file set (11 modified + 7 new) is entirely inside the §2.6 allow-list. `useTickerTradeFlows.ts` needed no edit, as PLAN predicted. `LegFields.tsx` and `reasoning.tsx` are unedited.

---

## Runtime observation — the two halves seen together for the first time

Backend (`AI_REC_LOCAL_ONLY=1`, `:8000`) + `npx nx serve @convexa/dashboard` (`:4200`), driven in headless Chromium. Servers were started and stopped outside the script; selectors were taken from rendered state.

**The live local-rules trade card, read the way a trader reads it:**

| Slot | Rendered | Size |
| --- | --- | --- |
| Structure | `long straddle / long vol` | 13px |
| Strike(s) | **`not given`** | 13px |
| Expiration | **`not given`** | 13px |
| Entry trigger | `At/near Gamma-flip transition` | 13px |
| Time horizon | **`not given`** | 13px |
| Confidence | `high` (chip) | 13px |

- **AC-33, observed end-to-end:** the same request against the pre-feature build printed the read's own words for Time horizon; against this build it prints `not given`.
- **AC-16:** every leaf node in the panel containing U+2014 was enumerated. All five are card-level prose or tooltips (the advisory line, the persona caption, the local-rules line, the size caption, the reasoning disclosure). **None is a value slot or a chip label.** Outside the queried set by construction, exactly as the AC words it.
- **AC-10b:** the standing not-actionable line is **absent** on the local-rules card, and the shipped `No AI read here — these figures come from Convexa's own rules.` line renders unchanged. One card-level statement, so AC-15's "at most two" holds.
- **AC-34, live tooltip, verbatim:** `Nothing stated a value for this. Nothing failed; it was simply never filled in.` — producer-neutral, on all three absent slots.
- **AC-29:** dark `rgb(233,228,214)` on `rgb(11,15,23)`; light `rgb(23,32,43)` on `rgb(246,246,243)`; 13px in both. Real text in the slot, readable without hover, contrast far above 4.5:1 in **both** themes.

**Accept → the ONE shared simulated entry dialog:**

- Title `Open simulated position · SPY`, `SIMULATED` marker present, no broker/order path reachable (**AC-37**). The shipped path pin `ai-rec.grounding.spec.tsx:516` passes **UNEDITED** — `TradeEntryDialogView.tsx` was edited but neither renamed nor forked, and the guard's exact-path equality still resolves to that one file.
- Contract inputs: strike `""` and expiration `""` — **no zero, no nearest-strike snap, no first chain expiration** (**AC-12a/b**).
- Reason line: **`Not pre-filled — the read named no Strike(s), Expiration.`** Names the fields and **no cause** (**AC-12d**; this is R-7's plan-authored copy, confirmed rendering verbatim on screen).
- Confirm control `Open simulated position` — **`disabled=true`** (**AC-12f**, observed live, not inferred).
- The Call/Put toggle showed `Call` selected. This is **correct, not a defect**: the read *did* state a structure (`long straddle / long vol`) that names neither word, and SPEC §2.5 rules that case explicitly in — "`:44`'s bias derivation then stands EXACTLY as today when structure IS present but names neither word". The reason line correctly omits Structure. AC-12c's never-named case is not reproducible on the local-rules path (that producer always states a structure) and is carried by test + poison instead.

**Visual evidence was captured** (full-page card, panel in dark, panel in light, entry dialog). The frontend lane could not do visual inspection and said so honestly; that gap is now closed by observation rather than by laundering its DOM assertions into a visual claim.

---

## Poison drills — re-run by QA, not inherited

Every guard was re-drilled in a throwaway worktree mirroring the change set, so the user's working tree was never touched. Every restore was verified **byte-identical by SHA**, and the ai-rec + tradeEntry suite returned to **15 files / 232 tests green** afterwards.

| # | Poison applied | Observed red | Restored |
| --- | --- | --- | --- |
| L1 | `literal={s.structure ?? '—'}` at a plan site | `AiRecPanel.tsx(1208,59): error TS2322: Type 'string' is not assignable to type 'PlanFieldLiteral'` | green |
| L2 | the pre-feature line restored verbatim: `<Field label={…} value={s.structure ?? '—'} />` | `reservedMark.render.spec.tsx` — `AssertionError: expected '—' not to contain '—'` | green |
| L2 arm (a) | Time horizon row deleted from the card (5 of 6 render) | 3 tests red — `Unable to find an element with the text: Time horizon`; the exact-count arm reds on the **count**, not on emptiness | green |
| L3 | same as L1 | `emDashCoalesce.scan.spec.ts` — `expected [ './AiRecPanel.tsx' ] to deeply equal []` | green |
| AC-4 | sibling selector's `unavailable` arm pointed at `not_given` | 3 tests red — `expected 2 to be 3` (pairwise distinctness) | green |
| L4 a | conjunct `d.strike !== '' &&` removed | submitGate **arm 1 only** red; arm 5 (fully-stated draft accepted) stayed green | green |
| L4 b | conjunct `!!d.expiration &&` removed | submitGate **arm 2 only** red; arm 5 stayed green | green |
| L4 c | conjunct `&& !!d.right` removed | submitGate **arms 3, 4, 6** red; arm 5 stayed green | green |
| B-P1 | §2.2 hazard — type-aware presence replaced by the null-only test | 3 backend tests red, incl. `the_hazard_row_none_of_the_empties_can_produce_unavailable_with_a_declared_empty_set` | green |
| B-P2 | key spelling typo `entry_trigger` → `entrytrigger` | `field_reasons_carries_exactly_eleven_keys_with_exact_spellings` red | green |
| B-P4 | local-rules branch made to declare a candidate-set dependency | `the_six_ride_the_local_rules_envelope_and_never_claim_unavailable_there` red | green |
| B-P6 | the deleted `"1–5 sessions"` constant restored on the assembler's trade branch | same test red at the AC-33 assertion | green |

**One nuance recorded rather than smoothed over.** AC-17 names the two red places as `nx typecheck` *and* "the label-anchored render guard". No **single** poison spelling reds both: the *typed* form (L1) reds typecheck plus `nx test` via the Layer-3 scan and the AC-2/AC-22 value-render tests, while the *pre-feature* form (L2) reds the label-anchored guard plus Layer 3 but type-checks clean, because `Field` legitimately takes a `ReactNode`. The AC's substance — a reintroduction goes red in **two independent places**, `nx typecheck` and `nx test`, both proven non-vacuous, with arm (a) exact-count and an escaped-form scan poison — is satisfied and observed. The parenthetical's attribution is imprecise; the enforcement is not. Verdict stands at PASS on the substance.

**B-P6 operator note.** My first B-P6 attempt patched the first `"time_horizon": null` in the file, which is the `no_trade` branch at `:814` and already null pre-feature — an invalid drill that produced a false green. Re-run against the trade branch at `:854`, it reds correctly. Recorded because a drill that silently misses its target is the same failure class this feature exists to close.

---

## Criteria-independent Critical sweep

Run across the whole changed set, independent of every named AC. **No Critical finding.**

- **Authentication / authorization.** `apps/api/src/routes/` has an empty diff against `$BASE`. `POST /api/recommendation/{ticker}` keeps `require_user` outermost. No gate, cap, cooldown or session path changed. `[server-side-gate-enforcement]` intact.
- **Cross-tenant.** No new user-keyed state, no new store, no new query. Nothing added is keyed by or leaks across identity.
- **Secret exposure.** No new logging, no new response field carrying key material. `key_source` handling untouched. `[secret-encrypted-at-rest]` / `[no-secrets-in-image]` unengaged.
- **Raw-text egress.** The wire carries **closed tokens only**. An off-scale conviction is reported as `unrecognized_value`, never as the model's string; verified live that the raw string reaches neither the chip nor the DOM. `[digested-labels-not-raw-dump]` honoured.
- **Destructive data.** No durable key or shape change, so `[loss-free-durable-migration]` is not engaged. The `LegDraft.right: OptionRight | ''` widening only makes submission **stricter** (one added conjunct), and both storage narrows (`:321`, `:435`) map `''` → `null` before anything is persisted. The added order-path guard `right === ''` is likewise a refusal, never a write.
- **Binding invariants.** `[no-real-order-path]` — observed `SIMULATED` behind its confirm. `[single-shared-sim-entry-dialog]` — one dialog, the shipped path pin passes unedited. `[additive-keeps-score-byte-identical]` — score/tier/fingerprint proved identical against a real pre-feature server. `[absent-is-not-none]` — enforced in the type (`PlanFieldLiteral`) and the closed vocabulary, with `[absent-is-not-none]` applied to the dependency flag itself (`PlanInputPresence`), poison-proved. `[structural-over-prose-enforcement]` — four layers, each drilled red and restored. `[theme-token-discipline]` — zero new hex, zero new sx colour; dark/light parity observed.
- **`cited-code-is-verified-not-assumed`.** Every load-bearing claim in this report was checked against the tree rather than against a lane's summary: `fieldLiteral`/`FieldLiteral` and `copy.ts` are **additions-only** (no deleted or modified line in either diff — the byte-identity claim holds); `RISK_FIELD_COPY` is read, never written; `grounding.rs`, `apps/api/src/routes/` and `libs/quant-engine/` have empty diffs.
- **`ai-rec.risk.spec.tsx` — a legitimate correction, not a weakened oracle.** The two edits replace assertions that pinned the pre-feature defect (`biasToRight({structure: null, bias: 'short'}) === 'put'`). The bias-fallback path is **still pinned**, re-expressed over a *stated but unparseable* structure (`iron condor`), and a **new** test asserts the never-named case returns `null`. Coverage strictly increased. No oracle was loosened to make a build pass.

---

## Suite and build state, with exit codes

| Command | Exit | Reading |
| --- | --- | --- |
| `cargo test -p api-rust -p quant-engine` | **0** | green |
| `cargo test -p api-rust --features postgres --lib` (after `cargo clean -p api-rust`) | **0** | **261 passed, 0 failed** |
| `npx nx test @convexa/dashboard` | **1** | 1754–1755 passed; **exactly the 5 accepted pre-existing red files** |
| `npx tsc --build apps/dashboard/tsconfig.json --emitDeclarationOnly --force` | **0** | genuinely green |
| `npx nx lint @convexa/dashboard --skip-nx-cache` | **1** | **1 error — pre-existing, not this feature's** |

**Two honest corrections to the reported build state:**

1. **`nx typecheck` returned a cache hit (34 ms, `Cache: 1/1 hit`).** A cached green is not an observation. Re-run with `--skip-nx-cache` it still finished in 245 ms — the incremental `tsc --build` did no work. Only a **forced** full build (`--force`) is evidence, and that is green. Any lane reporting typecheck green off a cached or incremental run has not observed it.
2. **`nx lint @convexa/dashboard` is RED**, contrary to the frontend lane's claim. One error: `apps/dashboard/src/app/pages/ticker/stage3-headings.spec.tsx:278:34 — Unexpected empty arrow function`. **It is not this feature's:** that file has an empty diff against `$BASE`, and `npx eslint` reproduces the identical error in a pristine `5f16202` worktree. `npm run ci` therefore cannot be green today, for a pre-existing reason. Filed as an observation, not as a bounce — but the claim "lint green" was unverified and is incorrect.

**The 5 red spec files were proved pre-existing, not assumed.** A pristine `5f16202` worktree reproduces the identical five files failing the identical named tests — including `orders.risk.spec.tsx > act_confirm_live_cross_fill_creates_exactly_one_position_with_provenance`, which sits on the rec → order → prefill path this feature edits and so could not be waved through on reputation. `app.risk.spec.tsx` did not fail in either full run. A 6th red would have been this feature's; there is none.

---

## AC-21 — the omission artifact, recorded honestly

This section is the committed artifact AC-21 asks for.

- **Trade-verdict recs this gate actually observed: N = 2.** One from the shipped build, one from the pre-feature `5f16202` build, both on ticker `SPY`.
- **Both were on the local-rules (`AI_REC_LOCAL_ONLY`) path. The gate observed ZERO model-path trade recs.**
- **Carrying at least one unnamed position-defining field: 2 of 2** — `Strike(s)` and `Expiration` in both cases (`strikes: []`, `expiration: null`, unconditional on that producer).
- **What this number is not.** It is a property of the rule-based producer, which omits those two by construction, and it says **nothing** about how often the model omits a position-defining field. `AI_REC_LOCAL_ONLY=1` was set for every produced rec specifically to avoid provider spend, so the model path was never exercised at this gate. No floor, no threshold, non-gating. A zero observed rate on the model path would not retire the feature, and this non-zero rate on the rules path does not validate it either.

---

## Binding record rule (SPEC §9.1 / PLAN V10)

`ai-rec-grounding` SPEC §9 item 5 is recorded as **half one closed, half two a named surviving residual**. Half one — the false not-applicability verdict `—` on absent fields — closes here, observed. Half two — generalizing *"no clause means checked"* onto **stated** structure / trigger / horizon / conviction — does **not** close, because the unconditional scope caption was cut on line budget. **This report does not record §9.5 as closed.**

Also carried forward unresolved, per SPEC §9: the conviction label is still not unified (`Confidence` vs `conviction · {level}`, both unchanged this feature, status quo on record as unacceptable to UX); the two bare `—` fallbacks in `quoteTextFor` (`literals.ts:101-102`) remain a booked residual, outside the Layer-2 resolved set by **scope, not exemption**.

---

## Verdict

**GATE Q: PASS — 47 of 47, no open amendment.**

Every criterion passed against the running system. Both halves were observed together for the first
time in a real browser, my independent conformance receipt is PASS and agrees with the builder's, the
live HTTP layer the interface contract left as a planned gap was **run rather than recorded as
not-run**, `grounding` was proved byte-identical against a real pre-feature server rather than against
a remembered integer, and every one of the four enforcement layers was re-drilled red and restored
byte-identically. The single row held open at the first pass — AC-18, blocked by its own
spec-declared canon precondition — is now closed on the substance of the appended `## Amendments` row,
not on its existence.

Three findings stand as recorded and are being actioned separately by the conductor; none changes this
verdict: the pre-existing `nx lint` red at `stage3-headings.spec.tsx:278` (so `npm run ci` cannot be
green today, for a reason that predates this feature), the cached-`nx typecheck` observation (a cache
hit is not evidence — only a forced full build is), and AC-17's imprecise parenthetical (the
enforcement is sound; the attribution in the AC's wording is not).
