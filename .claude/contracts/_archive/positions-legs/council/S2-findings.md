# S2 — skeptic findings: positions-legs

**Verdict: PASS, with two Important fixes recommended before build and one citation nit.** I traced
all 18 conflicts in `council/conflicts.json` against `council/decisions.md` and then against
`SPEC.md`/`INTERFACE_CONTRACT.md`; none were silently dropped. I verified the spec's factual claims
about the real code (`positions/store.ts`, `orders/store.ts`, `resolveDurable.ts`, `model/mark.ts`,
`useGhostTrade.ts`, `positions/types.ts`) line-by-line and found every one accurate. I checked the
four owner rulings word-for-word against their transcription in the spec and found no weakening or
widening. I found no scope creep past the BRIEF and no invented copy where the spec claims none was
invented. I did find one real cross-section ambiguity that risks a HARD guardrail if a builder reads
one AC in isolation, and one place where §7 quietly pre-empts an "open" question in §9 without saying
so.

---

## Critical (blocks — must loop back to R4)

*(none found)*

---

## Important (should fix)

### 1. AC-74's wording invites suppressing the FETCH, not just the render — which would break the HARD `additive-keeps-score-byte-identical` guardrail

- **File/section:** `SPEC.md` §3 AC-74 vs §2.8, §6, §8.

AC-74 reads: *"For a position with more than one leg **no position-context evaluation is produced
anywhere in the app**."* Read in isolation — which is exactly how `qa-verify` is supposed to be able
to read an AC, per this spec's own rule that "Each AC is observable without reading code" — this says
the evaluation itself must not occur for a multi-leg position.

But §2.8 says the opposite about the mechanism: *"No wire change. The `pos_*` params are unchanged
and derived from the selected leg; **the fetch is unconditional and its shape never branches**, so
the request stays byte-identical and the *render* decides."* And §6/§8 both bind
`additive-keeps-score-byte-identical` and state the `pos_*` request shape is unchanged. So the
intended design is: the fetch/evaluation is still produced by the backend exactly as today; only the
**render** suppresses it for multi-leg.

A fresh FE builder who takes AC-74 at face value could "fix" it by branching the fetch on leg count —
which directly breaks the `pos_*` byte-identical requirement (AC-77, §6, §8) and reopens the exact
risk `additive-keeps-score-byte-identical` exists to close. Conversely, a QA reviewer testing AC-74
literally (e.g., inspecting the network tab for a multi-leg position) will see the `pos_*` request and
`position_eval` still arrive and could fail a *correctly built* feature.

**Smallest fix:** reword AC-74 to name the mechanism it actually governs, e.g.: *"For a position with
more than one leg, no position-context evaluation is **surfaced to the trader** — no alert, no
reassessment hand-off, no assessment readout anywhere in the app. The underlying fetch is unchanged
and unconditional (§2.8); suppression is a render decision only."* One sentence closes the gap.

### 2. §7 already commits to building the seeded stale-saved-view fixture, but §9 Q5 still presents "whether to build it at all" as open — a fresh implementer gets two different answers

- **File/section:** `SPEC.md` §7 (Test tiers, "Fixtures the suite does not have today") vs §9 Q5.

§7 flatly requires a new fixture: *"a **seeded saved view** whose filter references a stale value
(without it, the stale-view AC is unverifiable at GATE Q)."* That only makes sense if AC-54 (§3, "test"
tier) ships in full, notice and all — §7 is written as if Q5 is already resolved in favor of building
it.

§9 Q5, however, still frames this as unsettled: *"leaves open whether the **notice copy plus its
seeded fixture** are worth building and verifying in v1, or whether AC-54 should be reduced to 'opens,
shows rows, never throws, never writes' with the notice deferred."*

A fresh implementer reading §7 alone would build the full mechanism-plus-notice-plus-fixture (matching
AC-54 as literally written); reading §9 alone would reasonably conclude the FE lane should wait for an
owner/UX call before writing the notice copy and fixture. The two sections disagree about whether
this is still an open decision.

**Smallest fix:** either (a) resolve Q5 in §9 to say "the fixture is being built regardless per §7;
the only remaining question is the notice's exact copy, not whether the mechanism ships," or (b) add a
one-line caveat to §7's fixture bullet noting it is contingent on Q5's resolution.

---

## Minor / advisory

### 3. "Echoed by PM's own cut order" overstates consensus on the max-loss eligible set

- **File/section:** `SPEC.md` §2.4 ("architect R2 proposal (b), echoed by PM's own cut order").

§2.4 ships a 9-member max-loss eligible whitelist (four verticals + iron condor + iron butterfly +
covered call + protective put + collar) and cites it as coming from "architect R2 proposal (b),
echoed by PM's own cut order." Checking `council/conflicts.json` directly: the architect's proposal
(b) does list all 9 (*"verticals, iron condor, iron butterfly, covered call, protective put,
collar"*), but PM's own R2 cut-order proposal (a) — the thing actually being cited as an echo — lists
only 6: *"verticals, iron condors, iron butterflies"*, with no mention of covered call, protective
put, or collar. PM never signed off on those three in the passage cited.

This doesn't change the outcome — §9 Q2 already (correctly) flags the whole set as unenumerated by
the owner ruling and pending confirmation — but the citation implies a stronger cross-role agreement
than the source text shows, which could make a reader treat 6 of the 9 members as more settled than
the other 3 when in fact none of the 9 has been individually ruled on.

**Smallest fix:** drop "echoed by PM's own cut order" or replace with an accurate description (e.g.
"a superset of PM's own narrower cut-order proposal, which named only the four verticals plus iron
condor/butterfly").

### 4. The amended `DESIGN_SYSTEM.md` canon text is looser than the spec's own application of ruling #18

- **File/section:** `docs/design/DESIGN_SYSTEM.md` L42–43 vs `SPEC.md` §4 ("Call/put tint").

The amended palette-role column reads: *"Position + P&L surfaces: **direction only** (long/bullish,
+P&L) — never call-vs-put"* for `success`, and the long/short-mirrored phrasing for `error`. Read on
its own, "(long/bullish, +P&L)" reads as two possibly-different, loosely-equated criteria — a future
reader of the canon doc alone (not `SPEC.md`) could take it to license tinting a **long** position
green regardless of its current P&L sign, which is exactly the error ruling #18 was closing ("a short
call is bearish... tinting a position green because it contains a call tells the trader the opposite
of the truth" applies equally to tinting by position side rather than P&L sign).

`SPEC.md` §4 itself is unambiguous and does not repeat this looseness — it names the five exact spots
where tint appears and all five are signed-dollar-direction (`pl`, `pl_pct`, subtotal, sparkline,
realized close), never leg side or structure. So this is not a defect in `SPEC.md`; it is a
loose-canon-doc note worth a follow-up cleanup of the L42–43 wording, out of this feature's own scope.

---

## Checked and clean

- **Dropped conflicts (checklist #1).** Traced all 18 entries in `conflicts.json` to their resolution
  in `decisions.md` (10 agent-resolved/technical: #2–5, #7, #12–15, #17; 8 product: #1/#6/#11 folded
  into one owner ruling, #8, #9, #10, #16, #18) and then to their appearance in `SPEC.md`. Every one
  surfaces somewhere in the spec — either folded into architecture text (§2), an AC (§3), a copy
  block (§4), a guardrail (§8), or an explicit open question (§9). None is silently absent.
- **Owner-ruling fidelity.** Compared all four owner rulings word-for-word against their spec
  transcription: max-loss closed-set-not-heuristic (§2.4 title is a near-verbatim quote of the
  ruling), `position_eval` suppression for multi-leg (§2.8), faulted-store STRICT
  refuse-every-write + synchronous-at-init + not-scoped-to-`/positions` + `aria-disabled`-and-still-
  focusable (§2.9, §4, AC-61–69), and the scoped call/put tint (§4, quoting "a short call is bearish"
  verbatim). No weakening or widening found in any of the four.
- **`loss-free-durable-migration` mechanics.** Union-once (§2.6), abort-the-promote-entirely-if-any-
  source-unread (§2.6, Failure modes table), never-delete (§2.6, §8), idempotence /
  no-resurrection-on-repeat-load (§2.6, AC-47/58), corrupt-or-absent-provenance-never-re-arms
  (Failure modes table, AC-59), and the single-lift-function-shared-by-store-and-archive-import rule
  (§2.6, §7 point 1) are all present, consistent with each other, and consistent with
  `council/decisions.md`'s controller findings. The live defect repair (AC-56) targets a verified real
  bug: read `apps/dashboard/src/app/features/trading/positions/store.ts` lines 131–133 (`catch { memory
  = empty(); }`) followed by `write()` at line 141 (`localStorage.setItem(V2_KEY, …)`), which does
  destroy an unparseable-but-recoverable blob on the next write — confirmed by reading the file
  directly. `orders/store.ts` (lines 27, 58–99) confirmed to already have the correct pattern
  (`faulted` flag set on parse failure, `write()` refusing when `ordersFaulted()`), which the spec
  cites accurately as the pattern to copy.
- **AC-46 (migration count).** Confirmed the spec ships a **distinct-record-id** count ("not the
  arithmetic sum of the two counts — id collisions are the expected case"), not a sum-of-both-counts
  formulation. This matches the controller finding in `decisions.md` line 39 and is correctly grounded
  in the real code: `positions/store.ts`'s `v1TradeToPosition` (line 50, `id: t.id`) carries the id
  forward verbatim, confirming collisions are indeed the expected case, not an edge case.
- **§6 interface discipline.** `SPEC.md` §6 points at `INTERFACE_CONTRACT.md` and explicitly declines
  to restate its field list. Cross-checked the conformance block's required fields
  (`option_quote`/`greeks`/`iv`/`dte`) against the real backend (`apps/api/main.py`
  `get_tracked_contract`, ~line 1148) and the real FE client (`libs/api/src/lib/convexa.ts`
  `fetchTrackedContract`, line 920) — the shapes match; no drift found.
- **Copy the spec says it did not invent.** Grepped `SPEC.md` for `no_basis`'s word, any "merge
  notice" text, and the string `Unlimited` — none appear anywhere outside the explicit "not yet
  decided" framing in §9 Q1/Q3/Q4. No component state is left with a claimed-but-absent copy string;
  every "unchanged"/"existing" tip (`ROW_UNAVAILABLE_TIP`, `PENDING_PL_TIP`, `EMPTY_NO_POSITIONS`) is
  explicitly marked as inherited from shipped code, not newly specified here.
- **Scope creep.** Grepped for `BrokerPosition`, `Webull`, `apps/api` — every occurrence is inside an
  explicit Out-of-scope/Future bullet or the `NO_BACKEND_CHANGE` declaration; nothing introduces
  broker code, a real order path, or a backend diff.
- **`aria-disabled` vs HTML `disabled`.** Every refused-control reference in the spec uses
  `aria-disabled="true"` + "remains focusable"; the HTML `disabled` attribute is explicitly named and
  rejected in the Not-buildable/rejected-approaches list (§2, "Not buildable" table). No stray
  `disabled` slipped through.
- **§9 calibration.** Q2 is explicitly self-flagged as blocking the build lane (not silently
  downgraded); Q1/Q3/Q4 are genuinely copy-only in that the architecture, ACs, and component-state
  behavior around them are already fully specified in §2–§4 independent of the missing word/strings;
  Q5 is a legitimate scope call given both shipped `Strategy` values map forward under the new
  recogniser (verified against `positions/types.ts` — `Strategy = 'long_call' | 'long_put'`, both of
  which are members of the 22-member `StructureKind`).
