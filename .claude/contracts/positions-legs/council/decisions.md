# positions-legs — council decisions (R3 reconcile)

> Controller-maintained. Every conflict from `conflicts.json` and how it was settled — agent-resolved
> or owner-ruled. R4 transcribes from here; it invents nothing.
>
> **Validator result:** 18 conflicts raised, **18 accepted, 0 rejected** — every quote verified
> character-exact against its named source (`.kit-staging/verify_conflicts.py`). Split: 8 `product`,
> 10 `technical`.

## Agent-resolved (technical) — 10 of 10 settled, one exchange each

| # | Raised | Against | Outcome |
|---|---|---|---|
| 2 | architect | pm | **CONVERGED.** Recognised set = PM's §1(b) list applied literally → a **22-member** `StructureKind`. `butterfly`/non-iron `condor` **out** (→ `custom`); `protective_put`/`collar`/`iron_butterfly` **in**; equity split `shares_long`/`shares_short`; straddle/strangle split long/short. **Governance:** PM owns membership · UX owns labels · architect owns the recogniser + a total 1:1 map. Zero durable bytes. |
| 3 | architect | pm | **CONVERGED.** The recogniser is a **total exact-match function with no confidence measure, and must not acquire one.** Criterion: *any leg set that is not an exact match for a v1 named structure renders `Custom`; Custom is the residue of an exact match, never a judgement.* PM: AC-9 reworded, new AC-9a. |
| 4 | architect | pm | **CONVERGED.** A `provenance { migrated_at, source_counts{read,contributed}, merge_notice_dismissed }` block written in the **same single promote-write**. PM's product half composes: the notice survives reload until dismissed, never reappears after. **Failure mode (load-bearing): corrupt or absent provenance must NEVER re-arm the migration** — it is non-load-bearing by construction and can cost at most one notice, never a record. |
| 5 | architect | ux | **CONVERGED (ux withdrew R1 assumption 7).** Migration lifts a legacy record to a leg; the recogniser derives from the leg; the old `Strategy` value is **not** carried forward. U2 restated: *a **well-formed** migrated single-leg option position renders as shipped with unchanged P/L; a malformed record legitimately renders `Custom`.* |
| 7 | pm | architect | **CONVERGED (pm).** A cash-secured put and a naked short put have **identical leg sets**; the distinguishing fact is collateral, a stated non-goal absent from v3. `cash_secured_put` removed from the v1 named set — trader sees **`Short put`**. Rule adopted: *if the thing that makes a name true is a **leg**, it can be named; if it is a fact about the **account**, it cannot.* Covered call / protective put / collar survive. New AC-8a. **No opener-declared `intent` field in v1** — the Webull importer produces positions with nobody present to declare intent, so the field would mean "you typed something," not "this is what you hold." |
| 12 | ux | architect | **CONVERGED.** **Four distinct vertical members**, so no enum member renders two trader-facing names; UX's closed `STRUCTURE_LABEL` lookup gets a valid domain. Architect rejected the `right`-on-the-view-row alternative (pushes label composition into the component). **New hard rule: `structureKindOf` never reads `entry_price`** — debit/credit comes from **strike geometry**, so a mistyped price cannot flip a label. |
| 13 | ux | architect | **CONVERGED.** "Rides with the number" was a data requirement stated in layout words. Committed a **discriminated `pl_pct_state`** (four branches, `basis` **required** on the value branch). Architect ruled out rendering the literal `undefined`/`null`/`NaN` (indistinguishable from a React interpolation bug in a screenshot, and it collides with U8's test oracle); **UX supplies the word.** |
| 14 | ux | architect | **CONVERGED**, plus a requirement UX's ask implied but did not name: **fault determination is synchronous at store init**, so no frame ever paints enabled affordances on a faulted store. Architect **HELD** strict refuse-all-writes against a "write to a fresh key" alternative — a fresh key **re-creates the two-disagreeing-stores condition this feature exists to eliminate.** |
| 15 | ux | architect | **CONVERGED.** `eval_subject` as a three-branch projection field. Architect self-corrected twice: a **`leg.id` final tiebreak** (else the alert subject can change on reload) and a **short-leg fallback** (its R1 rule silently killed the alert for every short put). |
| 17 | ux | pm | **CONVERGED (pm withdrew the sentence).** Per-leg `entry_price` typed; **net computed and disclosed as computed**; no back-solving anywhere in v1 (it would fabricate facts into the audit spine). Net-only broker fills named as the **importer's** problem with a trigger, not schema'd here. AC-11 amended, new AC-11a/11b. |

## Owner-ruled (product) — pending

| # | Question | Status |
|---|---|---|
| 1 · 6 · 11 | **Payoff math** — do max loss / breakeven / max gain ship? Raised independently by all three voices. Both architect and PM escalated rather than settling. Agreed facts: deferring costs **no schema and no migration**; the danger is **under-detected unbounded risk** rendering a confident finite max loss. | **PENDING OWNER** (A max-loss-only for named defined-risk single-expiry · B all three · C none + rewrite the BRIEF's Decision-impact line) |
| 9 | **`position_eval` primary-leg approximation** — disclose or suppress for multi-leg | QUEUED |
| 10 | **Group-by-Expiry** returning to the toolbar — a reversal of a shipped owner decision arriving unremarked inside a migration | QUEUED |
| 18 | **Call/put tint canon conflict** — `DESIGN_SYSTEM.md` L42–43 reserve success/error for "calls / puts"; `convexa-design` rule 2 says direction only. Two owner-owned documents disagree | QUEUED |
| 8 | **Faulted-store write policy** (strict vs lenient) — UX wrote both versions of the single sentence that changes | QUEUED (small; may fold into 1) |
| 16 | 393px space for three risk figures + three withheld-reason sentences | **MOOT if #1 = A or C** — folded into that decision |

## Controller findings (verified in code, not asserted)

- **`useGhostTrade` returns `alerts` (line 543) and NO component renders it.** `TickerDashboard.tsx` has zero references. UX flagged this as a dependency; I verified it. **Consequence:** the entire `position_eval` copy section is for a surface that does not currently exist — R4 must either scope the surface in or mark the copy as pending a consumer. This is dead output in shipped code.
- **AC-23 is false as written.** Id collisions between `positions.v2` and `ghost-trade.v1` are the **expected case, not an edge case** — `positions/store.ts:48` carries `id: t.id` forward verbatim, so "count-after = sum of both counts" fails for exactly the trader the migration exists for. **Must be restated as a distinct-id count.**
- **U8 becomes three-way**, at UX's insistence and correctly: `—` (not applicable) · `unavailable` (failed this cycle) · **`not recorded`** (never held) — each with its own testid, identical `text.disabled` treatment, differing by text only. A migrated record with a missing `right` rendering `—` would tell the trader "not applicable" about a fact that *is* applicable and simply was never recorded. Also needs `UNPRICEABLE_RECORD_TIP`, since the shipped tip promises transience ("couldn't be priced *this cycle*") and a record with no strike will never price.
- **The faulted state is NOT scoped to `/positions`.** The Ticker page opens the same dialog against the same store, so a banner only on `/positions` ships the exact silent loss it was written to prevent. Nobody else named this.
- **Refused controls use `aria-disabled="true"` and stay focusable**, not the HTML `disabled` attribute — a `disabled` MUI button swallows pointer events so its tooltip never opens, making the reason for refusal unreachable by keyboard and hover. That is precisely the failure the state exists to prevent.
- **Live defect pulled in-scope (from R1, unchallenged):** `positions/store.ts` has no fault latch — `read()` catches to `memory = empty()` and the next `putPosition` → `write()` **destroys the unparseable blob**. `orders/store.ts` already guards correctly. This half-violates `loss-free-durable-migration`'s "degrades to empty WITHOUT destroying the original" **in shipped code today**.
- **Migration is a UNION executed once**, never re-run (a repeat resurrects deleted records), v1 writer killed in the same release, and the promote **aborts entirely if any source is unreadable** rather than freezing a partial history behind a key that claims completeness. Grounded in `outcomes/sources.ts` documenting that v1-only positions are permanent.

## Explicitly NOT conflicts (all three cohere — locked)
Multi-leg entry in scope · whole-position-only close · `Custom` as a neutral first-class bucket (not an error) · all-or-nothing partial marks (one unresolved leg ⇒ no P/L, because dropping a short leg renders a loser as a winner) · no same-contract dedupe/merge · the union migration · multi-leg **orders** deliberately out (a resting composite limit inherits the every-leg-live rule — a second feature).
