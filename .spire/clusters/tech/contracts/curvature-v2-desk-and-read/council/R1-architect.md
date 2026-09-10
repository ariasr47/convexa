# R1 — architect position: curvature-v2-desk-and-read

> Lane: data-structure CONTENT, data-flow, component boundaries, isolation/error rules, explicit
> non-goals, restated binding constraints. No UI/layout, no endpoint signatures, no payload field
> names, no copy. Every load-bearing claim about existing code was read at source this round and
> carries `file:line`; anything I could not read carries `[lane-check]`.

---

## Position

### §0 — Binding constraints I restate (not re-litigated)

**Owner rulings from phase 1 that bind this build** (`contracts/curvature-v2-foundations/council/decisions.md`):

| ruling | what it binds here |
|---|---|
| 1 | The chip slot carries a **wordless** placeholder until the first stream fact, then latches irreversibly. `connectionState.ts:99` already implements this as `live == null → null`, and `:15-20` records why `live !== null` is monotonic. Nothing this phase may reintroduce a path back to the placeholder. |
| 2 | The `LiveTape` last-non-null retention latch is **this phase's debt**, and the `· last known` clause is **data-driven** — it renders only when a retained value exists. `FigureCell.tsx:172` already types `offline?: { retained: boolean } \| null`; `FigureCell.tsx:255-276` already implements both arms. The change is at the **call site plus a latch**, not in `FigureCell`. |
| 3 | One closed union of **nine** not-a-number members (`shared/copy/notANumber.ts:26-36`). The **type enforces closure, the caller picks the member.** A tenth is an Amendments event. Acceptance asserts closure and non-synonymy, never a count. |
| 5 | 44px is scoped to what this phase **creates or touches**. `theme.ts:80-102` applies the coarse-pointer floor to the selector list `button, [role="button"], a` only, so any new interactive element that is none of those three escapes the floor and needs explicit sizing. |
| 6 | `ai-rec/AccessibleHelp.tsx` is the **only** focusable-ⓘ pattern. `FigureCell.tsx:51,305` already consumes it. Do not invent a second. |
| 8 | Tier emphasis survives in the **word**, in type only — never a replacement colour, least of all a directional one. `DealerPositioning.tsx:220-229` renders `"{score} · {tierWord}"` as one traced Mono value with no colour prop. That composition moves to the read strip unchanged. |

**Domain / math invariants that constrain the ladder's content:**

- **Two gamma sources, deliberately.** Call wall and put wall are peak/trough **vendor**-gamma strikes; the gamma flip is the zero-crossing of **our analytic** net-GEX curve over a spot ±20% grid. They can legitimately disagree (PROJECT_CONTEXT §3). Sorting five levels by price in one column therefore places two *different measurements* on one axis. This is correct and must not be "fixed" by unifying the sources — but the ladder may not imply they are one computation.
- **Max pain is full-chain and anchored to the nearest monthly OPEX**; the walls and the flip are **DTE-window-scoped**. One ladder mixes a chain-wide figure with window-scoped figures. The expiration-window label already lives in the masthead; the ladder must not restate the window in a way that implies max pain obeys it.
- **The distance anchor is `gex_spot`, not the mid.** `_kit/distanceToLevel.ts:11-14` (`levelSpot`) prefers `gex_spot` and falls back to `price`; `DealerPositioning.tsx:61` uses exactly that. Canon rule 14 says "distance from **mid**". **These are different numbers.** Position: the four structure rows keep the shipped `gex_spot`-else-`price` anchor (changing it silently moves every distance the trader has read for months), and the **mid row's own distance is not a computed zero** — the design source renders it as `—` (`design/src/components/ladder.mjs:32`). Zero would assert the mid equals the structure anchor, which it usually does not.
- **`gex_spot` vs `price`:** levels are anchored to `gex_spot` (last session close when closed, live in RTH); `price`/`current_spot` is the live/delayed display spot. The ladder's mid row is the *tape* clock; the other four are the *structure* clock. Two clocks in one sorted list is the whole design risk of rule 14.

**Promoted build invariants this phase touches** (restated, not summarised away):
`[live-vs-static-isolation]` · `[best-effort-isolated-or-null]` · `[additive-keeps-score-byte-identical]`
· `[ai-asserted-numbers-are-traceable]` · `[absent-is-not-none]` · `[model-read-carries-its-assumptions]`
· `[single-motion-moment]` · `[theme-token-discipline]` · `[single-shared-sim-entry-dialog]` ·
`[no-real-order-path]` · `[dark-pool-context-only]` · `[digested-labels-not-raw-dump]` ·
`[structural-over-prose-enforcement]` · `[cited-code-is-verified-not-assumed]` ·
`[loss-free-durable-migration]` (**declared not engaged** — see non-goal 7).

---

### §1 — `[live-vs-static-isolation]`: how one predicate stays one

This is the phase's named highest risk and the reason phase 1 FAILed GATE Q at 72/8/1 with a fully
green suite. Ledger key `one-liveness-predicate`.

**The situation as it actually is today — four distinct expressions answer "is this live?" across the
four surfaces this phase folds into one panel.** All four read at source this round:

| # | expression | site | drives |
|---|---|---|---|
| 1 | `isDeliveringLive(live, streamOffline)` | `sessionTapeStanding.ts:54-60` | the connection chip (`connectionState.ts:86`) and `LiveTape`'s dot / widget pulse / tick flash (`LiveTape.tsx:81-85`) — **this is the canon predicate** |
| 2 | `genuineIsLive(live, streamOffline)` | `sessionTapeStanding.ts:29-32`, surfaced as `isLive` by `liveTapeStore.ts:69` | the order engine and the positions live badge — **a business predicate, not a claim predicate** |
| 3 | `tape.isLive && !!tape.live` | `GexStrikeProfile.tsx:50` → `chart.tsx:118` → `StructureFieldModel.live` | the structure field's **mid trail, mid beam, bead pulse** (`StructureFieldCanvas.tsx:581, 601, 606`) |
| 4 | `Boolean(tape.isLive && tape.live?.live && !tape.streamOffline)` | `TapePulseStrip.tsx:33` | the strip's `Live`/`Mid` **word** (`:199`) and its bead pulse (`:125`) |

Expressions 3 and 4 are built on #2, which `sessionTapeStanding.ts:42-48` documents in terms as the
**wrong** predicate for a liveness claim: it does not read `market_session`, and `stream.rs` derives
`live` from tick recency and `market_session` from the ET clock independently, so `closed` +
`live: true` is reachable from the real wire. **Phase 1 fixed exactly this class of bug in
`LiveTape`, and left the same bug standing in the two canvas instruments the hero folds in.** The
census test that caught it (`live-dot-census.spec.tsx`) counts DOM nodes with
`data-testid="figure-live-dot"` (`:171`) — it is structurally incapable of seeing a pixel the canvas
paints. That is the shape of the failure that will repeat.

Two further verified liveness defects in the same code:

- **`TapePulseStrip.tsx:73` pushes a trail point on every rAF frame unconditionally**, using
  `displayMid = liveMid ?? structureMid` (`:71`). With the stream dead, the strip keeps drawing a
  **moving polyline of the static structure mid** (`:108-119`, rAF re-armed at `:139`). Canon rule 22
  forbids exactly this: "a moving trail may only run while a genuine stream is delivering."
- **`StructureFieldCanvas.tsx:484` (scan sweep) and `:522` (gamma particles) are gated on
  `!reduce` only** — never on `m.live`. Both are "drifting particles" under rule 22 and both animate
  a snapshot when the tape is dead.

Neither is caught by `single-motion-moment.spec.ts`, which scans for literal `@keyframes` names
(`:54-55`) and asserts set-equality against a three-member allowlist (`:36-43`). **A Canvas2D rAF
loop declares no keyframe and is invisible to the entire spec.**

#### The mechanism: one *claim* predicate, made unrepresentable to violate

I am **not** claiming the app can have literally one liveness function — `genuineIsLive` has a
legitimate non-visual consumer (fill eligibility). The claim is narrower and testable:

> **Exactly one expression may produce a value that a rendered liveness claim consumes.** Every
> liveness-bearing prop in the desk takes that value's *type*, and no boolean expression can inhabit
> it.

Concretely: `isDeliveringLive` is re-typed to return a **branded** boolean (a nominal type — an
intersection with a unique symbol-keyed marker, produced only inside that module). Every prop that
renders a claim is re-typed from `boolean` to that brand:

- `FigureCell.live` (`FigureCell.tsx:169`)
- `Widget.live` (`Widget/Widget.tsx:57`) — the `widgetLivePulse` gate at `:404`
- the structure field model's `live` field (`chart.tsx:118`, consumed at `StructureFieldCanvas.tsx:581,601,606`)
- the ladder row's live flag
- the tape strip's word/pulse gate

A composition helper in the same module narrows "live AND this value is present" while preserving
the brand, because that composition is needed at four call sites today (`LiveTape.tsx:161,173,189`
and the ladder's mid row) and hand-written `&&` chains are precisely how expression #3 was born.

**Why the brand and not the alternatives** — the options, compared:

| option | complexity | cost | scalability | familiarity | catches the canvas? |
|---|---|---|---|---|---|
| **A. Extend the DOM dot census** to the whole desk | low | low — the spec exists (`live-dot-census.spec.tsx`) | poor: every new claim needs a new testid, and the test only counts what it was told about | high (shipped) | **No** — canvas paints no DOM |
| **B. Source scan / importer-set equality on `genuineIsLive` + `tape.isLive`** | medium | medium — precedent is `shared/ui/arc.spec.ts`; must be mutation-guarded per the house rule | good — a new file computing its own predicate fails on day one | high (four shipped scans use this idiom) | **Yes**, by reading source not DOM |
| **C. Branded type on the claim props** | medium-high up front | high — touches ~8 props and every call site in one commit | best: a *new* claim prop cannot be `boolean` without someone deliberately widening it | medium — the repo already ships a branded numeric (`NetLimitDollars`, per DECISION_LEDGER `structural-over-prose-enforcement`) | **Yes**, because the canvas model field is typed |

**Position: C for the props, B for the module boundary.** They fail differently and both failures
happened: C stops the *wrong boolean reaching a prop* (expressions 3 and 4), B stops a *new file
inventing its own* (which is how expression 4 appeared after phase 1's fix). A alone is what phase 1
shipped and it is why this bug survived a green suite.

The proof-can-fail obligation (`a-proof-must-be-able-to-fail`): C is a **compile-time** guard, so it
is proven with `@ts-expect-error` on a raw-boolean call site — TS2578 fires the day the brand is
removed. Never a runtime `expect`. B is proven with a mutation fixture plus an anti-vacuity
assertion, exactly as `hex-discipline.spec.ts:82-89` and `single-motion-moment.spec.ts:81-92` do.

#### The three claims that must also be gated, and the mechanism for the canvas

`single-motion-moment.spec.ts` cannot see rAF. Mechanism: **extract the paint step from the
`useEffect` closure** (`StructureFieldCanvas.tsx:425-782`) into a pure function of
`(model, ctx, now, reduced)` and drive it in a unit test with a recording fake `CanvasRenderingContext2D`.
Assert: with `live` false, zero trail points, zero particle `arc()` calls, zero sweep gradient fills;
with `reduced` true, the same. **Named cost:** this is a real refactor of a 460-line closure that
holds mutable sim state (`particles`, `midTrail`, `spawnAcc`, `structureDirty`) across frames — the
state has to move into an explicit frame-state object. I price that as the largest single mechanical
cost in this phase and I am not pretending it is free. The alternative — a source scan asserting
every draw call sits inside a `model.live` branch — is cheaper and brittle enough that I expect it to
be defeated by the first refactor; I recommend against it.

#### The strip's `Live`/`Mid` word

`TapePulseStrip.tsx:207-211` records that phase 1 **deleted** the `tape-stream-state` node because it
was "a SECOND page-scope liveness authority beside the header connection chip, exactly what canon
rule 18 exists to stop" — and then left `{isLive ? 'Live' : 'Mid'}` at `:199`, computed by expression
#4. When this strip folds into the hero panel, that word sits in the same viewport as the chip.
Position: it is either **deleted** (the chip already says it) or demoted to a **per-figure provenance
mark** driven by the one predicate, exactly as rule 18's chip-scoping clarification permits for the
`FigureCell` dot. It may not stay as a free-standing word computed by its own expression.

---

### §2 — Data structures: content

Field *names* are the synthesizer's; what follows is **content, cardinality, nullability and closure**.

#### 2.1 The level ladder model

**Exactly five rows.** The row identity is a **closed five-member union**, not a string, so a sixth
row is a compile error rather than a layout accident: call wall · mid · max pain · gamma flip · put
wall. Ordering is by price descending, computed — never a fixed array order — because the levels can
cross (a put wall above the mid is a real market state, not a data fault).

Per row:

- **price** — `number | NotANumber`. A null level renders a **member of the nine**, never `$—`.
  `DealerPositioning.tsx:151-157` records this exact defect (`` `$${m.max_pain ?? '—'}` ``) and its
  fix; the ladder inherits the guard, it does not re-earn it.
- **distance from the anchor** — `string | NotANumber`. `distanceToLevel` returns `null` when either
  input is missing (`distanceToLevel.ts:24-25`) and today the caller simply omits a caption
  (`DealerPositioning.tsx:111`). **A ladder column cannot omit a cell** — an empty cell in a column is
  indistinguishable from a render bug, which is the failure `[absent-is-not-none]` names. Null must
  become a vocabulary member. Which member is a copy call, not mine; my constraint is that it must be
  one of the nine and must not be pressed into a meaning it does not carry (ruling 3 explicitly
  accepted that nothing structurally stops a ticker surface rendering `no basis`, and that a
  meaningless use is a defect to fix per-surface).
- **the mid row's distance is `—`, not `0.00%`.** See §0: the anchor is `gex_spot`, the mid is the
  tape, and a computed zero would assert they are the same number.
- **liveness** — the branded claim from §1. **True on the mid row only, and only when the one
  predicate says so.** The other four are REST structure and carry `false` structurally, not by data
  accident: they should not even receive the tape store as an input (see §4).
- **stroke identity** — a **token key**, not a colour value (see 2.4).

**Which shipped cells become which rows — the full accounting.** `DealerPositioning` renders exactly
12 cells (`DealerPositioning.tsx:106-229`, count asserted at `live-dot-census.spec.tsx:191`). They
decompose with **zero orphans**:

| destination | cells | count |
|---|---|---|
| ladder rows | Call wall, Put wall, Max pain | 3 |
| ladder foot | Vol-norm GEX, Raw GEX (1% shock) | 2 |
| read strip | Opportunity, Net DEX, IV/HV, Vol/OI, IV skew, Term structure, Off-exchange % | 7 |

3 + 2 + 7 = 12. The read strip's eighth cell (IV rank) comes from `IvRank.tsx`, a separate widget.
The design source agrees on the foot pair (`design/src/screens/desk.mjs:324-325`). **Nothing is
dropped and nothing is invented** — that is the property that makes deleting `DealerPositioning`
reviewable rather than a rewrite.

Two things also live in `DealerPositioning` and must not be lost: the **Field/Magnet view toggle**
(`:70-88`) and `WallMagnetView` (`:92-97`). The design source moves the toggle onto the hero
(`design/src/screens/desk.mjs:296,301`). It goes with the field, not into the bin.

#### 2.2 The gamma-flip collision

The ladder's flip row is the **structure** flip (`m.gamma_flip`, REST, dotless). The live-recompute
flip stays a tape figure — the design source keeps "Gamma flip · live" inside the Live tape panel
(`design/src/screens/desk.mjs:358`), and `LiveTape.tsx:185-195` already renders it with a fallback to
`m.gamma_flip` and a `retained` offline arm. **So the desk will show two numbers both called "gamma
flip", in one viewport, and only one of them is live.** They differ by construction (the live one is
repriced against the live mid).

Rule: the live cell must name the structure flip it differs from — the shipped design sub-copy does
exactly this (`desk.mjs:358`: "live recompute · levels flip 568.50"). The ladder row must never
adopt the live value, because canon 14 makes the mid the only live row and because a level that
moves under the trader's eye is not a level.

#### 2.3 The read strip model

**Exactly eight cells**, all `FigureCell`, so canon rules 13 and 24 apply unchanged (rule 15 says so
in terms). Every one of the eight is a **REST/bundle read** — none is live-derived today, which is
why the strip's honest liveness state is "eight dotless cells" and any dot appearing in it is a
defect, not a feature. `[dark-pool-context-only]` binds the off-exchange cell: capped, no side, and
it must not render success green (`DealerPositioning.tsx:206-219` is already correct here).
`[digested-labels-not-raw-dump]` binds term structure, IV rank and skew: the wire's closed label is
authoritative, the FE renders it through a closed lookup and **never re-derives it from the scalar**
(`DealerPositioning.tsx:189-205` already does this for term structure).

#### 2.4 The stroke table — the mechanism behind "ladder and field read as one object"

Canon 14 binds each ladder row's tick to "the same stroke as its line in the structure field."
Today the field's level strokes are **module-level hex literals** in the paint path:
`StructureFieldCanvas.tsx:20-27` declares `RED`/`GREEN`/`AMBER`/`STEEL`, spent at `:348-350` (put
wall, call wall, spot) and `:358` (flip). `hex-discipline.spec.ts:48-49` exempts the file with the
justification *"Canvas2D dual-clock Structure Field — brand token literals (cannot use MUI sx)"*.

Options for making the two surfaces share one stroke definition:

| option | mechanism | cost | verdict |
|---|---|---|---|
| **(i)** One stroke table keyed by ladder-row identity, exporting **token keys**; the React host resolves keys → concrete colours via `useTheme()`/`extrasFor(theme)` and passes a resolved palette into the canvas as a prop | the ladder ticks and the canvas `level()` calls read the same table; drift is impossible because there is one table | high — deletes the hardcoded literals, which **invalidates the `hex-discipline.spec.ts:48` exemption**, and `hex-discipline.spec.ts:110-120` (the live-exemption test) will **fail** if the entry stays while the hex goes. A coordinated edit, not an optional one | **recommended** |
| **(ii)** Keep the canvas literals and write a second stroke table for the ladder | trivial | two tables; "one object" becomes a coincidence that drifts on the first token change | rejected |

Option (i) also closes a defect I verified while reading: **`StructureFieldCanvas.tsx` takes no theme
input at all** — its only hook import is `useReducedMotion` (`:11`) — and it fills its background with
the dark `INK` literal unconditionally (`:223`, `:434`). There is no `palette.mode` branch anywhere in
the 887-line file. In light mode the hero instrument is therefore a dark rectangle inside a light
panel. Passing a resolved palette in is the same edit that fixes it. Whether light-mode parity for
the hero is **in scope or named carried debt** is a product call I flag rather than decide — but
silence is not available, because this phase promotes that canvas from one widget among thirteen to
*the* hero.

#### 2.5 The AI read: nine layouts over a shipped 15 × 6 state space

**This is the single largest structural claim in my position, and it is the ruling-3 failure about to
repeat.**

Read at source: `ai-rec/presentationPolicy.ts:4-19` declares **fifteen** request states and `:20-26`
declares **six** result states, and `deriveAiRecPresentation` (`:106-181`) produces a
`(requestState, resultState)` pair, not a single enum.

Canon rule 16 names **nine** states. They do not line up:

| canon 16 state | shipped members it covers |
|---|---|
| idle | `idle` |
| loading | `loading` |
| produced (trade) | `fresh_trade` |
| produced (no trade) | `no_trade` |
| stale | `stale_newer_snapshot`, `stale_at_generation` — **two** |
| cooldown / daily cap | `cooldown`, `daily_cap` — **two** |
| signed out | `signed_out` |
| add a key | `missing_key`, `key_unusable`, `key_rejected`, `model_not_in_catalog`, `model_unset`, `oauth_expired`, `oauth_unlinked`, `subscription_unavailable` — **eight** |
| full-analysis drawer | **not a state at all** — it is `actions.analysis` (`:178`) plus a separate surface |
| *(no canon home)* | `no_edge`, `unavailable`, `superseded_inputs`, `incomplete_trade` — **four** |

The design source itself already knows this and states the rule:
`design/src/screens/ai-read.mjs:122` — *"Eight distinct powering reasons (missing key, unusable,
rejected, model unset…) share this frame and swap only the sentence and the CTA label — reasons never
collapse."*

**Position:** do **not** introduce a nine-member state enum. A nine-member union would be worse than
useless in precisely the way the architect's six-member `NotANumber` union was at phase 1 (ruling 3):
the eight powering reasons would not become type errors, they would become a lossy `string` and the
distinctions would evaporate at the boundary. Instead:

1. `AiRecRequestState` and `AiRecResultState` remain the **authoritative closed unions**. They already
   are. Nothing widens or narrows them this phase.
2. One **total** mapping function `(requestState, resultState) → ReadLayout`, where `ReadLayout` is
   the nine-member presentational union, exhaustively switched with a `never` default arm so a
   sixteenth request state is a **compile error** at the mapping, not a silent fall-through to `idle`.
3. The acceptance criterion is **not** "the enum has nine members" — that is the count-based AC that
   ruling 3 declared unsatisfiable. It is two things, both observable:
   (a) each of the nine layouts is reachable from ≥1 producible `(request, result)` pair; and
   (b) **no two shipped members that the specs already assert as non-synonymous render byte-identical
   body content.** (b) is the anti-collapse assertion with teeth, and it is the same idiom
   `BrokerGroupHeader.spec.tsx:193-194` supplied to ruling 3 — assert the literals that must *not*
   appear.
4. **The four homeless states need an explicit disposition, not a fold.** `no_edge` (the quiet-gate
   hint — the design source puts it inside the idle panel as a footnote with "Ask anyway",
   `ai-read.mjs:62`, and `presentationPolicy.ts:168` already has an `askAnyway` action), `unavailable`,
   `superseded_inputs` and `incomplete_trade`. Silently folding any of them into a neighbouring layout
   is exactly the failure ruling 3 exists to prevent. I flag this as a **product call for the owner**
   — I can state the constraint, not the answer.

`[ai-asserted-numbers-are-traceable]` binds the four risk fields: each declares traced-vs-model's-own
in the **type register** (Mono / Sans + dotted rule), never in colour. `FigureCell.tsx:287-292`
already implements the untraced arm (F9) and its module doc at `:17-18` records that **no phase-1 call
site reaches it** — this phase is the first consumer of F9. The itemized grounding counts, the cited
contract, the analyst prose and the as-sent inputs live in the **drawer**; the panel carries a
one-line summary and the folded Why. The panel never grows to hold them.

#### 2.6 The retention latch (owed item 1) — and why `useFlashOnChange` must NOT be "fixed"

`useFlashOnChange.ts:44` writes `prev.current = value` **before** the null guard at `:46`, so a drop
destroys the last non-null value. Nothing holds it today.

**Mechanism:** a small hook holding a ref, updating only on a non-null value, keyed by a reset token:

- reset token = route symbol **and** replay-armed state (`sessionTapeOf(live) != null`). One token
  gives both required clears — ruling 2 requires "cleared on symbol change **and** on replay arm".
- The latch sits **beside** `useFlashOnChange`, never in front of it: the flash hook keeps receiving
  the **raw** stream value (which goes null on drop → `:46` returns → no flash), while the **rendered**
  value comes from the latch.

**Therefore: do not reorder `useFlashOnChange.ts:44`.** Moving the write after the guard would make
`prev.current` survive a drop, and the first payload after a reconnect would flash against a
pre-drop value — a fabricated tick, on a figure whose whole purpose is honesty. The RESUME's owed
item is satisfied by *not routing the latch through the flash hook*, which is a different fix from
the one the line number invites. This is the claim in my position I most expect to be attacked, and I
state it as an attackable mechanism rather than a caveat.

The "a latched value is not re-flashed" test ruling 2 owes then has a precise shape: drive a drop
with a retained value present, assert the rendered value is the retained one **and** that no flash
state is produced.

Third arm: after a symbol change the latch is empty, so between navigation and first payload every
live cell is F5 — the bare vocabulary member with the pause mark and **no "last known" words**. That
composes correctly with ruling 1: `resetLiveTape()` (`liveTapeStore.ts:105-108`) sets `live: null`,
and `connectionState.ts:99` returns `null` for a null `live`, so the chip is simultaneously back on
its wordless placeholder. Chip and figures agree by construction, not by coincidence.

---

### §3 — Data flow: four clocks, never merged

| clock | source | feeds | degrade rule |
|---|---|---|---|
| **structure** (~60s REST poll) | bundle | 4 of 5 ladder rows, ladder foot, the field's curve/walls/flip, all 8 read-strip cells, the whole quiet band | never dims; a post-success poll failure keeps everything behind the soft warning (`TickerDashboard.tsx:427-432`) |
| **tape** (SSE → `liveTapeStore`) | `useLiveTape()` | the ladder's mid row, `LiveTape`'s three live cells, the field's mid beam + trail, the tape trail row | dims + pause mark + retained value; **never blanked** |
| **slow lane** (structure history) | `page.history` | the structure path sparkline | neither live nor bundle-fresh — carries its own sample count and basis (`StructurePathStrip.tsx:240-242, 246-254` already do). **Never wears a live mark.** |
| **read** (AI, pinned to a snapshot) | `useAiRecommendation` | the AI read brief | never self-refreshes |

**The isolation rule that is easy to get wrong:** the AI read's staleness is measured against the
**structure** clock, not the tape clock — `presentationPolicy.ts:130` branches on `input.stale`, which
is a newer-REST-snapshot fact. **An SSE drop must not make the read stale.** A read pinned at 10:41
is exactly as valid at 10:42 with a dead tape as it was with a live one; asserting otherwise would be
the app inventing a staleness it cannot observe.

**Single store read.** `useLiveTape()` is currently called in at least four places on this page —
`TickerDashboard.tsx:195`, `LiveTape.tsx:59`, `GexStrikeProfile.tsx:47`, `TapePulseStrip.tsx:25` —
and expressions #3 and #4 in §1 were both born inside a component that read the store for itself.
**Rule for the hero: exactly one component in the panel calls `useLiveTape()`, and it passes the
branded claim plus the mid down as props.** That is the structural reason the four regions are
presentational children (§4), not the aesthetic one.

---

### §4 — Component boundaries

#### 4.1 The hero: one panel, four presentational children

The brief asks the council to rule: one container-query panel with four regions, or a panel wrapping
four sub-components?

**Position: one `Widget`, four pure-props children** (`StructureFieldCanvas` · `LevelLadder` ·
tape-trail row · `StructurePathStrip`), with the store read and the claim derivation at the panel
host.

The decision does **not** turn on "read as one object" — that constraint is satisfied by the shared
stroke table (§2.4) under either shape. It turns on three mechanisms:

1. **Container naming.** `Widget/Widget.tsx:163` declares `{ containerType: 'inline-size',
   containerName: 'panel' }` on the body, and `PanelContainer.tsx:15-18` is the only other sanctioned
   way to declare that name. Four peer panels would produce four independent `panel` contexts inside
   one visual frame, so the ladder-foot figures would step at a different threshold from the field's
   own internals. One panel gives one threshold for one instrument.
2. **`Widget` is not a passive frame.** It mounts an expand `Dialog` that re-renders the body
   (`Widget/Widget.tsx:440-481`), a selection ring, an outside-click listener (`:495-517`) and the
   `widgetLivePulse` edge (`:404-425`). Four peers means four expand buttons and four selection rings
   inside one instrument.
3. **One store read** (§3).

**Named cost of one panel:** a single `ErrorBoundary` around the whole hero means a canvas fault
blanks the ladder too. `TickerDashboard.tsx:537,552` currently gives each widget its own boundary, so
today a GEX-chart throw leaves the walls readable. See §5 for the fix; I am naming the cost, not
waving at it.

#### 4.2 The read strip and the container-query hazard

**The strip is a rail. Its cells — not the strip — must be the container-query context.**

Mechanism: `FigureCell.tsx:216-217` queries `theme.containerQueries('panel').down(360)` and
`.down(280)`. CSS resolves `@container panel` against the **nearest ancestor bearing that name**. If
the strip is one `Widget`, the nearest named ancestor of every cell is the panel body — ~1280px wide
at desktop — so eight ~140px cells would all render their figures at the 20px base and never step.
That is the container-step rule failing in the direction nobody looks.

Options: (a) wrap each strip cell in `PanelContainer` (same name, nested — the nearest-ancestor rule
does the work, zero new axes, uses the shipped primitive); (b) introduce a second container name for
figures. **Position: (a).** (b) adds an axis the canon does not declare and would force an edit to
`FigureCell`'s query and to `type-floor.spec.tsx`'s AC-20a assertion.

`[lane-check]` — **jsdom does not evaluate container queries** (phase 1 RESUME, and AC-20b was
honestly recorded UNVERIFIABLE for that reason). A jsdom test can assert the *declaration* only. The
*behaviour* — that a 140px strip cell actually renders at 15px — is provable only in the Playwright
layer, at a real width. I am asserting the mechanism; I am **not** asserting it is currently
verifiable in the unit suite, and any AC that claims a jsdom proof of stepping is false by
construction.

#### 4.3 The AI read: one component, one CSS axis, one extra node

The brief asks: same component in a sheet, or a second narrow rendering?

**Position: the same component. The sheet is a container, not a variant.** Nine layouts × two form
factors is eighteen renderings only if the layout branches on viewport — and it does not have to.
The design source puts the entire wide/narrow difference in CSS: the two-column body at
`design/src/screens/desk.mjs:36` becomes one column at `:73`, and the same `.ai` section becomes a
fixed bottom sheet at `:70`. Nothing swaps its tree.

**Exactly one genuinely new subtree: the peek row** (`desk.mjs:217-220`), which exists only under
768px and carries the verdict word. Constraint: the peek row and the panel's verdict must be **the
same value from the same model field**, and exactly one of the two may be mounted at any width — if
the peek row derives its own verdict, we get two amber words in one viewport, which is precisely what
ruling 8 refused ("a second amber word on the same page dilutes precisely what makes the first one
carry meaning"). Observable: exactly one verdict-marked node at 393px and exactly one at 1280px.

**Named hazard:** MUI `Drawer`/`Dialog` portals its content to `document.body`, which severs the
container ancestry. A sheet whose root does not re-declare `PanelContainer` will silently fall back
to the 20px base for every figure inside it — the same failure as 4.2, arriving by a different route.

#### 4.4 Dependency direction

`pages`/`features` → `shared`, downward only; pages never import sibling pages. The ladder, the read
strip and the hero are single-page consumers and stay under `pages/ticker/`. `shared/` is populated
on the **2nd** consumer, never preemptively — which is why `notANumber.ts` correctly sits in
`shared/copy/` (three consumers, documented at `notANumber.ts:18-23`) while `FigureCell` correctly
does not.

---

### §5 — Isolation and error rules

1. **The ladder survives a canvas fault.** An inner `ErrorBoundary` wraps the canvas region only, so
   a field throw degrades to a static message while the ladder, the tape row and the path keep
   rendering. Rationale: the ladder is REST-only and shares no failure mode with a WebGL/Canvas paint
   path; the five levels are the phase's most load-bearing readout. Cost: two boundaries in one panel.
2. **Each of the five ladder rows is independently nullable** (`[best-effort-isolated-or-null]`). A
   null level renders a vocabulary member — never `$—`, never `0`, and **never a dropped row**.
   Dropping a row changes the row count and silently breaks "sorted by price" as a reading.
3. **Each of the eight read-strip cells is independently nullable.** The strip renders eight cells at
   every state; an unavailable metric is an `unavailable` cell, not a missing one.
4. **The quiet band never wears a live mark and never feeds the score.** Enforceable cheaply as a
   region-scoped extension of the existing census: zero `figure-live-dot` and zero
   `data-figure-state="live"` inside the band, at every connection kind and every replay standing.
5. **Cold start is the only blank screen** (`TickerDashboard.tsx:415-426`), unchanged. A post-success
   poll failure keeps the whole desk behind the soft warning (`:427-432`), unchanged.
6. **A stream drop never blanks and never zeroes.** Retained value at reduced opacity with the pause
   mark where a retained value exists; the bare literal with the pause mark and **no "last known"
   words** where none does (ruling 2, both arms, `FigureCell.tsx:255-276`).
7. **AI-read failure is isolated.** The brief failing, cooling down, or having no key changes nothing
   about the structure, the tape, the strip or the band.

---

### §6 — Enforcement: what red-builds when poisoned

`[structural-over-prose-enforcement]` requires each rule this phase lands to ship as a guard that goes
red when poisoned, **and** the poison test must itself be proven non-vacuous. Phase 1 shipped two
`expect(true).toBe(true)` bodies under a "MUTATION PROOF" heading (ruling 8), so this is not
theoretical.

| rule | mechanism | poison → red |
|---|---|---|
| one claim predicate | branded type on every claim prop | pass a raw `boolean`; proven with `@ts-expect-error` (TS2578 fires if the brand is removed) — **never** a runtime `expect` |
| no second predicate is invented | source scan: `genuineIsLive` / store `isLive` appear in zero presentational desk files; mutation-guarded, anti-vacuity assertion | add a file computing `tape.isLive && …` → red |
| canvas motion is live-gated | extracted pure paint step + recording fake 2D context | set `live: false` and expect zero trail/particle/sweep calls |
| dot census, page-wide + region-scoped | extend `live-dot-census.spec.tsx` to the hero, the strip and the band | any dot outside the mid row at a non-live kind → red |
| ladder row count and closure | closed five-member union + exhaustive switch with a `never` arm | a sixth row → compile error |
| AI-read layout mapping is total | `never` default arm on the `(request, result) → layout` map | a 16th request state → compile error |
| AI-read states do not collapse | assert the literals that must *not* appear across paired states (`BrokerGroupHeader.spec.tsx:193-194` idiom) | make two non-synonymous states render identical bodies → red |
| the design mirror actually covers v2 | extend `design/src/verify-tokens.mjs` (`:38` prints the seven v2 additions without structurally checking them) to set-equality on the `additions` block plus per-value equality against `tokens.ts` | change `steel2` on one side only → non-zero exit |
| no fourth arc, no new keyframe | shipped `arc.spec.ts`, `single-motion-moment.spec.ts` (d) | unchanged, but **verify at build** that no hero/strip/brief work adds an importer or a keyframe |

**Two execution traps that make a green suite lie, both from the phase-1 RESUME and both live here:**

- **`apps/dashboard-e2e/playwright.config.ts` is an explicit `testMatch` allowlist.** A new spec file
  not registered in it **never runs and reports green.** Prove execution with `--list`, not with a
  passing summary.
- **e2e runs against the production build**, never the dev server (`broker-grouping.spec.ts` fails
  ~74/75 on Vite dev with a navigation race). `npm run ports:free` first, always, both address
  families.

**One seam I found that will bite quietly:** `no-overflow.spec.ts:398` uses
`page.getByText('Call wall').first()` as the readiness anchor for `/ticker/TSLA` on **every** route
walk — 393 dark, 393 light, 834, 900, 1280. This phase deletes the component that renders that text.
The ladder keeps the exact label word (decisions §2 withdrew the replacement-mark requirement
precisely because "the side is in the label words"), so the anchor survives — **but it must survive
deliberately, not by luck.** If UX renames that row, ~12 e2e cases go red for a reason nobody will
connect to a copy change.

**Also verified, correcting the brief:** `no-overflow.spec.ts:51` already includes `{ label: 'tablet
834' }` in `WIDE_VIEWPORTS`. The 834 width the brief and the canon assign to phase 4 **shipped in
phase 1**. The obligation here is only to keep 393 (both schemes), 834, 900 and 1280 green with a
rail that scrolls sideways rather than widening the page.

---

### §7 — Explicit non-goals

1. **No backend change.** The `apps/api` diff is **zero lines**; `opportunity_score`,
   `opportunity_tier` and `state_fingerprint` stay byte-identical
   (`[additive-keeps-score-byte-identical]`). No new wire field, no new endpoint, no new SSE event.
   Nothing on this desk is a scoring input.
2. **No rebuild of the eight context widgets' internals.** They already consume `FigureCell`;
   re-housing them into the quiet band is **placement and chrome only**. Their internal rebuild is
   named debt with phase 3 attached.
3. **No composition change to scanner, positions, settings or alerts** — phase 3.
4. **No landing, no site pages, no new breakpoint band** — phase 4. (And 834 is already in the suite;
   see §6.)
5. **No fourth arc spend and no new orchestrated motion moment.** Zero new `@keyframes` names. The
   hero curve-draw remains the one moment; every desk animation qualifies only as a **data signal**
   under the class predicate — genuinely live stream, stops on drop, fully disabled under
   `prefers-reduced-motion`.
6. **No real order path.** The masthead's one primary action and the brief's "Review simulated trade"
   both route into the **one shared** `TradeEntryDialog`. `TickerDashboard.tsx:682` and `:722` already
   mount two instances of it (the entry path and the additive order variant) — a third *instance* is
   fine; a second *component* is a GATE-Z reversal.
7. **No new durable client key.** `[loss-free-durable-migration]` is **declared not engaged**. If a
   hero view-mode (Field/Magnet) preference were persisted, it would engage, so that preference stays
   ephemeral component state this phase — exactly as `DealerPositioning.tsx:59` holds it today.
8. **No reordering of `useFlashOnChange.ts:44`** — see §2.6. The latch composes beside it, never
   through it.
9. **No burn-down of the spacing exemption list beyond the files this phase rewrites** (ruling 4).
   The radius sweep is already done and is not re-opened.
10. **No tenth not-a-number member** (rule 24 — a tenth is an Amendments event).
11. **No unification of the two gamma sources** and no change to any level's computation. The ladder
    is a re-presentation of shipped numbers, not a recomputation.
12. **No second connection chip and no second page-scope liveness word.** Rule 18 is chip-scoped; the
    per-figure dot is a provenance mark, not a page claim.

**Carried, not solved, this phase:** the itemized 44px debt (`BUILD_REPORT.md` §4), the spacing
exemption remainder, and the undeclared `tooltip` z-rung. On the last one: MUI's `Tooltip` defaults to
1500, above every declared v2 rung (nav 20 · scrim 29 · sheet 30 · popover 35 · dialog 40 · toast 50).
This phase puts `AccessibleHelp` tooltips inside a bottom sheet at rung 30 and inside the expand dialog
at 40 — 1500 renders *above* both, which is the behaviour we want, so the undeclared rung is **benign
here**. It still wants declaring; it is not this phase's blocker.

---

## Risks I see

1. **The one-predicate fix is bigger than the ledger key suggests, and the biggest part is a canvas
   refactor.** Expressions #3 and #4 (§1) live in two Canvas2D components whose motion no shipped
   spec can observe. Re-pointing them at `isDeliveringLive` is a two-line change; *proving* it stays
   re-pointed requires extracting a 460-line rAF closure with cross-frame mutable state. If that
   extraction is dropped for budget, we ship the same class of bug phase 1 FAILed on, with the same
   green suite. **This is the risk I would spend the phase's contingency on.**
2. **The AI read's state space is 15 × 6 and the canon says nine.** If the PM writes a count-based AC,
   it is unsatisfiable without deleting shipped distinctions — the exact shape of ruling 3. Four
   shipped states (`no_edge`, `unavailable`, `superseded_inputs`, `incomplete_trade`) have no canon
   home and will be folded silently unless someone rules on them.
3. **The read strip's container context is the failure that passes every jsdom test.** Cells that never
   step look fine at desktop and merely look wrong at 393. jsdom cannot see it (RESUME gotcha); only a
   real-browser width can. An AC that claims a unit-test proof of stepping is false.
4. **Two numbers called "gamma flip" in one viewport** (§2.2). If the live cell drops the sub-copy that
   names the structure flip beside it, the desk shows a trader two different levels under one name.
5. **The hero canvas has no theme input and paints a dark background unconditionally**
   (`StructureFieldCanvas.tsx:11, 20-27, 223, 434`). Promoting it to *the* hero makes light-mode parity
   a visible product question this phase either answers or names as debt.
6. **Folding three widgets into one panel collapses three error boundaries into one.** Without the
   inner boundary in §5.1, a canvas fault takes the ladder with it.
7. **The bottom sheet portals out of the container ancestry.** A sheet root without `PanelContainer`
   silently loses every container step.
8. **`DealerPositioning`'s 12 cells decompose exactly** (§2.1), which is the property that makes its
   deletion reviewable. If any lane adds or drops a cell during layout work, that accounting stops
   being checkable and the review becomes "does it look right".
9. **The e2e route anchor is a copy string** (§6). A rename in the ladder breaks route coverage across
   five viewports for a reason that reads as unrelated.
10. **Stale module docs are actively misleading here.** `LiveTape.tsx:2` still says "the 5
    LIVE-DERIVED StatTiles"; the JSX renders **four** (`:157-205`, count pinned at
    `live-dot-census.spec.tsx:190`). Phase 1's council already caught this exact drift and conceded on
    it. Count from the JSX, never from the doc comment — including in this document.

---

## Assumptions I'm making about the other two lanes

- **PM will state the AI-read criterion as reachability-plus-non-collapse, not as a member count.**
  Falsifiable: if the PM writes "the state enum has exactly nine members", it is unsatisfiable against
  `presentationPolicy.ts:4-26` without deleting shipped states, and I will raise it at R2 as the
  ruling-3 failure repeating.
- **PM will route the four homeless shipped states (`no_edge`, `unavailable`, `superseded_inputs`,
  `incomplete_trade`) to the owner as an explicit disposition** rather than folding them into a
  neighbouring layout or leaving them unmentioned.
- **PM will not write an AC that simultaneously requires "exactly one connection chip in the viewport"
  and preserves the tape strip's `Live`/`Mid` word** (`TapePulseStrip.tsx:199`). If both appear, one of
  them is a second page-scope liveness claim and the ACs contradict.
- **PM will price the retention latch as two observables, not one:** the retained value renders with
  the pause mark and the conditional clause, **and** it does not flash on reconnect. One observable
  passes with a latch that re-flashes.
- **PM will treat light-mode parity for the hero canvas as either in-scope or explicitly named carried
  debt** — not omit it. Falsifiable: `StructureFieldCanvas.tsx` imports no theme and fills `INK` at
  `:223`, so silence ships a dark rectangle on a light desk.
- **UX will specify the read strip so that each CELL is the container-query context, not the strip.**
  Falsifiable: if the UX contract declares the strip as one panel with eight children, the figures
  cannot step and rule 13's container ladder is dead on the strip.
- **UX will keep the exact label words "Call wall" and "Put wall" on the ladder rows** (decisions §2
  withdrew the replacement-mark requirement because "the side is in the label words"). Falsifiable:
  a rename also breaks `no-overflow.spec.ts:398` across five viewports.
- **UX will assign each ladder row a stroke IDENTITY (a key), not a colour**, and will accept one
  shared stroke table between the ladder tick and the field's level line. Falsifiable: if the UX
  contract specifies per-surface colours, "read as one object" becomes a coincidence and drifts on the
  first token change.
- **UX will not place a live mark anywhere in the quiet band or on the structure path strip**, and will
  keep the path strip's existing self-describing basis + sample count
  (`StructurePathStrip.tsx:240-242, 246-254`).
- **UX's bottom sheet will re-declare the named panel container at the sheet root**, because the sheet
  portals to `document.body` and severs the ancestry.
- **UX will treat the verdict word as one value rendered in exactly one mounted place at any width**
  (panel verdict or peek row, never both) — otherwise two amber words share a viewport, which ruling 8
  refused.
- **Neither lane will require a new wire field, a new endpoint, or a new SSE event.** Feasibility says
  FE-only and the `apps/api` diff must be empty; anything requiring backend data is out of phase by
  construction, not by preference.
- **Neither lane will require persisting a new client-side preference.** A new `convexa.*` key engages
  `[loss-free-durable-migration]`, which is a severity-promoted invariant and a materially different
  build.
- **Both lanes treat owner rulings 1, 2, 3, 5, 6 and 8 as settled** and design inside them rather than
  re-opening any of them.
