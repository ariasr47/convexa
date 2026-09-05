# R3 — architect resolutions: curvature-v2-desk-and-read

One exchange, ten technical conflicts, no round after this. Every verdict below settles on a
`file:line` read, an owner ruling number or a canon rule — never on seniority.

| # | conflict (short) | other voice | verdict |
|---|---|---|---|
| 1 | `never last known` on the gamma-flip cell | ux | **resolved-agree** |
| 2 | A6 folds `cooldown` + `daily_cap` into one case | ux | **resolved-with-correction** |
| 3 | `containerName: 'panel'` applied at the strip | ux | **resolved-agree** |
| 4 | "byte-identical" covering the canvas field | ux | **position-stands** |
| 5 | null level's distance cell left blank | ux | **resolved-agree** |
| 6 | both schemes at all four overflow widths | pm | **position-stands** |
| 7 | 834 dated to phase 4 | pm | **resolved-agree** |
| 8 | distance anchored on the mid | pm | **resolved-agree** |
| 9 | eight cells / `unavailable` for off-exchange | pm (against me) | **conceded** |
| 10 | demote-or-delete the `Live`/`Mid` word | ux (against me) | **conceded** |

**Promoted to product: zero.** One resolution (#4) has a bounded dependency on a pending owner
ruling, named in its entry; it does not wait on one to be settled as written.

---

## 1 — the gamma-flip cell and `last known` · **resolved-agree**

**Converged mechanism.** ux's R2 ask states our agreement in its own words — *"does the retention
latch expose `retained` as a boolean derived **only** from stream-sourced values, so a bundle
fallback like `LiveTape.tsx:96`'s `?? m.gamma_flip` can never set `retained: true`?"* — and the
answer is yes, by construction:

- the latch (my §2.6) stores the last **non-null stream** value only, keyed by a reset token of route
  symbol + replay-armed state, cleared on both (ruling 2's two required clears);
- `retained` is computed **from the latch**, never from the composed render value. `LiveTape.tsx:190`'s
  `retained: flipValue != null` is deleted: `flipValue` at `:96` is `(numbersActive ? live?.gamma_flip
  : null) ?? m.gamma_flip`, so it is true over a REST number that never came off the stream. That is
  the defect ux diagnosed and I accepted at R2;
- `· last known` therefore renders **iff** the latch is non-empty, which is exactly ruling 2's
  "the clause is **data-driven** … never as a fixed caption".

**The one residual, and what settles it.** ux's R1 substitute — show the *structure* flip under the
live cell on a drop — is not available, and it is settled by ruling 2's binding text, not by my
preference: *"The offline state has **two arms** … The second renders the not-a-number literal with
the pause marker and **no** 'last known' words."* Arm B is the empty-latch render. Swapping in
`m.gamma_flip` would be a third arm, and it would put a different measurement under a live label at
the moment the stream died — the two flips differ by construction (PROJECT_CONTEXT §3; the live one
is repriced against the live mid). ux's own CI-4 sub-copy requirement, which names the structure flip
the live cell differs from, is the thing that makes the two numbers legible in one viewport; it is
adopted unchanged.

Net: ux's UX-10 ("no figure renders `offline · last known` over a value sourced from the REST
bundle") and my latch are the same requirement stated at two levels, and both ship.

## 2 — A6 `cooldown` / `daily_cap` · **resolved-with-correction**

**I withdraw the A6a/A6b split.** ux's R2 case list already contains the correct idiom one row down:
*"A8 add a key (eight non-collapsing reasons inside it)"*. That is a body case whose non-collapse
obligation lives **inside** it, and it is the right shape here too — cooldown and cap genuinely share
a layout (disabled control + footnote + pinned last read), so forcing two peer rows would buy nothing
the A8 treatment does not already buy, and it would inflate the case list against ux's composition
model, which I accept in full.

**The correction, which is the substance I raised and do not withdraw.** A6's parenthetical must read
like A8's, and the marker assertion must key on the shipped constants, because they are shipped and
non-synonymous: `presentationPolicy.ts:16-17` declares `cooldown` and `daily_cap` as two distinct
members, and `ai-rec/copy.ts` ships `cooldownLabel` at `:167` (`Cooling down · {remaining}s`) vs
`capTitle` at `:169` (`Daily AI limit reached — resets {when}`), `cooldownCaption` at `:173` vs
`CAP_CAPTION` at `:170`, and `retryInCooldown` at `:186` vs `retryWhenReset` at `:187`. Four pairs, no
synonyms. So: **A6 carries two non-collapsing reasons inside it; a build that renders a capped user a
countdown red-builds**, asserted with the `BrokerGroupHeader.spec.tsx:193-194` idiom (assert the
literal that must *not* appear) rather than a tally.

Mapping stays total via my §2.5 `(requestState, resultState) -> ReadLayout` function with a `never`
default arm, so this costs no new union member and no new test idiom. Whether the case list also gains
**A10 request failure** is the owner's Amendments call already in the queue; my correction here is
independent of it.

## 3 — the container name at the strip · **resolved-agree**

ux self-revised at R2 to exactly the mechanism I proposed: *"Each strip cell is wrapped in
`PanelContainer` … the strip is a rail, not the container context."* Converged mechanism, restated
once for R4: `FigureCell.tsx:216-217` queries `theme.containerQueries('panel').down(360)` / `.down(280)`
and CSS resolves `@container panel` against the **nearest** ancestor bearing the name; `Widget.tsx:163`
and `PanelContainer.tsx:16-17` are the only two declarations of it. Name at the cell, nested, no edit
to `FigureCell`'s query and none to `type-floor.spec.tsx`'s AC-20a assertion. The bottom sheet
re-declares the name at its own root because MUI portals it to `document.body` and severs the
ancestry. ux also adopted the `[lane-check]`: jsdom does not evaluate container queries, so a unit
test may assert the **declaration** only and the stepping behaviour is browser-layer or `review`.
Nothing left open.

## 4 — "byte-identical" applied to the field · **position-stands**

Not addressed in ux's R2, so it stands on its R2 evidence, which is two independent problems:

(a) **Internal contradiction, not a preference.** UX-42 / H3 require the field's drift to **stop** on a
drop. A surface whose motion must stop is by design not identical across a drop, so a build satisfying
UX-42 red-builds UX-11 and vice versa. This half needs no new evidence — it is ux's own two rows.

(b) **Unobservability.** `StructureFieldCanvas` paints to a Canvas2D context and its directory carries
zero `aria-`, `role=` or visually-hidden text; `live-dot-census.spec.tsx:171` counts DOM nodes and
`single-motion-moment.spec.ts:54-55` scans for literal `@keyframes` names. No shipped harness can read
a canvas pixel, so "byte-identical" over the field is an AC nobody can run.

**Resolution as I state it for R4:** scope the byte-identical clause to what has DOM text — the strip's
static cells, the ladder's four structure rows, the quiet band — and state the field's obligation in
its own terms: on a drop the curve, the wall lines and the flip line keep their last computed geometry
and are not dimmed, while trail, drift, beam and sweep stop. The only mechanism on the table that can
observe that is my §1 one: extract the paint step into a pure function of `(model, ctx, now, reduced)`
and drive it against a recording fake 2D context — `live: false` → zero trail points, zero particle
`arc()` calls, zero sweep gradient fills, non-zero level strokes. I priced that extraction at R1 as
the largest mechanical cost in the phase and I have not made it cheaper here.

**Bounded dependency, named:** if the owner rules the AC-12 canvas **text-equivalent** clause IN, part
(b) changes — the field's values would then have DOM homes and a text assertion over *those* becomes
real. Part (a) is unaffected by any ruling: a stopped drift is still not an identical frame. So this
resolution is correct under either outcome; only the proof surface for the values moves.

## 5 — the null level's distance cell · **resolved-agree**

ux self-revised at R2 and withdrew "with no distance value": *"UX-15 → 'A null level keeps its row and
its label, renders a closed-vocabulary member in 15px Sans in the value cell, renders `—` in the
distance cell, and never renders `$—`.'"* That is the converged rule, and it removes the inconsistency
I raised (the mid row's absent distance typed at CI-9 while the null level's was blank). Mechanism:
`distanceToLevel.ts:24-25` already returns `null` when either input is missing, so this is a caller
choice at the ladder, not a change to the helper. No tenth member (non-goal 10 holds; ruling 3's
closure at nine is untouched). Member selection for the **value** cell follows the AC-20 narrowing, not
a reason the frontend cannot observe.

## 6 — both schemes at all four overflow widths · **position-stands**

`no-overflow.spec.ts:43-45` records the decision in terms: *"ONE SCHEME for the wider bands,
deliberately: horizontal overflow is box geometry and dark/light change no widths … 393px keeps BOTH
schemes because that is where content is tightest."* `:47-54` declares `WIDE_VIEWPORTS` as 834 / 900 /
1280, and `manifest.json` carries `393px no-overflow · dark scheme` **and** `· light scheme`, with
`tablet 834 no-overflow · dark scheme` (`:604`) and no light counterpart at any wide band. The
criterion as written is therefore either certified against runs that do not exist, or a silent
doubling of the wide-band matrix that reverses a documented decision.

**Criterion to write:** both schemes at 393; one scheme at 834, 900 and 1280. Widening the wide bands
to two schemes is available to the owner as a **scope addition** — three widths × the manifest's
per-route walk, with the runtime cost named in the build report and `no-overflow.spec.ts:43-45`
rewritten rather than contradicted. Nothing in this phase requires it, which is why I am not promoting
it: correcting a criterion to the suite it names is a factual correction, not a priority call.

**Explicitly not waiting on the hero light-mode ruling.** That ruling decides whether
`StructureFieldCanvas`'s unconditional `INK` fill is fixed or booked as debt; it does not change the
overflow matrix, because a dark plate overflows nothing. If it lands IN, its proof is a browser review
at both settings — not a widened overflow suite.

**Execution condition that survives either shape:** the row is provable with `npx playwright test
--list`, not with a passing summary. `playwright.config.ts` is an explicit `testMatch` allowlist and an
unregistered spec reports green by never running.

## 7 — 834 dated to phase 4 · **resolved-agree**

pm self-revised at R2 and verified the correction at source. Converged: `no-overflow.spec.ts:51`
declares `{ label: 'tablet 834', width: 834, height: 1112 }` inside `WIDE_VIEWPORTS`, `:48-50` records
it as the v2 addition made against canon rule 17, and `manifest.json:604` pins the shipped dark-scheme
cases. 834 shipped in phase 1. The future-dated row and the Scope-Out clause go; the true obligation is
smaller — **keep 834 green through the desk rebuild**. The BRIEF's phase-4 clause is corrected with them.

**One detail in pm's own proposal corrected:** *"AC-24 and AC-78 already assert 393 / 834 / 900 / 1280
and are now assertions against a suite that runs all four today"* — true on the **widths**, not on the
**schemes**. See #6: the wide bands run one scheme by design.

**Coupling that must be kept deliberately, not by luck:** `no-overflow.spec.ts:398` uses
`page.getByText('Call wall').first()` as the readiness anchor for `/ticker/TSLA` at every width, and
this phase deletes the component that renders that text today. ux confirmed at R2 that the ladder keeps
the exact label words `Call wall` / `Put wall` (decisions §2: the side is in the label words), so the
anchor survives — but a rename reds ~12 e2e cases for a reason nobody will connect to a copy change,
and that is why the words are pinned rather than assumed.

## 8 — the distance anchor · **resolved-agree**

pm self-revised at R2 and read the same lines: `_kit/distanceToLevel.ts:11-14` anchors on
`levelSpot(m) = m.gex_spot ?? m.price`, `DealerPositioning.tsx:61` passes exactly that, and
`copy.ts:318` labels `gex_spot` "levels spot" with the comment "NOT spot — the levels anchor is not the
live display price". All three lanes converge, independently, on the same criterion:

> Every non-mid row shows its distance from the ladder's declared anchor (`gex_spot` else `price`); the
> ladder names that anchor once; the mid row's distance cell renders the not-applicable member (`—`),
> never a computed zero and never an empty cell.

Two mechanisms behind it, restated so R4 does not have to re-derive them: a computed zero would assert
the mid equals the structure anchor, which it usually does not (`gex_spot` is the last session close
when the market is closed); and anchoring the column on the live mid makes all four structure rows
recompute on every tick — five live rows — which canon 14 forbids in the same sentence AC-16 is drawn
from. The **canon rule 14 wording amendment** is ux's product conflict, already in the owner's queue,
and I do not re-raise it; the AC text above is correct under the current wording and under the amended
one.

## 9 — the eight strip cells and off-exchange · **conceded**

I accept pm's position in full, and it is a better answer than the withdrawal I made at R2. My R2
proposal ("the off-exchange cell is the declared exception — absent when the object is absent — the
strip's cardinality is 7-or-8") over-corrected: it fixed the fabricated-cause problem by recreating
`[absent-is-not-none]` in the scroll axis, which is ux's own risk 5 — at 393px a cell that is not there
is indistinguishable from a cell that scrolled off the rail. **I withdraw the 7-or-8 cardinality
clause.** The strip is eight fixed slots at every state, no reflow, as my §5.3 originally required and
as ux's S4 needs.

The member the off-exchange slot renders is the one whose recorded meaning is "the feed did not send
it" — which asserts nothing about whether `INCLUDE_DARK_POOL=false` suppressed it or the best-effort
computation failed, the two causes PROJECT_CONTEXT §5 makes indistinguishable at the frontend with an
empty `apps/api` diff. That member is already in the closed nine and already glossed exactly that way:
`shared/copy/notANumber.ts:9` (`not provided` — "the feed did not send it"), exported at `:48`. The
same file records the precedent that makes a per-surface choice legitimate rather than sloppy
(`:14-16`: "THE TYPE ENFORCES CLOSURE; THE CALLER PICKS THE MEMBER … `brokerView.ts` substitutes
NOT_RECORDED → NOT_PROVIDED per surface BY DESIGN"). No tenth member, no new copy branch, non-goal 10
intact. The wire-level attempted-vs-failed discriminator is booked as named debt with a phase attached,
per ux CI-6. The literal itself is the copy lane's to confirm; my constraint is the meaning and the
closure.

## 10 — the `Live`/`Mid` word · **conceded**

ux is right and my R1 offered an option that cannot be exercised. Rule 13's provenance mark is a **dot
plus a visually-hidden word** (`FigureCell.tsx:129-148`), not a visible one, so "demote to a per-figure
provenance mark" deletes the word either way — my second option was the first option wearing different
clothes, which is the mechanism-I-cannot-name failure in my own lane. And the datum is the mid, which
already receives exactly one mark inside the same frame at the ladder's mid row (canon 14, ux CI-7 /
UX-14); a second mark on one number in one panel reads as two claims about it.

**One piece of evidence I add, because it is the reason deleting costs nothing.** The word's only
informational content today is a *basis* fallback, not a connection state: `TapePulseStrip.tsx:71`
computes `displayMid = liveMid ?? structureMid` and `:73` pushes a trail point every rAF frame
unconditionally, so `Mid` means "you are looking at the structure mid moving". This phase removes that
fallback from the trail — canon rule 22 forbids a moving trail without a delivering stream, and my §1
re-points the gate at the one claim predicate — so after the fix the word describes a state that no
longer exists. Deleting it removes no information.

**Converged:** the word is deleted. The mid's label is a label, not a claim; its liveness is carried by
the ladder mid row's single per-figure dot; its basis is stated once in the hero head. If the tape-trail
row needs a truth marker on a drop it uses the pause mark and the H3 caption, never the word `Live`.
My R1 §1 "deleted **or** demoted" collapses to "deleted", and non-goal 12 (no second page-scope
liveness word) is unchanged.

---

## What R4 should fold from my side

Withdrawn or amended by me in this round, in the words that replace them:

1. **R2 self-revision on the strip's cardinality is itself withdrawn** (#9). The strip is **eight fixed
   slots at every state**; the off-exchange slot renders the "feed did not send it" member. Delete the
   "7-or-8, stated in SPEC" clause.
2. **R1 §1's two-option sentence on the `Live`/`Mid` word collapses to one** (#10): deleted.
3. **R2's A6a/A6b split is withdrawn** (#2). A6 stays one body case carrying **two non-collapsing
   reasons**, asserted with the not-appearing-literal idiom, exactly as ux treats A8's eight.

Nothing else in my R1 or R2 changes. Three claims I am still carrying that no voice has attacked, so
they reach R4 unopposed and should be read as load-bearing rather than settled: the branded claim type
on every liveness-bearing prop (§1), the extracted pure paint step as the only harness that can observe
the canvas (§1, #4), and "exactly one component in the hero calls `useLiveTape()`" (§3) — which ux
adopted at R2 as the mechanism behind UX-12 / UX-14.
