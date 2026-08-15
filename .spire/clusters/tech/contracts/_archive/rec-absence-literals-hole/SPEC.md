# rec-absence-literals-hole — spec

**Source brief:** .spire/clusters/tech/contracts/rec-absence-literals-hole/BRIEF.md
**Council:** R1 positions · R2 critiques · R3 resolutions · decisions.md · S2-findings.md (under council/)
**Status:** draft — R4 pass 3 (owner-sanctioned, narrow: pass-2 Criticals 1 and 2 + the `biasToRight`
Important + a self-audit of every remaining reuse-of-existing-scaffolding claim)

## 1. Goal + scope

Six fields on the AI rec card — `Structure`, `Strike(s)`, `Expiration`, `Entry trigger`, `Time horizon`
and the conviction/`confidence` chip — render a bare `—` when the producer never named them. `—` is
**reserved vocabulary**: the `no_trade` branch defines it as *"No entry, so there is nothing to size."*
All six sit in the **trade** branch (verified: `AiRecPanel.tsx:1081`, `:1082`, `:1086`, `:1100`, `:1153`
are `<Field … value={s.X ?? '—'} />`; `:1158` is `<Chip label={s.confidence ?? '—'} />`), so a card
headed `Trade · long` can print `Strike(s): —` — the no-entry mark on a card that just told you to
enter. A trader cannot tell *"nobody named a strike"* from *"no strike applies"*: the first is a rec you
must not act on, the second is a rec with nothing to act on. This feature makes those two facts
different on screen, and stops an unnamed field from becoming a pre-typed, one-click-submittable trade
parameter at the simulated entry surface.

**Owner ruled `A`, 2026-08-14 (decisions.md §E.1): the Accept / prefill fix is IN SCOPE.** Reasoning,
carried as settled fact: an unnamed field does not arrive at the entry surface empty — it arrives as a
plausible, valid, submittable value indistinguishable from one the read chose. Shipping an honest label
over a live fabrication would let the card say *the read named no strike* while Accept still put one in
the ticket.

Binding consequences:

- **BRIEF `Effort: S–M` is SUPERSEDED — re-price M–L.**
- **BRIEF path allow-list is SUPERSEDED** by §2.6. It grows a third tree (`features/trading/tradeEntry/`)
  including a file **pinned by exact path by a shipped guard** (`ai-rec.grounding.spec.tsx:516`,
  citation verified). That guard is updated **deliberately with its pin re-proved, never loosened to
  pass** — precedent: `ai-rec-grounding`'s CRLF episode, where the tempting fix satisfied the guard's
  NAME while destroying its BEHAVIOUR.
- `[single-shared-sim-entry-dialog]` **honored, not narrowed**: a change to the ONE shared sim dialog's
  seeding, never a fork. `[no-real-order-path]` untouched — the surface stays `SIMULATED` behind its
  confirm.

**In scope:** six per-field reason keys on the shipped `field_reasons` object, emitted on **every
produced response including the local-rules path** (load-bearing: without it the primary observation
fixture is unobservable) · six FE render sites on a closed lookup over the wire token · one card-level
standing line, exempt on the affirmatively-declared local-rules path (AC-10a/b/c) · the `no_trade`
conviction chip rendering the never-stated literal when absent (`AiRecPanel.tsx:943-944`, **outside** the
`:956-996` risk block, which keeps its zero-line diff) · **exactly ONE new vocabulary word**
(`unrecognized`, decisions.md §C #21) with one emit site and a DESIGN_SYSTEM **Amendments** row at
approval · deleting the one genuine no-author constant `time_horizon: "1–5 sessions"`
(`recommendation.rs:829`) · the producer-neutral tip for the six · the Expiration DTE caption on the
`value` member only · the Accept/prefill seam (strike `0`, `expirations[0]`, `right: 'call'` — §2.5).

**Out of scope:**

- **Widening `RecField`** (stays at five — §2.1).
- **Any grounding treatment for the six** — no clause, marker, tint, anchor, `GroundingState`, tooltip
  or type-register change. `grounding` byte-identical; none of the six enters `counts.checked`.
- **"Fixing" the `unwrap_or`s at `recommendation.rs:801` / `:806` / `:814`.** Controller-verified
  (decisions.md §D.1): `Setup { name, bias, strategy, rationale, conviction }` are non-optional `String`s
  (`libs/quant-engine/src/signals.rs:61-67`) set at all ten construction sites, and `Signals.setups` is
  the sole producer — so those three are **dead code on every shipped path**, and `structure`,
  `entry_trigger`, `confidence` on the local-rules card are **rule-authored with a named author**, not
  fabrications. A deletion would be a behavioural no-op that reads in the ledger as a change.
- **The unconditional plan-row scope caption** — cut on line budget (decisions.md §C #17/#23): at most
  **two** card-level statements, never merged.
- No prompt or output-schema change · no export/egress widening · no new endpoint, response block, SSE
  byte or durable key (so `[loss-free-durable-migration]` is not engaged) · no null-rate dashboard (that
  is `degradation-visibility`) · no reassessment/Positions surface · no retrofit outside the ai-rec
  folder · no re-verdicting.

**Future (deliberately deferred):** the scope caption — because it is cut, **`ai-rec-grounding` SPEC §9
item 5 closes in half one only** (§9.1, with the binding record rule) · fixing the two bare `—`
fallbacks in `quoteTextFor` (`literals.ts:101-102`) — §9.3 · unifying the conviction label (§9.2) · an
omission rate across model recs over time · a machine-readable "actionable" flag.

<!-- spire:council-resolution:v1 2ef39a6d2f9bd55a07c1dd9df4e4f7577abd70a67eb07106fd9198d124b7533a folded -->
<!-- spire:council-resolution:v1 532e12570f3a03591a3339d40b075d1836fda6120b2673b88cc5e9fd69207751 folded -->
<!-- spire:council-resolution:v1 cbc170be7d560b5de922609f89600f47dd8eb78560a728a58564712963271e2f folded -->

## 2. Architecture

> **Reuse-claim discipline (pass 3).** S2 twice found this spec asserting that scaffolding it planned to
> reuse already exists when it does not. Every claim below about existing code is either **verified**
> (cited with the line read this pass) or explicitly marked **[lane-check]** — an assumption the build
> lane confirms before relying on it. New scaffolding this feature must **invent** is labelled as such,
> never as reuse. §2.7 lists what pass 3 corrected.

### 2.1 Wire shape — a sibling enum, not a widened one

`field_reasons.rs` keeps `RecField` at **exactly five** members and gains a **separate**
`RecPlanField` at **exactly six** (`Structure`, `Strikes`, `Expiration`, `EntryTrigger`, `TimeHorizon`,
`Confidence`) plus `plan_field_reason(field, value_present, presence) -> Option<FieldReason>` returning
the **shipped** `FieldReason` struct unchanged. The six keys join the same `field_reasons` object built
at `recommendation.rs:478-484`, called from `base()` at `:664`, so they ride every envelope `base`
builds — including the local-rules branch and the early-return `Value::Null` branches. Eleven keys total.

`RecField` is not widened because it is a shared key across two consumers:
`resolve_field(field: RecField, asserted: Option<f64>, …)` (`grounding.rs:230`) is an exhaustive `match`
over an `Option<f64>` (documented `:227-229`, no wildcard, no exemption) that none of these six can
inhabit — six new arms could only return `NotApplicable`, which in that function means *the field carries
no value* (`:242`, `:246`, `:251`), filing a **present** structure as absent. Widening would also drop
them into `all` at `recommendation.rs:524`, moving `counts()` and the user-visible `some_traced (n of m)`
line, and force hand-edits to two shipped guards (`grounding.rs:519`, `:559`) written to red when that
set changes.

**Grounding is untouched, stated as unchanged-ness, not as a number.** `grounding.counts` byte-identical;
`the_denominator_excludes_the_dollar_risk_figure_and_the_suggested_size` (`grounding.rs:613-615`) passes
**UNEDITED**; the `n of m` pair (`literals.ts:299`) prints the same integers. That guard's `checked == 4`
holds for **one shape only** (fully-traced model rec + cited contract, `grounding.rs:596-600` +
`CitedState::Cited`) and is **not** universal — on the local-rules fixture `strikes: []` forces
`CitedState::None`, `max_risk`/`position_size` are structurally unchecked, and the card prints
`local_rules`, never `some_traced (n of m)` (`grounding.rs:327-344`). AC-31 pins byte-identity against a
baseline observed at GATE Q, never a remembered integer.

### 2.2 Presence predicates — the design rule; the table lives in the interface

**The token vocabulary, the per-field `value_present` predicates, the `confidence` evaluation order and
the `candidate_set` truth condition are owned by
`.spire/clusters/tech/contracts/rec-absence-literals-hole/INTERFACE_CONTRACT.md` §1 and are NOT restated
here.**

The one design rule that is this spec's, because it is a ship-blocking hazard rather than a token
spelling: **the shipped shared closure `present = |v| v.map(|x| !x.is_null()).unwrap_or(false)`
(`recommendation.rs:470`) is null-only and must NOT be reused for the six.** Under it `""`, `[]` and
`"moderate"` all read *present*, the wire carries `null`, and the browser's shipped fallthrough renders
the missing-input literal over a field nobody ever named — this feature's own defect, reproduced one
layer up by the fix. Per-field, type-aware predicates are required; the interface contract defines them.

### 2.3 The frontend selector — a sibling, not an edit to the shipped one

`fieldLiteral` (`literals.ts:55-63`) decides value-vs-absent by testing the value (`:57-59`) and falls
through to `{ kind: 'unavailable' }` at `:62`; five shipped fields and `literals.spec.ts` depend on both.
**It is not edited.**

`literals.ts` gains a **sibling selector** (`planFieldLiteral`) sharing the shipped value arms and the
`no_trade`-first short-circuit (`:55`), differing in exactly two ways: its final fallthrough is
`{ kind: 'not_given' }`, and it carries an **explicit arm for `unrecognized_value`**. That arm is
mandatory — without it the third token falls through to the `not_given` default and *"answered off our
scale"* re-collapses into *"never answered"* inside the fix. One test pins both selectors' defaults; one
pins the `unrecognized_value` arm.

**Absence-branch rule (UX-3, scoped).** (a) value-versus-absent stays the shipped value test — joining
`strikes: number[]` into a display string before the lookup is *formatting*, not cause selection; (b)
once absent, **which** absence literal renders is a closed lookup on the wire token alone — no null test,
no sibling-field inference, no re-derivation; (c) the absence fallthrough is `not_given`, never
`unavailable`. The unscoped form would have red against the shipped value arms and blanked a **present**
value whenever the server's presence predicate disagreed with the payload beside it.

**Vocabulary, resolved so §2 and §4 agree.** The shipped `FieldLiteral` union (`literals.ts:41-46`)
**stays at five members** — block-absence earns no new member, and `literals.spec.ts` and every shipped
`fieldLiteral` consumer stay unedited. The one ruled-in word lives on
`PlanFieldLiteral = FieldLiteral | { kind: 'unrecognized' }`, the sibling selector's return type. **This
is a proper superset of `FieldLiteral`, not a disjoint union.** The enforcement is TS structural typing:
a `PlanFieldLiteral`-typed value cannot be passed to a parameter typed `FieldLiteral` without an explicit
unsafe cast, so the new member cannot leak into a shipped consumer. The render vocabulary gains exactly
one word while the shipped union gains none.

**One copy table, two renderers.** The `FieldLiteral` → (text, tip, action) mapping is a branch inside
`RiskField` (`AiRecPanel.tsx:758`, which returns `<Field …>` at `:787` and `:800`). `confidence` renders
as a `Chip` (`:1158`), not a `Field`, so a second renderer is unavoidable — and must not become a second
copy table. One `literalCopy()` is exported from `copy.ts` over the existing `RISK_FIELD_COPY` and
consumed by both. `RISK_FIELD_COPY` is **untouched**; the six take the producer-neutral tip on their own
sibling entry (§4).

**Typed call sites.** The six (`AiRecPanel.tsx:1081`, `:1082`, `:1086`, `:1100`, `:1153`, `:1158` —
verified, all six are today a bare `?? '—'`) stop passing `value: React.ReactNode` and take
`literal: PlanFieldLiteral`, which is what makes a bare `?? '—'` a **type error** rather than a style
violation. The shared `Field` primitive (`reasoning.tsx:22-53`, props `{ label, value, tip, valueSx }`)
keeps taking a rendered `value`; the `PlanFieldLiteral` → element mapping happens at the six call sites
via `literalCopy()`, so `Field` itself needs no new prop.

### 2.4 `time_horizon` — the one genuine no-author constant, and its precondition is CLOSED

Controller-verified (decisions.md §D.1): `"time_horizon": "1–5 sessions"` (`recommendation.rs:829`) has a
named author (`local_strategy_from_bundle`) but **zero input dependence** — no rule and no read computed
it, and it is the same string on every card. It is deleted; the assembler emits `null` and
`plan_field_reason` emits `not_given`. Visible consequence, ratified in advance: **on every local-rules
trade card `Time horizon` reads `not given`** (AC-33).

**No-other-consumer precondition — CLOSED, with evidence.** `time_horizon` in `apps/api` appears in
exactly two files: `recommendation.rs` (the assembler being edited) and `llm.rs` (prompt schema +
LLM pass-through, an unrelated untouched path). No `ai_eval`, outcome-ledger, export or
stored-evaluation code reads it. FE hits are the shared type (`convexa.ts:1446`), the display site
(`AiRecPanel.tsx:1153`), and test fixtures (`testBackend.ts`, `orders.risk.spec.tsx`,
`stage3-headings.spec.tsx`) that hardcode arbitrary values unrelated to the deleted constant;
`features/personas/template.ts`'s `"time_horizon": "expected holding period"` is a static prompt-schema
string, not a value consumer. **Nothing outside the display path breaks.** This matches the confirmation
architect gave for `strategy.confidence` (no other backend consumer; absent from `build_export` at
`recommendation.rs:386`, from `ai_eval` and from `grounding`). AC-33 is the observable.

No display-side predicate can ever see an upstream fill — `envelope_extras` (`recommendation.rs:441`)
receives the already-assembled `strategy: Value`, so anything filled before that point is
indistinguishable from a stated value by construction. If a later gate rules another assembler constant
a fill, the fix site is the assembler line, never the predicate.

### 2.5 The Accept / prefill seam — the mechanism, stated line by line

Controller-verified (decisions.md §D.2). Accept **does** seed: `useTickerTradeFlows.ts:67` calls
`recToPrefill(rec.strategy, …)` → `openEntry(pf)` (`:58`, `openEntry(prefill?: EntryPrefill, …)`) →
`TickerDashboard.tsx:689` → the ONE shared sim dialog (`TradeEntryDialogView.tsx:117`,
`prefill?: EntryPrefill`). Today, when the rec named nothing:

| rec omits | dialog opens with | mechanism |
|---|---|---|
| `strikes` | strike **`0`** | `prefill.ts:73` `strikes.length ? strikes[0] : 0`; `TradeEntryDialogView.tsx:214` `prefill?.strike ?? nearest`, and `??` is **nullish**, so `0` survives and the nearest-to-spot reduction (`:204-206`) never runs |
| `expiration` | the **first chain expiration** — a real date the rec never named | `prefill.ts:72` yields `''`; `:207` `prefill?.expiration \|\| expirations[0] \|\| ''` is **truthy**, so `expirations[0]` wins |
| `structure` | **`right: 'call'`** | `biasToRight` (`prefill.ts:40-46`), reasserted by `right: prefill?.right ?? 'call'` (`:215`) |

**There is no chain-derived _strike_.** The doc comment at `prefill.ts:51` claims a snap to the nearest
available strike; the operator does not implement it. Do not repeat the chain-derived-strike claim.

**The outcome that binds (pm's B4):** *no value the producer did not state is pre-typed, and none is
submittable by a single confirm.*

**THE MECHANISM.** Four code facts decide the shape. All four verified by direct read:

1. The dialog's draft strike field is **already** `number | ''` (`types.ts:151`) — `:204-206` yields `''`
   when the chain has no strikes, `:316`/`:420` read `d.strike === '' ? null : Number(d.strike)`, and
   `LegFields.tsx:143` renders `value={draft.strike === '' ? '' : String(draft.strike)}`. **The draft
   already has an unstated sentinel, and the UI already handles it.**
2. The submit predicate is
   `(d) => d.qty >= 1 && (d.kind === 'equity' || (d.strike !== '' && !!d.expiration))` (`:363`).
   `!!d.expiration` **already rejects** `''` and `null`. `d.strike !== ''` rejects `''` but admits `0` —
   **and would admit `null`**, since `null !== ''` is true. The two fields do **not** behave alike.
3. `d.right` is **not in the predicate at all**.
4. **`LegDraft.right` is `OptionRight`, non-nullable (`types.ts:152`)** — so `right` has no pre-existing
   unstated sentinel, and a `null` assigned into it does not compile. Pass 2 asserted a mechanism that
   would not type-check.

**The uniform rule:** *the prefill seam carries `null` for "never named"; the draft carries the empty
sentinel `''`; the mapping happens at the one boundary line where the dialog reads the prefill.* Applied
to all three fields, so nothing is asymmetric except where the shipped predicate already is.

**Type changes** — both prefill interfaces widen, not just the ai-rec one:

- **`EntryPrefill` (`types.ts:24-40`)** — the type the dialog's prop and `openEntry` actually use:
  `expiration: string | null`, `strike: number | null`, `right: OptionRight | null`.
- **`AiPrefill` (`prefill.ts:20-36`)** — the ai-rec producer, same three widenings.
- **`LegDraft.right` (`types.ts:152`)** — `OptionRight` → **`OptionRight | ''`**, *not* `| null`.
  **Chosen deliberately over a nullable:** this file already uses `''` as its unstated sentinel twice —
  `strike: number | ''` (`:151`) and `price: number | ''` (`:153-154`, commented *"`''` = not typed yet,
  which is what makes the running net read INCOMPLETE"*). Following the file's own idiom means the
  falsy-sentinel handling the file already contains (`:143`'s Select, `:316`/`:420`'s narrow,
  `!!d.expiration`) extends to `right` unchanged, and introduces no third nullability convention. Carry
  the same comment shape: *`''` = the read named no structure, so no direction is typed yet.*
  `newDraft()` (`:158-166`) keeps its `right: 'call'` default — a dialog opened directly is unaffected.

**Seed lines** — the dialog branches on **prefill presence**, not on the field value. `??` cannot express
this: it fires identically on `null` and `undefined`.

- `:207` → `const exp = prefill ? (prefill.expiration ?? '') : (expirations[0] ?? '')` — the `||` chain
  must go, because `''` is falsy and would fall back to `expirations[0]`.
- `:214` → `strike: prefill ? (prefill.strike ?? '') : nearest`
- `:215` → `right: prefill ? (prefill.right ?? '') : 'call'`

So `prefill === undefined` (dialog opened directly, not via Accept) keeps today's nearest-strike /
first-expiration / `call` defaults **byte-identical** (AC-13); a field the rec never named becomes the
draft's `''`.

**Submit predicate** — `:363` gains **exactly one conjunct**:
`(d) => d.qty >= 1 && (d.kind === 'equity' || (d.strike !== '' && !!d.expiration && !!d.right))`.
Strike and expiration arms are **unchanged**, because the seam maps their unstated case onto values those
arms already reject. `right` is the one field the predicate could not see, and `''` is falsy, so the same
conjunct shape serves.

**Cascade from the `LegDraft.right` widening** — named, because a type change is not local:

- `:317` `right: isOption ? d.right : null` and `:421` `right: d.kind === 'option' ? d.right : null` must
  narrow the sentinel, mirroring the shipped strike narrow one line above each:
  `d.right === '' ? null : d.right`. Submit already rejects `''`, so these are unreachable with one — but
  TypeScript cannot know that, so the narrow is required, not defensive.
- `:635` `right: prev[0]?.right ?? 'call'` (add-a-leg) — `''` is not nullish, so an unstated direction
  propagates to the added leg. Correct behaviour (the added leg is equally unsubmittable) and type-safe;
  no edit.
- `LegFields.tsx:159-163` — `<ToggleButtonGroup exclusive value={draft.right} onChange={(_, v) => v && …}>`.
  `''` matches no button, so **nothing renders selected**, which is exactly the required "no direction
  pre-typed" UI, and the `v &&` guard prevents writing an empty back. **Read, not edited.**
  **[lane-check]** confirm the widened type raises no error on MUI's `value` prop; if it does, the fix is
  a cast at that one call site, not a change to the sentinel choice.
- `EntryPrefill` has pass-through declarations in `PortfolioPanel.tsx:39`, `PositionsPanel.tsx:58`,
  `TradeEntryDialog.tsx:13` and `tradeEntry/index.ts:4`. **[lane-check]** these declare the prop and do
  not construct or read `strike`/`expiration`/`right`; widening a member is source-compatible for a
  pass-through, but confirm no body reads them expecting a non-null.

**`biasToRight` — the line, not just the outcome.** `prefill.ts:40-46` collapses absent and unparseable
structure into one path via `(strategy.structure ?? '').toLowerCase()` (`:41`), so `structure: null` and
`structure: "iron condor"` both fall through to `:44`/`:45`. `:44` (`if (strategy.bias === 'short')
return 'put'`) fires regardless of whether structure was named, so fixing only `:45` still yields a
submittable direction for an unnamed structure — violating AC-12c. The fix is an explicit **presence
check ahead of the collapse**:

```
if (strategy.structure == null || strategy.structure.trim() === '') return null;
```

placed before `:41`'s lowercasing; the return type becomes `OptionRight | null`. `:44`'s bias derivation
then stands **exactly as today** when structure IS present but names neither word — the structure *was*
stated, and a parse that found no keyword is a different fact, out of scope here. (Fold: decisions.md
§E.1 names only `:45`, but AC-12c's ruled outcome is not met while `:44` derives a direction from an
unnamed structure. Closing that gap follows the ruling rather than widening it.)

**The refusal keys on the VALUE being absent, never on a reason token being present** (AC-12e): a
degraded or pre-feature response carrying no reason information but an absent strike still refuses to
seed, and the reason line says only that the read did not give it. A degraded response never becomes a
blocked Accept.

AC-12f pins the predicate itself with a poison, because this is exactly the guard a build lane could
skip while every other AC still reads green.

### 2.6 Path allow-list (supersedes the BRIEF's), failure modes, rejected approaches

**Backend.** `apps/api/src/services/rec_inputs/field_reasons.rs` ·
`apps/api/src/services/recommendation.rs`.

**Shared types.** `libs/api/src/lib/convexa.ts`.

**Frontend — ai-rec.** `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/**` — including `literals.ts`,
`copy.ts`, `AiRecPanel.tsx`, `prefill.ts`, and the guard specs. `reasoning.tsx` (the shared `Field`
primitive) is inside this glob but is **named here because it is a shared component**: per §2.3 it needs
**no** change, and if the lane concludes otherwise that is a deviation worth stating, not absorbing.

**Frontend — the Accept flow.** `apps/dashboard/src/app/pages/ticker/useTickerTradeFlows.ts` (path
confirmed this pass; pass 2 could not name the folder).

**Frontend — the shared entry dialog.**
`apps/dashboard/src/app/features/trading/tradeEntry/TradeEntryDialogView.tsx` **and**
`apps/dashboard/src/app/features/trading/tradeEntry/types.ts` (`EntryPrefill`, `LegDraft.right`) —
**added at pass 3; the mechanism does not compile without it.** Plus the shipped guard pinning
`TradeEntryDialogView.tsx` by exact path (`ai-rec.grounding.spec.tsx:516`), updated deliberately with its
pin re-proved. `LegFields.tsx` is **read, not edited** (see §2.5 [lane-check]); if it needs a cast, that
is inside this tree and inside the allow-list.

**Empty diff under `libs/quant-engine/` and under every signals / scoring / SSE module** — the structural
half of `[additive-keeps-score-byte-identical]`. The other half: `opportunity_score` /
`opportunity_tier` / `state_fingerprint` are served on a **different endpoint** that gains zero new
bytes, and the rec is not a fingerprint input at all.

**Failure modes + isolation.**

- **A missing token degrades to a literal, never an HTTP error** (`[best-effort-isolated-or-null]`) —
  mechanism, not intent: `plan_field_reason` has no `Result` and no fallible call; the route reuses the
  shipped `to_value(...).unwrap_or(Value::Null)` (`recommendation.rs:473-474`); the FE keys are optional,
  so `undefined` is a valid renderable state at every hop.
- **No `field_reasons` block at all** (pre-feature or unparsed): all six render `not given`. Never
  `unavailable` — nothing failed; the server simply never learned the token, and on the local-rules path
  `unavailable` would contradict the card's own line.
- **Never partially applied** — eleven keys built at one site, riding every `base` envelope.
- **One named uncovered branch:** `unavailable_envelope` (`recommendation.rs:706-727`) is the one envelope
  not built by `base`; it carries `"strategy": null`, no `field_reasons`, no rec body and no figures.
  Nothing is attached to it and nothing is claimed about it.
- **SSE carries zero new bytes.** All data here is STATIC, pinned to the rec's snapshot; an SSE drop
  leaves all six byte-identical, because dimming a pinned historical read would assert a staleness that
  did not happen.
- **The entry seam degrades to refusal, not to a block** — a response with no reason information still
  refuses to seed an absent value and still opens the dialog.

**Rejected approaches** (so a later session does not cheerfully re-propose them): widening `RecField` ·
a generic `&'static str` field key (destroys the exhaustive-match property that is the enforcement) ·
FE-side derivation from the null (`[digested-labels-not-raw-dump]`; it could not tell `not_given` from
`unavailable` anyway) · reusing the shared null-only presence closure (§2.2) · keying `unavailable` on
`candidate_quotes` (renders a cause known to be false) · reporting an off-scale confidence as
`value_present = false` (collapses two facts) · emitting `strikes: null` instead of `[]` (a type change
to a shipped field with five consumers) · any grounding state/marker/tint for the six · deleting the
three dead `unwrap_or`s as a fabrication fix · a hard block on Accept (mints a refusal vocabulary, takes
agency, dead-ends) · a single merged card-level line (asserts a causal link neither statement owns) · a
prompt change to make the producer emit these fields more often (unenforceable; the fix must work when it
omits anyway) · **a character-level em-dash source scan** (§7 — it would red against 50 legitimate
punctuation em-dashes in `copy.ts` and 57 in `AiRecPanel.tsx`) · **`LegDraft.right: OptionRight | null`**
(§2.5 — `''` follows the file's own two existing sentinels and needs no third convention) · **a
separate draft-level "unstated" flag beside a still-typed `right`** (a value that looks stated with a
side-channel saying otherwise is the `absent-is-not-none` collapse this feature exists to close).

### 2.7 What pass 3 corrected (so the same class is not re-introduced)

| Claim in pass 2 | Reality | Now |
|---|---|---|
| L2 queries slots "by the test ids the shipped card specs already use" | **False.** `Field` (`reasoning.tsx:22-53`) has props `{ label, value, tip, valueSx }` and **no `data-testid`**. Every `data-testid` in `AiRecPanel.tsx` is widget/line-level (`ai-rec-panel`, `no-trade-four-field-row`, gated-state boxes); the shipped specs locate values by **label text** | §7 L2 rewritten to label-text anchoring — the mechanism the specs genuinely use — with an honest note that five plan labels are inline literals today |
| `right: prefill ? prefill.right : 'call'` | **Does not compile.** `LegDraft.right: OptionRight` is non-nullable (`types.ts:152`) | §2.5 specs `OptionRight \| ''` following the file's own sentinel idiom, plus the `:317`/`:421` narrow |
| The seam is `AiPrefill` | **Incomplete.** The dialog's prop and `openEntry` both use **`EntryPrefill`** (`types.ts:24-40`, `TradeEntryDialogView.tsx:117`, `useTickerTradeFlows.ts:58`) | §2.5 widens both interfaces; §2.6 adds `types.ts` |
| "confirm its folder before editing" for the Accept hook | Unresolved | Path confirmed: `apps/dashboard/src/app/pages/ticker/useTickerTradeFlows.ts` |
| L3 glob cited as `{ query: '?raw', eager: true }` | Shipped scan is `{ query: '?raw', import: 'default', eager: true }` and scans **string literals only** after `stripComments`, with **two** anti-vacuity tests and a `MACHINERY_ATTR` carve-out | §7 L3 cites it accurately |
| The `FieldLiteral`→copy mapping is "a nested ternary at `:791-798`" | Range not verified; `RiskField` is `:758`, returning `<Field>` at `:787` and `:800` | §2.3 cites `RiskField` (`:758`) without pinning an inner range |

<!-- spire:council-resolution:v1 1d732b04e938dd635c51f472b2a71278ceabd06474a4da625d856c8f6792852f folded -->
<!-- spire:council-resolution:v1 8e25875a12f316c36ca60967f432cacf6d6ef34de84f93619c6f24b13492f46a folded -->
<!-- spire:council-resolution:v1 93f24b9f462ec347bd69b7676ea965e3a79d06d83b66e8a2a54258e8838e7cab folded -->
<!-- spire:council-resolution:v1 5b2404621cc96b433e2a73bad277972de477f697b3345ade2b2ab415c835d58d folded -->
<!-- spire:council-resolution:v1 a8b45b28624513471fe5e315e7541237b9661f920101bac88395fb4bfd27d4ed folded -->
<!-- spire:council-resolution:v1 acfb95e9e9f776814050e067e6b16bd02e49815fd36c6ac374af8ba040b5cfab folded -->
<!-- spire:council-resolution:v1 6b92405b15afb9d7c88f4d09d30f78af0d317e18f8b4833285c0f0ab2b2f899c folded -->
<!-- spire:council-resolution:v1 c7c2002e2f0bed94b4b661a17eab12ff0fac4567e4ae093c5fb75647e98cb41d folded -->
<!-- spire:council-resolution:v1 a453925eb273dbb4eff96cd0670fd6a66c102b0eafd19615e949081a296f99a6 folded -->
<!-- spire:council-resolution:v1 37648f312ef3d9a51919b5c72f203bc5e587b81595646879dd24c9ee30c5bb06 folded -->
<!-- spire:council-resolution:v1 78a4e7b91308b62491cac7144b4e5fdd7b65aad5caef925333935e4b389c44d8 folded -->
<!-- spire:council-resolution:v1 3981718337bd9e4f9b0d182b0b81f71b7668525ded8b1aeec008c18eb82d40fd folded -->
<!-- spire:council-resolution:v1 a516e662199821b1a5e3765c25d4b778527abcd9145089d5de20b225df7d97dd folded -->
<!-- spire:council-resolution:v1 fb9acbb00c3902ce697fbfaeb77ec3a381a5ece9ce28ef5ba06cdbd42fd58a2a folded -->
<!-- spire:council-resolution:v1 cc86f39ba19f1a0da64245ad605b891aa72afdeb9aabb4291c2f9eaf3a9385fa folded -->
<!-- spire:council-resolution:v1 f710490d3530338c8fe895012cff70ea6e2fa1766732faa62cc84a0d6eea2af9 folded -->

## 3. Acceptance criteria (with user stories)

- **US-1** — As a trader reading a `Trade` verdict, I want to see plainly when a field was never named,
  **so that** I do not act on a strike or expiration nobody chose.
- **US-2** — As a trader reading a `no_trade` verdict, I want `—` to keep meaning *"no entry, nothing to
  size"*, **so that** the one mark I trust does not acquire a second meaning.
- **US-3** — As a trader clicking Accept, I want a never-named field to arrive with nothing pre-typed and
  its reason, **so that** an omission cannot become a tracked position by default.
- **US-4** — As a trader on a degraded or older response, I want an honest literal rather than a blank, a
  `—` or a null-looking cell, **so that** I can tell a data problem from an omission.
- **US-5** — As a trader, I want the rec fully readable in every one of these states, **so that** an
  honesty improvement never costs me the advice I asked for.
- **US-6** — As the owner, I want to know how often a position-defining field is unnamed, **so that** I
  can judge whether the next fix is a prompt change or nothing at all.

**(SB)** = ship-blocking. Every row is observable from outside the source.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1 | On a **trade** card where none of the six was named, each of the six slots displays an absence literal from the closed vocabulary, and `—` appears in **none** of the six. | test |
| AC-2 | US-1 | On a **trade** card with three named and three not: the three named slots display the producer's text exactly as today and only the three unnamed slots change. A fully-specified rec renders identically to before this feature. | test |
| AC-3a **(SB)** | US-2 | On a **no_trade** card the five plan fields render **no row at all** — no row, label, placeholder, skeleton, ghost or reserved mark. | test |
| AC-3b **(SB)** | US-2 | On a **no_trade** card the four risk slots render the reserved mark with copy unchanged from today. | test |
| AC-3c **(SB)** | US-2 | No absence literal from this feature renders on any of those five plan fields on a `no_trade` card — the negative-space guard against reading AC-3a as an instruction to add rows. | test |
| AC-3d **(SB)** | US-2 | The conviction chip is the single carve-out from AC-3c: on a `no_trade` card an absent conviction renders `not given` as text — **never** the reserved mark, **never** nothing. `:956-996` keeps a **zero-line diff**; `:943-944` sits outside it. | test |
| AC-4 **(SB)** | US-1, US-4 | Rendering the three conditions **through the selector** — never-stated on a trade card, candidate-set-missing on a trade card, the reserved mark on a `no_trade` risk slot — produces three **pairwise-distinct** slot strings, each legible without hover, tooltip, colour or focus. **Proven non-vacuous:** collapsing any two conditions onto one literal (e.g. pointing the sibling selector's `unavailable` arm at `not_given`) makes this check go **red**. Comparing three string constants without exercising the selector does not satisfy this row. | test |
| AC-5 **(SB)** | US-4 | With **no per-field reason information at all** (pre-feature or degraded), the card renders in full, all six slots show **`not given`**, and no slot shows `—`, an empty cell, or `null` / `undefined` / `NaN`. No error state, no HTTP failure surfaces. | test |
| AC-6 | US-4 | A reason token this build does not recognise renders **`not given`** — never the raw token, never blank, never `unavailable`. | test |
| AC-7 **(SB)** | US-1 | A field returned as `""`, whitespace-only, or (for strikes) `[]` is treated as **not named** and shows its absence literal — not a named value rendered as a blank cell. | test |
| AC-8 | US-5 | On an SSE drop while a rec is on screen, all six slots keep exactly what they were showing: no flip to an absence literal, to `—`, or to a dimmed/offline treatment. | test |
| AC-9 | US-5 | On stale / stale-born / superseded, the six are unchanged; only the existing as-of / stale strips change. | review |
| AC-10a **(SB)** | US-1 | On a trade card **not** on the local-rules path missing one or more of Structure / Strike(s) / Expiration / Entry trigger, **exactly one** card-level standing line renders, stating the rec is not actionable as given and naming the missing field(s). With all four named, no such line renders. | test |
| AC-10b **(SB)** | US-1 | On a trade card that **is** on the local-rules path, **no** standing line renders however many of the four are unnamed; per-row literals still render and the shipped local-rules line is unchanged. | test |
| AC-10c | US-1 | On a trade card whose response declares **no** grounding path at all (pre-feature or degraded) with one or more of the four unnamed, the standing line **does** render. An exemption requires an affirmative local-rules declaration; missing information is never an exemption. | test |
| AC-11 **(SB)** | US-1 | A trade card missing **only** Time horizon and/or Confidence shows the absence literal on those slots, **no** standing line, and Accept behaves exactly as on a fully-specified card. | test |
| AC-12a **(SB)** | US-3 | Accepting a trade rec whose strike was never named opens the entry surface with **no strike a single confirm can submit**: no chain-derived strike, no nearest-available snap, no zero — plus a one-line reason naming the field. | test |
| AC-12b **(SB)** | US-3 | Same for expiration: no defaulted, inferred or carried-over expiration (specifically, not the first chain expiration). | test |
| AC-12c **(SB)** | US-3 | Accepting a trade rec whose structure was never named produces **no option direction a single confirm can submit** — including when the rec states a `bias` — and the surface states the read named no structure. There is no structure input to leave empty, so the observable is the derived direction. | test |
| AC-12d | US-3 | The reason line states only that the read did not give the field. It names **no cause**. | review |
| AC-12e **(SB)** | US-3, US-4 | The refusal to seed keys on the **value being absent**, not on a reason token being present: a response with no reason information at all but an absent strike still refuses to seed, and the reason line says only that the read did not give it. A degraded response never becomes a blocked Accept. | test |
| AC-12f **(SB)** | US-3 | **The submit gate itself is proven, not assumed.** A draft whose strike, expiration or option direction is unstated is **rejected by the confirm control**; a fully-stated draft is accepted. **Proven non-vacuous:** removing any one conjunct from the submit predicate makes this check go **red** for that field, and the check exercises the predicate (a fully-stated draft passes in the same run). Covers the case a superficial implementation produces — a dialog that *looks* unseeded but still submits. | test |
| AC-13 **(SB)** | US-3 | Accepting a trade rec whose structure, strike and expiration **were** named seeds the entry surface exactly as today, byte-identical — and opening the dialog **without** a rec prefill keeps today's nearest-strike / first-expiration / `call` defaults unchanged. | test |
| AC-14 **(SB)** | US-5 | In every state above the rec is never withheld, blanked, greyed, hidden or re-verdicted: the verdict headline for a given response is identical to today, and the producer's own words for every named field render unchanged. | test |
| AC-15 | US-1 | A card carrying both this feature's standing line and the shipped grounding line shows **both, never merged**, visibly distinguishable, neither restating the other's fact — and **at most two** card-level statements render on any card. | review |
| AC-16 | US-2 | Across every state exercised by AC-1 through AC-14, `—` appears in the **rendered value slots and chip labels** of the plan fields, risk fields and conviction chip **only** on `no_trade` cards, and there only in the four risk slots. The sweep reaches those slots from their **label text** (§7 Layer 2); card-level lines, tooltips and reasoning prose are **outside the queried set by construction**, not by exemption. | test |
| AC-17 **(SB)** | US-2 | Reintroducing a bare `?? '—'` at any of the six render sites makes the build go **red** in two independent places: `nx typecheck` (the typed literal) and `nx test` (the label-anchored render guard). Restoring the code makes both green. Both are demonstrated **non-vacuous** — the render guard proves it resolved **every one of its enumerated slots** (§7 Layer 2 arm (a)), and the pattern scan's poison is written in an **escaped** form. | test |
| AC-18 | US-1 | The distinct absence strings rendered on the card are a subset of the shipped closed vocabulary **plus exactly one addition, `unrecognized`**. No other absence word appears. | review |
| AC-19 | US-5 | The panel's existing non-rec states — unavailable, error, cooldown, daily cap, no key, signed-out — display current copy unchanged, and no absence literal from this feature appears on a card carrying no rec. | review |
| AC-20 **(SB)** | — | For the same request, `opportunity_score`, `opportunity_tier` and `state_fingerprint` are **byte-identical** before and after this feature. | test |
| AC-21 | US-6 | A committed artifact records, across whatever trade-verdict recs the gate actually observes, how many carried an unnamed position-defining field, and records **N honestly** — no floor, no threshold, non-gating. A zero observed rate on the model path does **not** retire the feature. | review |
| AC-22 **(SB)** | US-1 | When any of the six carries a **value**, its rendering is byte-identical to `main`: no clause, marker, chip, tint, type-register change or tooltip. (Carries `ai-rec-grounding` AC-25 forward.) | test |
| AC-23 | US-1 | `not set` and its `Set your risk inputs` action never render on any of the six — none of them depends on owner input. | test |
| AC-24 **(SB)** | US-1 | A conviction stated **off Convexa's scale** renders the single new word `unrecognized`; the raw string never reaches the chip or the DOM, and the slot never reads `not given`. | test |
| AC-25 **(SB)** | US-4 | `unavailable` renders on Strike(s) / Expiration only, only from an explicit `missing_input: candidate_set`, never from a fallthrough, and **never on the local-rules path**. | test |
| AC-26 | US-1 | The Expiration DTE caption renders only beside a stated expiration (the `value` member), never beside an absence literal, and never when either bound is unknown — no `?` reaches the DOM. | test |
| AC-27 | US-1 | The DTE caption reads as §4 pins it: a statement about the **request**, not a containment claim about the value. | review |
| AC-28 | US-5 | Loading, empty, error, no-key and every gated state render **no field row at all** for the six — no skeleton, placeholder or ghost. | test |
| AC-29 | US-1 | Every absence literal is real text in the value slot (a screen reader reads it without hover), ≥11px, and meets contrast in **dark and light**. | test |
| AC-30 **(SB)** | US-1 | The six reason keys ride **every** produced response, **including the local-rules path** — verified on a response body, not on the LLM path alone. | test |
| AC-31 **(SB)** | US-2 | `grounding` is byte-identical: the shipped `checked == 4` guard passes **UNEDITED**, the user-visible `n of m` pair prints the same two integers against a GATE-Q baseline, and none of the six enters that denominator. | test |
| AC-32 | US-1 | A tally test pins `RecField` at exactly 5 and `RecPlanField` at exactly 6, and a route-level test pins `field_reasons` at **exactly eleven keys with exact spellings** — they are hand-built with `json!`, so a typo'd key would otherwise silently render an absence literal on every field at once. | test |
| AC-33 **(SB)** | US-1 | On a local-rules trade card, `Time horizon` renders `not given` — the input-independent constant no longer renders as the read's own words. | test |
| AC-34 | US-4 | The tip on all six absence literals is **producer-neutral** (naming no AI and no rule), and `RISK_FIELD_COPY` and the four shipped risk fields are unchanged. | review |
| AC-35 | US-1 | Composition review on the local-rules card (`trade`, `strikes: []`, `expiration: null`): literals present, tip contradicting nothing on the card, card coherent beside the shipped local-rules line. **The fixture requires configured key material and consumes one in-process cap unit** (§7). | review |
| AC-36 **(SB)** | — | The change set touches only the §2.6 allow-list: **empty diff under `libs/quant-engine/`** and every signals / scoring / SSE module. | test |
| AC-37 **(SB)** | US-3 | The surface Accept opens is still the ONE shared simulated entry dialog — no fork, no second dialog — it stays `SIMULATED` behind its mandatory confirm, and no broker / order / execution path is reachable from it. | test |

**Method notes (risk-based).** `test` concentrates on what dies silently under an unrelated refactor: the
reserved-mark discipline (AC-1/3a-d/4/5/16/17) and the input boundary (AC-12a-f/13/37). Copy, placement
and non-rec states (AC-9/12d/15/18/19/21/27/34/35) are `review`, where a snapshot buys brittleness rather
than safety. No one-test-per-AC: AC-1, AC-16 and AC-36 are set-scoped over their fields on purpose.

**Three folds a checker should know about, because the source rounds disagreed:**

1. **AC-4 is cross-card and selector-exercising.** The earlier wording asked for one card showing *never
   stated*, *input missing* and *the reserved mark* at once — unreachable, since the reserved mark
   belongs to `no_trade` risk slots and the other two to trade cards. It is now pairwise distinctness of
   strings **rendered through the selector**, with its own poison.
2. **AC-10's observation moved off the primary fixture.** With the standing line exempt on the
   local-rules path, the keyless card cannot demonstrate AC-10a; it is observed on a constructed
   model-path response. Named consequence of the exemption ruling, not an oversight.
3. **AC-12f exists** because AC-12a/c can be checked off by an implementation that widens the type,
   renders an empty-looking control, and never re-derives the submit predicate. AC-12c gained "including
   when the rec states a `bias`" at pass 3, because `biasToRight:44` produces a direction from `bias`
   alone and would otherwise satisfy the old wording while the defect survives.

<!-- spire:council-resolution:v1 8552f7114aefd9f4f21dc29fe682da100f3257c8c6d4bc6c07caa14ac81cecc0 folded -->
<!-- spire:council-resolution:v1 79a2ec6d10461cad1f641b178c25ae0b71188ae5cf6eaef016127db0217028e3 folded -->
<!-- spire:council-resolution:v1 faf2c64749e8ddbda1e6cdb19dcbd73f2f724f45aad375701ef6627aed1e08a6 folded -->
<!-- spire:council-resolution:v1 79366d0a344b6930dc5f9d1b5b2a5ec265b426691199bd32b776238504c2f0bb folded -->
<!-- spire:council-resolution:v1 e762857c84e675082fb04a572430cac930fb6acf7988f10a3e38303ee2c6d841 folded -->

## 4. UI + interaction

**Flows.** (1) **Trade card** — verdict headline → shipped grounding line → (conditionally) the standing
line → risk block → plan rows → cited-contract line → exits → size → read context → reasoning. No section
added, nothing moved. (2) **no_trade card** — unchanged but for the hero conviction chip rendering the
never-stated literal when absent. (3) **Accept** — the ONE shared sim dialog opens; named fields seed as
today; never-named fields arrive **unseeded with a one-line reason**, and the confirm control does not
accept that state until the trader types a value. For an unnamed structure the Call/Put toggle opens with
**neither button selected** (`LegFields.tsx:159-163` renders `value={draft.right}`; the `''` sentinel
matches no button).

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Plan row (Structure / Entry trigger / Time horizon) | value verbatim, byte-identical to `main` | not rendered | not rendered | not rendered | unchanged — no dim, no `⏸`, no blank |
| Plan row (Strike(s) / Expiration) | value verbatim (+ DTE caption on Expiration) | not rendered | not rendered | not rendered | unchanged |
| Plan row, absent, no declared dependency | `not given` (+ producer-neutral tip) | — | — | — | unchanged |
| Plan row, absent, candidate set declared and empty (Strike(s) / Expiration, model path only) | `unavailable` (+ shipped tip); Expiration caption **suppressed** | — | — | — | unchanged |
| Plan row, no reason block at all | `not given` | — | — | — | unchanged |
| Conviction chip, trade branch | chip `low` / `medium` / `high` | not rendered | not rendered | not rendered | unchanged |
| Conviction, trade branch, absent | `not given` as **text**, chip suppressed | — | — | — | unchanged |
| Conviction, trade branch, stated off-scale | `unrecognized` as **text**, chip suppressed, raw string never rendered | — | — | — | unchanged |
| Conviction chip, `no_trade` hero, absent | `not given` as text — never `—`, never nothing | not rendered | not rendered | not rendered | unchanged |
| Card-level standing line | renders per AC-10a/c only; body text, no icon, no tint | not rendered | not rendered | not rendered | unchanged |
| Entry-dialog strike / expiration, named | today's value | n/a | n/a | n/a | n/a |
| Entry-dialog strike / expiration, never named | **unseeded** (the draft's `''`) + one-line reason; rejected by the confirm control | n/a | n/a | n/a | n/a |
| Entry-dialog direction, structure never named | **neither Call nor Put selected**; rejected by the confirm control | n/a | n/a | n/a | n/a |

Every gated state (no edge / cooling down / cap / no key / BYO / signed-out) replaces the whole card body,
so the six have **no skeleton, no placeholder and no ghost row** in any of them — negative space, so a
test (AC-28).

**Copy.** Reused verbatim from the shipped closed vocabulary, unchanged, with `RISK_FIELD_COPY`
untouched: `not given` · `unavailable` (its shipped tip *"An input this needed was missing this cycle.
Your other reads are unaffected."* stays true because the token now means exactly that) · `—` (reserved,
`no_trade` only) · `not set` / `Set your risk inputs` (unchanged and **unreachable on all six**).

New strings:

- **Producer-neutral tip for the six** (on the sibling entry, not `RISK_FIELD_COPY`):
  > `Nothing stated a value for this. Nothing failed; it was simply never filled in.`

  The shipped `not_given` tip reads *"The AI produced a trade read but didn't fill this in…"*
  (`copy.ts:192-195`) while the same card's local-rules line reads *"No AI read here — these figures come
  from Convexa's own rules."* (`copy.ts:252`) — two contradicting sentences on one card. The **word**
  `not given` holds in every state; the shipped **tip** does not, because it names a producer.
- **The one new vocabulary word** (decisions.md §C #21), for a stated-but-off-scale conviction:
  > `unrecognized` — tip: `The read named a conviction outside Convexa's scale. Convexa shows low, medium or high only; it won't repeat an answer it can't place.`

  Rejected on ux's own grounds: `off scale` (reads as *very high* — a fabricated direction);
  `unreadable` (collides with `unavailable` at 11–13px); the raw string (a dump the wire never vouched).
- **Card-level standing line** (a standing statement, not an absence word, so the no-new-absence-word
  rule is not engaged):
  > `Not actionable as given. Never named: {labels}.`

  `{labels}` are the row labels of the missing position-defining fields in card order — `Structure`,
  `Strike(s)`, `Expiration`, `Entry trigger` — joined with `, `. Producer-neutral.
- **DTE caption**, reworded from `· within your {min}–{max} DTE window` to:
  > `· your DTE window: {min}–{max}`

  The old phrasing asserts a property **of the value** nothing checks; the new states a property **of the
  request**, vouched by the owner's own filter. Renders on the `value` member only, and not at all if
  either bound is unknown — a literal `?` never renders. The dash here is **U+2013 (en dash)**, matching
  the shipped caption at `AiRecPanel.tsx:1094`; do not conflate it with the U+2014 the §7 guards target.
- **Entry-surface reason line** for an unseeded field: states only that the read did not give the field,
  and **names no cause** (AC-12d). Reuses the shipped withheld-prefill reason region — the same one
  `stopWithheldReason` / `targetWithheldReason` already render into (`types.ts:30-36`).

**Absence literals carry no warning chrome** — no `warning.*`, no icon, no tint, no chip. The standing
line is plain body text at card level, not a second amber statement.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The Curvature
Terminal).

**Design direction.** This feature **applies** the canon and invents no second system.
`[theme-token-discipline]`: the six render through existing `Field` / `Chip` chrome with **zero new hex
and zero new sx colour**, dark/light parity inherited; a new colour is out of this feature. Warning
severity is refused deliberately — DESIGN_SYSTEM's Components rule makes `warning.*` icon-mandatory, so
warning styling would drag an icon onto six fields (the "second signal to generalize from"
`ai-rec-grounding` AC-25 forbids), the card-level amber is already spent by the grounding line, and
green/red stay reserved for signed direction. The **type register** Amendment (2026-08-13) scopes itself
to surfaces where a grounding state exists; **none exists for these six**, so a register flip would
manufacture an authorship claim out of a field that has none. No register change. The Call/Put toggle's
existing green/put-red tint (`LegFields.tsx:166-169`, a domain fact on an instrument control) is
untouched — an unselected state simply shows neither.

**One required canon event this file may not perform.** `unrecognized` extends the closed not-a-number
vocabulary and is a **DESIGN_SYSTEM Amendments** event on the 2026-08-12 precedent. R4's lane is exactly
two files, so the row is **not** appended here. On approval, append to `## Amendments`: *"One new member
of the closed not-a-number vocabulary — `unrecognized` (the read named a conviction outside Convexa's
scale). Emittable from exactly one place (the confidence enum validation) so it cannot become a second
`unavailable`."* Cause: `rec-absence-literals-hole`, decisions.md §C #21. **Until that row exists, AC-18
is not closeable.**

<!-- spire:council-resolution:v1 62abd5432cded815832e2beca7604c7bbb0a61d0811510a99e31085a81ee2c0f folded -->
<!-- spire:council-resolution:v1 506bb34d414563b6b4f4160cc882a02b56ede6091cef8cc5d5ed3bf453393ff4 folded -->
<!-- spire:council-resolution:v1 296c37a70e80f1959adabf7afbe386bf3ca862807d2a2c420be17be113ed7240 folded -->
<!-- spire:council-resolution:v1 0c69d9391d29c2aeb15f4eb91edfe920fc3658d82889e1fd1457edb982247ac4 folded -->

## 5. Error handling

| Failure class | What the user sees | Logged / retried |
|---|---|---|
| Response omits `field_reasons` entirely (pre-feature server) | Card renders in full; all six read `not given`; no error, no blank, no `—`. The standing line still fires if a position-defining value is absent (AC-10c). | Nothing new. No retry; the card is pinned to its snapshot. |
| `field_reasons` present, a key missing or `undefined` | That slot reads `not given` (the sibling fallthrough), never `unavailable`. | Nothing new. AC-32's key pin stops this becoming systemic. |
| An unrecognised reason token | That slot reads `not given`. The raw token never renders. | Nothing new. |
| `serde_json::to_value` fails while building the object | The shipped `unwrap_or(Value::Null)` applies: `field_reasons` becomes null, the browser sees no block, all six read `not given`. Never an HTTP error. | Unchanged. |
| Candidate set empty on the model path | Strike(s) / Expiration read `unavailable` with the shipped tip. Unreachable on the local-rules path by construction. | Nothing new. |
| Conviction stated off Convexa's scale | The slot reads `unrecognized`. The raw model string is never painted. | Nothing new. |
| SSE drops while a rec is on screen | All six unchanged — no dim, no `⏸`, no blank. `⚠ Live offline` stays on live-derived tiles. | Unchanged. |
| Rec goes stale / stale-born / superseded | The existing card-level strips change; the six do not. | Unchanged. |
| Accept on a rec with an unnamed field | The dialog opens; that field is unseeded (strike/expiration blank, direction unselected) and carries a one-line reason naming the field and no cause; the confirm control rejects that state. The trader types a value and proceeds. | Nothing new. No block, no dead end. |
| `unavailable_envelope` (the one envelope not built by `base`) | Unchanged: no rec body, no figures, no `field_reasons`. Nothing claimed here. | Unchanged. |

The rec is **never** withheld, blanked, greyed, hidden or re-verdicted in any of these classes (AC-14).

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/rec-absence-literals-hole/INTERFACE_CONTRACT.md`

**Summary:** this feature **extends** `POST /api/recommendation/{ticker}` additively — six new keys on the
shipped `field_reasons` object, one new `ReasonKind` member, one new `MissingInput` member — and reads two
existing, unchanged GET endpoints. It is **not** `NO_BACKEND_CHANGE`. Every key spelling, token spelling,
nullability, presence predicate and evaluation order is authoritative in that file and is **not** restated
here; the machine-checkable conformance block lives there and only there. That file is unchanged at
passes 2 and 3 — every pass-3 correction is frontend-side and reaches no wire shape.

## 7. Testing strategy

**Structural enforcement — four layers.** The bar (`[structural-over-prose-enforcement]`): *poison the
thing the rule forbids and the build must go red, and the poison test must itself be proven non-vacuous.*
"The build" is `npm run ci` (lint → typecheck → test → build); the layers red at different stages.

**Why the obvious guard is not buildable, recorded so it is not re-proposed.** A character-level scan
forbidding U+2014 in this folder reds on day one against shipped, unrelated punctuation: observed counts
are **`copy.ts` 50, `AiRecPanel.tsx` 57, `literals.ts` 28** em-dashes, overwhelmingly prose punctuation in
copy this feature must not touch. An exempt set large enough to make that guard green would be ~135
entries and would enforce nothing. The defect class is **the em-dash reaching a rendered field value slot
or chip label**, not the character existing in a source file — so the guard is re-homed at the render
level, where the distinction is expressible. (`ci-standing-red` alarm fatigue avoided by design, not by
tolerance.)

- **Layer 1 — the type (reds `nx typecheck`).** The six call sites take `literal: PlanFieldLiteral`, not
  a rendered `React.ReactNode`. A bare `?? '—'` at any of them is a type error: `string` does not inhabit
  the union. Strongest layer — it cannot be evaded by escaping a character. **Bound:** it protects the
  six sites that adopt it, not a new seventh site reaching for the untyped `Field` directly.
- **Layer 2 — a label-anchored render guard (reds `nx test`).**
  **Mechanism, stated truthfully — no per-field test ids exist and none are invented.** The shared
  `Field` primitive (`reasoning.tsx:22-53`) has props `{ label, value, tip, valueSx }` and **no
  `data-testid`**; every `data-testid` in `AiRecPanel.tsx` is widget- or line-level (`ai-rec-panel`,
  `no-trade-four-field-row`, gated-state boxes), and the shipped card specs locate a field's value by
  **label text** and DOM traversal (e.g. `within(panel()).getByText(COPY.risk.maxRisk)` then walking from
  that element). **This guard reuses that shipped, proven mechanism**: for each enumerated field it finds
  the label element by its rendered label string, then reads the value `Typography` that `Field` renders
  as the sibling of the label `Stack` inside the same `Box` (`reasoning.tsx:36-51`); the conviction slot
  is the `Chip` label at `:1158` / `:944`. **[lane-check]** the exact traversal from label element to
  value element is a two-hop parent/sibling walk that must be written against the rendered DOM, not
  guessed.
  **Honest note on the anchors:** the four risk labels are `COPY.risk.*` constants, but the five plan
  labels are **inline string literals today** (`label="Structure"` `:1081`, `label="Entry trigger"`
  `:1100`, `label="Time horizon"` `:1153`). The guard anchors on the strings as rendered. **Recommended,
  not required:** since all six call sites are being edited anyway, hoist the five inline labels into
  `copy.ts` so guard and renderer read one constant — an improvement, and the guard works either way.
  **Assertion:** U+2014 appears in the resolved value slots only on `no_trade` cards, and there only in
  the four risk slots.
  **Non-vacuity, three arms** — arm (a) is the one that answers "the same PR invents the anchors and the
  guard, so a systematic mislabeling still passes":
  (a) **coverage with an exact count** — the guard declares its enumeration (six plan + four risk +
  conviction) and asserts **every** enumerated label resolved to a value element on a card where it
  should render, and that the resolved count equals the enumeration's length. Tagging or enumerating
  five of six reds, rather than passing as "non-empty".
  (b) **the poison** — restore a bare `?? '—'` at one of the six sites: the guard reds; restore the code:
  green.
  (c) **non-empty text** — each resolved slot has non-empty text, so a matched-but-blank slot cannot pass.
  **Bound:** it covers the slots it enumerates; a seventh field added later is covered only when added to
  the enumeration, and Layer 1 is what makes that omission a type error at the call site.
- **Layer 3 — a narrow source-pattern scan (reds `nx test`).** Targets the **coalescing pattern**
  `?? '—'` / `?? "—"` (and its escaped forms) within the ai-rec folder — a *pattern*, not a character, so
  it is silent against all ~135 legitimate punctuation em-dashes. It follows the shape of the shipped
  `bannedWords.scan.spec.ts` — `import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default',
  eager: true })` (`:13-17`), a spec-file filter (`:33`), `stripComments` before matching (`:38-40`), and
  **two** anti-vacuity tests (`:78`, `:132`) — but **not its rule**, which is a string-literal banned-word
  scan. No "byte-for-byte" claim is made; this is a different check in the same idiom. Two mechanical
  requirements: normalize escapes and HTML entities before matching and poison with an **escaped** form;
  normalize CR-LF to LF before matching (`core.autocrlf = true`, no `.gitattributes`; the
  `ai-rec-grounding` guard-8c pin failed closed on a fresh Windows checkout for exactly this) and never
  weaken the assertion to make it pass. **Bound:** folder-scoped, evadable by rewriting the expression —
  it catches the one spelling of the defect it names, and **AC-17 does not lean on it**; Layer 2 is the
  DOM-output assertion that no source-shape rewrite can evade. Note the shipped scan's `MACHINERY_ATTR`
  carve-out (`:45`) already exempts `data-testid`-style attribute literals, so neither scan is disturbed
  by test plumbing.
- **Layer 4 — the submit-gate guard (reds `nx test`), AC-12f.** The safety property the owner's ruling
  bought lives in one predicate (`TradeEntryDialogView.tsx:363`), and a build lane can widen the types and
  render an empty-looking control without touching it. The guard drives the dialog with an unstated
  strike, an unstated expiration and an unstated direction and asserts the confirm control rejects each;
  it asserts a fully-stated draft is accepted in the same run (non-vacuity); and removing any one
  conjunct from the predicate must red the corresponding case. It additionally covers the
  `structure: null, bias: 'short'` case, which is the one `biasToRight` path that produced a submittable
  direction after the owner's enumerated `:45` fix.

**Render regressions.** `decision: 'trade'` with all six omitted → six in-vocabulary literals, no `—` in
any resolved slot; the inverse `no_trade` fixture → `—` in exactly the four risk slots, no plan row
mounted; block-absent fixture → six `not given`; off-scale-conviction unit fixture → `unrecognized`.

**Backend guards.** (i) a unit test per field asserting `""` / `[]` / `"moderate"` do **not** produce
`unavailable` (the §2.2 hazard, poison-provable); (ii) the eleven-key route-level pin with exact
spellings (AC-32); (iii) the tally test pinning `RecField` at 5 and `RecPlanField` at 6; (iv) a test
proving `unrecognized_value` is unconstructable from `field_reason`; (v) a test pinning the sibling
selector's `unrecognized_value` arm; (vi) a test pinning **both** selectors' fallthrough defaults, so a
later merge reds.

**FE test tiers.** Unit (`literals.ts` selectors, `prefill.ts` incl. `biasToRight`'s new presence check),
component (`AiRecPanel` field rendering, the dialog's seeded/unseeded/submit states), integration (the
card against a mocked `POST /api/recommendation/{ticker}` response). **Integration mocks the network
boundary only** — never the selector, never the copy table, never the submit predicate.

**The observation fixture, stated honestly.** `AI_REC_LOCAL_ONLY` (`recommendation.rs:659-661`) selects
`local_strategy_from_bundle` (`:722-723`), which emits `"strikes": []` and `"expiration": null` on every
trade verdict (`:822-823`) — a deterministic `Trade · long` card with two genuinely absent plan fields.
**It is not free.** `recommendation.rs:704` returns the `unavailable` envelope before the `local_only`
branch unless `resolved.usable()` (`llm.rs:114-116`), and `commit_query()` (`:742`) runs on that path
too. The fixture **spends no provider money and makes no provider call, but requires configured key
material and consumes one in-process cap unit**, and the `no_fresh_edge` gate (`:710`) and cooldown
(`:716`) short-circuit ahead of it. **No AC may describe it as free.**

**Invariants that must never silently regress:** the reserved-mark discipline; the submit gate's three
conjuncts; `grounding` byte-identity (the `checked == 4` guard **unedited**); the eleven-key set;
`unrecognized_value`'s single emit site; the two selectors' distinct defaults; the entry-seam refusal
keyed on the value, not the token; the empty diff under `libs/quant-engine/`; score / tier / fingerprint
byte-identity.

## 8. Guardrails this feature must not break

- **`[absent-is-not-none]` (HARD — the rule the defect violates).** Enforced in the **type**
  (`PlanFieldLiteral`) and the **closed vocabulary** (`FieldReason`), never in prose: `""`, `[]` and an
  off-scale `confidence` are **absent**; never-named must not collapse into we-failed; *"answered off our
  scale"* must not collapse into *"never answered"*; an absent conviction on a `no_trade` card must not
  collapse into rendering nothing; the rule is applied to the dependency flag itself (`PlanInputPresence`,
  interface contract §1); and at the entry seam the unstated case is carried as a **distinguishable
  sentinel the submit gate rejects**, never as a plausible default with a side-channel note.
- **`[digested-labels-not-raw-dump]`.** The wire token is authoritative; the browser never re-derives a
  literal by testing a null; `confidence` renders through a closed lookup, never as raw model text. The
  same discipline is applied client-side in `biasToRight`, whose `(structure ?? '')` collapse is replaced
  by an explicit presence check (§2.5).
- **`[structural-over-prose-enforcement]`.** Four layers (§7), each poison-proved with its non-vacuity
  arm stated and its bound named. A guard that cannot demonstrate it bites is not enforcement — and
  neither is one that reds against shipped unrelated code, nor one whose anchors are invented by the same
  change that writes the guard without a coverage assertion.
- **`[theme-token-discipline]`.** Tokens only, dark/light parity, zero new hex, zero new sx colour.
- **`[additive-keeps-score-byte-identical]`.** Module boundary (`rec_inputs/mod.rs:1-3`) + the §2.6 diff
  allow-list + a different endpoint. The rec is not a fingerprint input at all.
- **`[best-effort-isolated-or-null]`.** No fallible call added; a missing token is a literal, never an
  HTTP error.
- **`[single-shared-sim-entry-dialog]`. Honored, not narrowed** — a change to the ONE shared sim dialog's
  seeding and its own draft type, never a fork. The narrowing reserving a structurally separate component
  for real-money entry is untouched.
- **`[no-real-order-path]`.** The Accept surface stays `SIMULATED` behind its confirm; no broker, order or
  execution path is added or reached.
- **`[ai-asserted-numbers-are-traceable]` — 2nd instance.** `ai-rec-grounding` covered what the producer
  **asserts**; this covers what it **omits**.
- **`[live-vs-static-isolation]`.** Every new datum is STATIC; SSE carries zero new bytes.
- **`[score-change-is-deliberate-and-measured]`** is not engaged: no figure and no score changes.

## 9. Open questions

1. **`ai-rec-grounding` SPEC §9 item 5 closes in HALF ONE ONLY — half two is a named surviving
   residual.** Half one (the false not-applicability verdict `—` on **absent** fields) closes outright:
   replacing it removes the only Convexa verdict those six ever rendered, so there is nothing left to
   generalize *from*. Half two (generalizing *"no clause means checked"* from the marked fields onto
   **stated** structure / trigger / horizon / conviction) does **not** close, because the unconditional
   scope caption was cut on line budget. One line cannot carry both the conditional fact and the scope
   fact without asserting that this rec's missing field is why those fields go unchecked, which is false.
   **Binding record rule (pm's R3 #24): no gate report, ledger row or BACKLOG line may record §9.5 as
   closed while half two stands.**
2. **The conviction label is not unified.** One wire field, two labels — `Confidence` (the trade-branch
   caption above the chip at `AiRecPanel.tsx:1158`) and `conviction · {level}` (`:944`). ux asked pm to
   pick one; pm never answered, and R4 is not one of the three voices. **Default: both labels unchanged
   this feature.** The status quo is on record as unacceptable to ux.
3. **The two bare `—` fallbacks in `quoteTextFor` (`literals.ts:101-102`) are a booked residual.** They
   are null-IV / null-delta fallbacks on the cited-contract line, which renders on **trade** cards. Under
   the label-anchored Layer-2 guard they fall outside the resolved set **by scope, not by exemption** —
   so no exemption list carries them, and this entry is what keeps that from laundering the defect away.
   On the merits they are the same defect class as the six. ux asked pm to rule them in or out; pm never
   answered; fixing them is future-dated.
4. **`unrecognized_value` is confidence-only, by construction.** architect asked ux whether an unparseable
   `expiration` or a whitespace-only `structure` is the same fact as an off-scale conviction; never
   ruled. Behaviour is determinate anyway (whitespace ⇒ absent ⇒ `not_given`; no date validation is
   added) and the token has one emit site. Whether another field should ever earn it is future-dated —
   deliberately, because a second emit site is how this word becomes a second `unavailable`.
5. **`grounding`'s observed baseline is not yet recorded.** AC-31 pins byte-identity against *the observed
   pair*, captured at GATE Q. architect derived the shape from source and could not run the server. The
   AC pins unchanged-ness, not an integer, precisely so this gap cannot red the build against a card that
   changed in no way.

*(Pass-1 open question 5 — `time_horizon`'s no-other-consumer precondition — is CLOSED with evidence at
§2.4. The three `[lane-check]` items in §2.5/§2.6/§7 are build-lane confirmations, not council questions:
MUI's `value` prop against the widened `right`, the `EntryPrefill` pass-through bodies, and the
label-to-value DOM traversal.)*

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"1d732b04e938dd635c51f472b2a71278ceabd06474a4da625d856c8f6792852f","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"8e25875a12f316c36ca60967f432cacf6d6ef34de84f93619c6f24b13492f46a","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"93f24b9f462ec347bd69b7676ea965e3a79d06d83b66e8a2a54258e8838e7cab","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"5b2404621cc96b433e2a73bad277972de477f697b3345ade2b2ab415c835d58d","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":4,"conflict_id":"a8b45b28624513471fe5e315e7541237b9661f920101bac88395fb4bfd27d4ed","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":5,"conflict_id":"2ef39a6d2f9bd55a07c1dd9df4e4f7577abd70a67eb07106fd9198d124b7533a","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":6,"conflict_id":"8552f7114aefd9f4f21dc29fe682da100f3257c8c6d4bc6c07caa14ac81cecc0","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":7,"conflict_id":"acfb95e9e9f776814050e067e6b16bd02e49815fd36c6ac374af8ba040b5cfab","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":8,"conflict_id":"6b92405b15afb9d7c88f4d09d30f78af0d317e18f8b4833285c0f0ab2b2f899c","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"c7c2002e2f0bed94b4b661a17eab12ff0fac4567e4ae093c5fb75647e98cb41d","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"79a2ec6d10461cad1f641b178c25ae0b71188ae5cf6eaef016127db0217028e3","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":2,"conflict_id":"faf2c64749e8ddbda1e6cdb19dcbd73f2f724f45aad375701ef6627aed1e08a6","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":3,"conflict_id":"62abd5432cded815832e2beca7604c7bbb0a61d0811510a99e31085a81ee2c0f","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":4,"conflict_id":"79366d0a344b6930dc5f9d1b5b2a5ec265b426691199bd32b776238504c2f0bb","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":5,"conflict_id":"a453925eb273dbb4eff96cd0670fd6a66c102b0eafd19615e949081a296f99a6","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":6,"conflict_id":"37648f312ef3d9a51919b5c72f203bc5e587b81595646879dd24c9ee30c5bb06","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":7,"conflict_id":"78a4e7b91308b62491cac7144b4e5fdd7b65aad5caef925333935e4b389c44d8","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":8,"conflict_id":"532e12570f3a03591a3339d40b075d1836fda6120b2673b88cc5e9fd69207751","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":0,"conflict_id":"3981718337bd9e4f9b0d182b0b81f71b7668525ded8b1aeec008c18eb82d40fd","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":1,"conflict_id":"a516e662199821b1a5e3765c25d4b778527abcd9145089d5de20b225df7d97dd","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":2,"conflict_id":"506bb34d414563b6b4f4160cc882a02b56ede6091cef8cc5d5ed3bf453393ff4","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":3,"conflict_id":"296c37a70e80f1959adabf7afbe386bf3ca862807d2a2c420be17be113ed7240","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":4,"conflict_id":"e762857c84e675082fb04a572430cac930fb6acf7988f10a3e38303ee2c6d841","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":5,"conflict_id":"0c69d9391d29c2aeb15f4eb91edfe920fc3658d82889e1fd1457edb982247ac4","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":6,"conflict_id":"cbc170be7d560b5de922609f89600f47dd8eb78560a728a58564712963271e2f","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":7,"conflict_id":"fb9acbb00c3902ce697fbfaeb77ec3a381a5ece9ce28ef5ba06cdbd42fd58a2a","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":8,"conflict_id":"cc86f39ba19f1a0da64245ad605b891aa72afdeb9aabb4291c2f9eaf3a9385fa","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":9,"conflict_id":"f710490d3530338c8fe895012cff70ea6e2fa1766732faa62cc84a0d6eea2af9","disposition":"folded","section":"§2"}]}
-->
