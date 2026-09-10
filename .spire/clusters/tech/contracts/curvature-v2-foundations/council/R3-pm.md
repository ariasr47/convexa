# R3 — pm reconcile: curvature-v2-foundations

Eight conflicts are mine (`kind: technical`, not a self-revision, and I am `raised_by` or `source`).
Four are against my own criteria and I concede three of them outright; two are evidence-method
splits where the requirement survives and the harness changes; one is a rule of mine that named half
its subject; one I raised and ux has already withdrawn.

**Promotions to product from this round: none.** Every one of these was settleable on bytes, and the
one genuine value call underneath them — where the call/put side goes once the colour is deleted —
is already on the owner's desk as conflict `aa432be6d1`. I am not spending an eighth question.

**What I re-verified myself this round** (not taken on report):
`shared/ui/index.ts:7` mentions the accent-bar primitive only in a prose comment and exports it
nowhere · three files import it — `_kit/StatTile.spec.tsx:15`, `live-tape/LiveTape.tsx:35`,
`dealer-positioning/DealerPositioning.tsx:25` — and there are **16 render sites**
(`DealerPositioning` 12, `LiveTape` 4) · `DealerPositioning.tsx:105,112` carry the directional
`up`/`down` accent on Call wall / Put wall, whose values are bare dollar strikes with no side in
them, while `:123-129`, `:139` and `LiveTape.tsx:140-141` derive the same accent from a sign that is
already rendered in the value · `CommandDeck.tsx:213` keeps a second chip renderer attached with
`aria-hidden={!condensed}`, comment at `:195` · `type-floor.spec.tsx:39` reads styles with
``css.split(`.${cls}{`)[1]?.split('}')[0]`` — it stops at the first `}` · `Widget.tsx:157` is the
only `containerType` in the tree and there is no named container anywhere.

---

## architect -> pm — "that primitive is consumed by seven files … and is re-exported from the shared UI barrel" (`375497904a`)

**Verdict:** conceded

**Evidence or restatement:** Both halves are false and I confirmed it independently.
`apps/dashboard/src/app/shared/ui/index.ts:7` carries only the prose sentence about the primitive
staying ticker-local — there is no export. Exactly three files import it and only two of them are
product code: `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx:35` and
`apps/dashboard/src/app/pages/ticker/widgets/dealer-positioning/DealerPositioning.tsx:25`, with 12 +
4 = 16 render sites between them. My §2 seam ruling priced the accent-edge deletion as an app-wide
change; it is one page.

**What the spec should say:** The accent-edge deletion is confined to two ticker widgets and sixteen
render sites. The app-wide visible change this phase is the **radius migration plus the token
rebind** — that, not the tile count, is what earns the six-screen two-scheme review list, and the
list stays exactly as I fixed it. Drop "seven consumers" and "shared UI barrel" from the record so a
later phase cannot re-derive scope from them. AC-13 and AC-22 are re-attributed accordingly:

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-13a | US-1 | After this phase no figure anywhere in the app renders a coloured accent edge, and the old accent-edge anatomy cannot be reintroduced by copy-paste. | test (source scan, mutation proof recorded) |
| AC-22a | US-1 | On the ticker page, every card that showed a stat figure before this phase shows the same label and the same value after it, in both schemes. | review |
| AC-22b | US-1 | On landing, positions, scanner, settings and alerts, the only visible before/after difference is the corner radius and the rebound surface/line colours — no figure's label, value, wording or position changes on any of the five. | review |

AC-22 as one row was trivially true on five of its six screens once the count is corrected. Split
this way, AC-22b is a real assertion about the radius sweep and AC-22a is a real assertion about the
anatomy change, and neither can pass by being vacuous.

---

## ux -> pm — same claim, reached independently (`66880f71d7`)

**Verdict:** conceded

**Evidence or restatement:** Same bytes; ux additionally located the true re-export at the
ticker-local `_kit` barrel. I note that ux made the same error in its own R1 and withdrew it, and
that my R1 assumption 2 to the architect — stated as falsifiable "on all seven of its current
consumers" — is the thing the graph falsified. It is falsified; I withdraw it.

**What the spec should say:** As above, plus the record-hygiene half: the sweep is a hand-edit across
two files, not a codemod, and the seam ruling in §2 is restated with the verified numbers rather than
re-derived. The related question — whether the four hand-rolled look-alike widgets on the same page
convert in this phase — is **already before the owner** as conflict `faafda397d`; I am not answering
it here and the synthesizer should not let it fall out of the record when this block lands.

---

## architect -> pm — AC-1, "exactly one liveness claim — counting the chip, any live dot, any pulse and any 'live' wording" (`4e55339426`)

**Verdict:** conceded

**Evidence or restatement:** My R2 self-revision kept the criterion's wording and moved only its
evidence. That was not enough and I withdraw the rest. The wording enumerates "any live dot", and
both other lanes ship a per-figure dot that canon rule 13 requires — so a correct implementation of
this phase violates AC-1 as written, on the ticker page, by design. The second defect is
independent: `CommandDeck.tsx:213` keeps a second chip renderer attached at all times
(`aria-hidden={!condensed}`, comment at `:195`), so any assertion over *attached* nodes is wrong in
both directions at once. I keep the honesty content — one page-level authority on liveness — and I
withdraw the count that was supposed to carry it.

**What the spec should say:** Three rows in three scopes, replacing AC-1:

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1a | US-2 | On a page with a delivering stream, exactly one **visible** page-level liveness claim is present — the connection chip — and no other page-level statement of stream state appears anywhere on that page; the chip reads live and names the mid it is showing. | test (browser layer, where visibility is real) |
| AC-1b | US-2 | A figure carries a live marker only when that figure's displayed value arrived from the delivering stream; in each of the five non-live chip states, no figure on the page carries one. | test |
| AC-1c | US-2 | With the stream delivering, a figure whose value comes from the static bundle rather than the stream carries no live marker, even inside a widget that is itself marked live. | test |

AC-1a must be measured on visible claims, not attached nodes — a node count red-builds a correct
build. AC-11 (all liveness motion stops when the stream drops) already carries the "subordinate
signals cannot outlive the stream" half; do not mint a duplicate row for it.

---

## ux -> pm — AC-1 again: canon rule 13's per-figure dot is unimplementable under it (`fb357c5ed0`)

**Verdict:** conceded

**Evidence or restatement:** Same concession, and I adopt ux's vocabulary as the vocabulary the
criteria are written in: **page** (the chip), **widget** (the frame's live bar), **figure** (the
marker in the label row) are three scopes that never merge. Rule 18's "second liveness claim" is
about a second page-scope authority — which is why the strip's stream-state text is still in scope to
fold into the chip — not about subordinate markers.

**What the spec should say:** AC-1a/1b/1c above. AC-1c exists because of the specific case ux named:
a bundle-read figure sitting inside a live-marked widget would inherit a liveness claim it has no
right to if the read were per-widget. That is the failure a per-figure rule is *for*, so it needs a
row of its own rather than a clause inside AC-1b — the two can fail separately. Whether the per-figure
fact exists at render time is the architect's answer to my outstanding ask; if it does not, AC-1b and
AC-1c are the rows that must be re-marked, not quietly merged into a per-widget read.

---

## architect -> pm — AC-20's container step cannot be produced in the harness I routed it to (`02fb47ab68`)

**Verdict:** resolved-my-position-stands on the requirement; conceded on the evidence

**Evidence or restatement:** Saying which half explicitly, since three critiques land here: **the
requirement stands unchanged** — the figure size step is driven by the panel, not the window — and
**the evidence I attached to it is withdrawn**. My harness note routes component/state rows to jsdom,
and jsdom performs no layout, so that row would pass with the container rule deleted. That is the
hollow automation my own risk 3 names. I also confirmed the architect's caveat at source: the shipped
style-reading idiom at `type-floor.spec.tsx:39` splits at the first `}`, so it reads the base rule
only and is structurally blind to a conditional block.

**What the spec should say:** Two rows, two harnesses, both real:

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-20a | US-1 | The compiled styles for a figure value declare a size step at each of the two panel-width thresholds with the three declared sizes, and no caption size steps below the 11px floor at any of them. | test |
| AC-20b | US-1 | At one fixed viewport width, the same figure rendered in a wide panel and in a narrow panel **on the same screen** shows two different sizes, the narrower panel showing the smaller step — so the step follows the panel, not the window. | test (browser layer) |

Two notes the build lane must carry rather than discover: AC-20a is `test` **only once the
style-reading helper is hardened to read a conditional block** — on today's helper the row cannot
fail honestly and must be recorded UNVERIFIABLE and dropped to `review` instead of marked green.
AC-20b is phrased as two panels at one viewport precisely so it fails if the step is keyed to the
window; a single narrow-viewport measurement would pass under a viewport breakpoint and prove
nothing. Two panels of different widths already coexist on the ticker page at a wide viewport, so
this costs no new layout.

---

## ux -> pm — same AC-20, marked `review` in ux's own §9 (`f03e702908`)

**Verdict:** resolved-agree on the split; my position stands on the mark

**Evidence or restatement:** ux and the architect reached the same jsdom limit independently and I
accept it. Where I differ is only the `Verify by` on the rendered row, and that is my column. A
container step that silently degrades into a viewport step is invisible to a reviewer working at a
normal window size — that is textbook silent regression, so it earns `test`, and the browser harness
to run it already exists.

**What the spec should say:** AC-20a / AC-20b as above, with AC-20b marked `test` in the existing
browser suite. The honest fallback, recorded rather than assumed: if the browser suite cannot produce
two differently-sized panels on one screen without re-laying out a surface this phase promised not to
touch, AC-20b drops to `review` with the two measured sizes written into the build report — never to
a jsdom row asserting style text while the criterion's words promise a rendered result.

---

## ux -> pm — R-I names the tier-emphasis colour but not the directional one (`69a309e75a`)

**Verdict:** conceded

**Evidence or restatement:** R-I ruled on one of the two things the deleted edge carries and I
verified the half it missed. `DealerPositioning.tsx:105` and `:112` set the directional accent on
Call wall and Put wall, and those two values render as bare dollar strikes — the side is in the
colour and **nowhere else**, so deleting the colour deletes the distinction. That trips my own
out-of-scope line, "any narrowing of what the trader can currently tell", and nothing in the suite
would notice. The other directional sites are not in the same position: `:123-129`, `:139` and
`LiveTape.tsx:140-141` derive the accent from a sign the value already prints, so for those the
colour is redundant and its deletion loses nothing.

**What the spec should say:** R-I splits into two cases with separate criteria.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-13b | US-1 | Opportunity-tier emphasis survives the accent-edge deletion in type and the single amber word — no replacement colour, and never a directional one. | review |
| AC-13c | US-1 | After this phase a trader can still tell Call wall from Put wall in a **greyscale** screenshot of the dealer-positioning strip, without opening a tooltip. | review |

Also record the negative, so a later phase does not re-litigate it: figures whose value already
prints its own sign need no replacement mark, and adding one is not in scope. AC-13c binds whichever
way the owner rules on conflict `aa432be6d1` — it is written about the outcome, not the mechanism. If
the ruling puts the side into the label words, AC-13c upgrades from `review` to `test` for free,
because the words are then assertable; if it adds a non-colour mark, it stays `review` on a greyscale
capture. **Silent deletion is the one outcome AC-13c forbids**, and that is the whole reason the row
exists.

---

## pm -> ux — "⇧↵ adds to the scan view" is a write the palette does not have (`e4de8e35ec`)

**Verdict:** resolved-agree

**Evidence or restatement:** ux withdrew it in R2: *"Recents and my P5 binding `⇧↵ adds to the scan
view` both sit inside what PM future-dated, and that is PM's call to make, not mine. I withdraw
both."* Nothing is left in dispute. I record that ux withdrew on my scope grounds and explicitly not
on the architect's cost argument, which was separately shown to be wrong — the deferral rests on
future-dating, not on a durable-migration cost that does not exist.

**What the spec should say:** The palette is read-only in phase 1 and its helper row names exactly
move / open / close. Nothing else in ux's palette bindings changes, and AC-24, AC-25, AC-27, AC-28,
AC-30, AC-31 and AC-33 stand as written. One constraint goes on the **Future-dated** entry rather
than into a phase-1 row, because minting a guard row for a capability that does not exist is scope I
am not adding: when a palette write does arrive, it arrives with a stated success confirmation and a
stated signed-out refusal, and no helper row advertises a binding before both exist. That is the gap
that made the binding uncheckable this round, and it should not have to be rediscovered next phase.
