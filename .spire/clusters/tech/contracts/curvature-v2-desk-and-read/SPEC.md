# curvature-v2-desk-and-read — spec

**Source brief:** .spire/clusters/tech/contracts/curvature-v2-desk-and-read/BRIEF.md
**Council:** R1 positions · R2 critiques · R3 resolutions · decisions.md   (under council/)
**Status:** **approved by the owner 2026-09-05** (spec locked; build authorized). Criterion 16 was split into 16a/16b at GATE Z the same day — see §9.

> **Delegated calls — there are seven, not five.** **Seven** calls in this spec were taken **by the
> conductor under a written delegation from the owner**, who was asleep: the five product rulings
> **P1–P5** (`council/decisions.md` §3), plus **D-14**, taken at synthesis when the council record
> left a gap it had not closed (the level-absence literal, §4.3), plus **D-15**, taken after the
> skeptic's pass-2 review caught it being narrated as an open question rather than disclosed as a
> decision (`cooldown`/`daily_cap` over a pinned read, §9 item 6). All seven are marked **DELEGATED** —
> not RULED — everywhere they are cited, including on the acceptance-criteria rows they produce, and
> each is restated with its reversal in
> `state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md` (D-14 under §*"Decided at R4"*). Any
> of them the owner reverses is a spec edit, not a rebuild. Phase-1 owner rulings 1, 2, 3, 5, 6 and 8
> are **owner** rulings and bind unchanged.

## 1. Goal + scope

Re-cut the ticker desk from a bento of thirteen equal widgets into the one instrument the v2 canon
describes, read top to bottom: **masthead** → **structure-field hero** (field, level ladder, tape
trail, structure path in one framed panel) → **read strip** of figure cells → the **verdict-first AI
read brief** laid out wide beside tape/position/orders → a **quiet context band** that carries its own
basis and as-of and never feeds the score. It is for the swing trader who must find the flip, the
walls and the AI verdict without scanning thirteen cards — and who must never mistake a snapshot for
live. Frontend-only: the `apps/api` diff is **empty** and `opportunity_score` / `opportunity_tier` /
`state_fingerprint` stay byte-identical.

**In scope:**

- **Level ladder** (canon 14) — five levels sorted by price, distance from the ladder's declared
  anchor, the mid the only live row — replacing `DealerPositioning`'s twelve-tile grid.
- **Read strip** (canon 15) — one horizontal rail of **eight fixed** figure-cell slots.
- **AI read brief** (canon 16) — verdict first, four risk fields with grounding before prose, the
  named render cases of §4, the bottom sheet with a verdict peek row under 768px.
- **Structure-field hero** — one `Widget`, four presentational regions.
- **The `LiveTape` last-non-null retention latch** — owner ruling 2's explicit debt to this phase,
  including its clears on symbol change and on replay arm.
- **Masthead** — symbol, mid, expirations, persona, one primary action.
- **Quiet context band** — the eight remaining context widgets re-housed as **placement + chrome
  only**.
- **Light-mode parity for the hero canvas** — **DELEGATED (P5, In)**. `StructureFieldCanvas.tsx:18`
  declares `const INK = '#0B0F17'` and fills with it unconditionally at `:223`, `:237` and `:434`;
  its only hook import is `useReducedMotion` (`:11`), so it has no theme input at all. The defect
  exists today as one widget among thirteen; **this phase creates the exposure** by promoting it to
  the desk's primary instrument, nothing in the suite can see it (the wide overflow bands run one
  scheme by documented decision), and the fix is a theme input on the same edit as the shared stroke
  table — not a new surface.
  <!-- spire:council-resolution:v1 a79ca8bc02f3a9246704aeb007ad13a1a5cff4494b4cb6af55d7a0439e3bdc72 folded -->
- **Four canon amendments** (documentation; only the rule-16 pair carries acceptance criteria):
  rule **11** (the "vertical diverging" lock names a chart already replaced — and its second clause,
  *"do not collapse mid + last-trade into a single price without an amendment"*, is kept
  **verbatim**), rule **14** (**DELEGATED, P3**), rule **16** (**DELEGATED, P2 + P4**), and rule
  **17** (tense only). The `tooltip` z-rung is **not** amended here (see §9).
- Extending `design/src/verify-tokens.mjs` to structurally check the seven v2 additions (`:38` prints
  them without checking them).
- Burning down the spacing exemptions **only in the files this phase rewrites** (owner ruling 4's
  fence).

**Out of scope:**

- Scanner, positions, settings and alerts **composition** — phase 3.
- Landing, site pages and the responsive sweep — phase 4.
- The eight context widgets' **internal** rebuild — phase 3, ticker arm.
- Any backend change, any new wire field, any new SSE event, any new durable client key
  (`[loss-free-durable-migration]` **declared not engaged**).
- Any tenth not-a-number member (a tenth is an Amendments event, owner ruling 3).
- Any real order path. Every action on this desk is simulated and routes through the **one shared**
  `TradeEntryDialog`.
- **A new alerting entry point.** pm withdrew the claim that alerts is unshipped —
  `AlertsPage.tsx:24-49` composes a `level_touch` rule with a price threshold and persists it to the
  existing `convexa.alerts.v1` key — so this was a scope call, not a feasibility one. ux took the
  conservative option in-lane and pm agreed: the *no trade* state's primary control is the shipped
  refresh / re-ask control, the level is carried as a **condition** in the `Re-engage when …` line,
  and wiring the desk into `useAlerts().addRule` waits for phase 3 with the rest of the alerts work.
  <!-- spire:council-resolution:v1 1cdbe12fb5f5282288d1682a22624af6becf43f282fd963a30d78d3c21d62225 folded -->
- **834 is not scope-out and not future-dated.** Both R2 lanes corrected this and the BRIEF: 834
  **shipped in phase 1** — `no-overflow.spec.ts:51` declares `{ label: 'tablet 834', width: 834,
  height: 1112 }` inside `WIDE_VIEWPORTS`, recorded at `:48-50` as the v2 addition made against canon
  rule 17, and `DESIGN_SYSTEM.md:172` already reads *"834 is added at build"*. The obligation here is
  smaller than a scope item: **keep 834 green through the desk rebuild.** Future-dating shipped work
  would have given a build lane a written permission slip to call an 834 failure "phase 4's job".
  <!-- spire:council-resolution:v1 d43b5ffdabe7099fd4937f4aeeaaf35a111acba3a4770a3494a7b0770907dca4 folded -->
  <!-- spire:council-resolution:v1 3a3afe31fdc8257cc903db81fc55d46b48a2930aa77c06db00ec76774cfb9592 folded -->

**Future (deliberately deferred), each booked in `BUILD_REPORT.md` with `file:line` and a phase:**

- **A point-by-point text equivalent of the field's net-GEX curve — phase 4** (**DELEGATED, P1**
  part 3). A per-strike textual rendering of a continuous curve over a spot ±20% grid is a new
  surface with its own copy, container steps and 44px questions; it is named debt, not silently
  passed and not silently blocking.
- **The wire-level attempted-versus-failed discriminator** — for the off-exchange object and for the
  five levels. Two gaps, one cause (the `apps/api` diff stays empty), one debt entry.
- The eight context widgets rebuilt as first-class quiet panels — phase 3.
- An alert-on-level entry point from the desk — phase 3, with alerts.
- The remaining spacing exemptions — phase 4.

## 2. Architecture

### 2.1 One liveness *claim* predicate, made unrepresentable to violate

This is the phase's highest risk and the reason phase 1 FAILed GATE Q with a fully green suite
(ledger key `one-liveness-predicate`). Four distinct expressions answer "is this live?" across the
four surfaces this phase folds into one panel; `isDeliveringLive` (`sessionTapeStanding.ts:54-60`) is
the canon predicate, and `TapePulseStrip.tsx:33` and `GexStrikeProfile.tsx:50` each compute their own.

**Mechanism.** `isDeliveringLive` returns a **branded** boolean (a nominal type produced only inside
that module). Every prop that renders a liveness claim is re-typed from `boolean` to that brand —
`FigureCell.live`, `Widget.live`, the structure-field model's `live` field, the ladder row's live
flag, the tape row's gate. A composition helper in the same module narrows "live AND this value is
present" while preserving the brand, because hand-written `&&` chains are exactly how the extra
expressions were born. A **source scan** (the `arc.spec.ts` importer-set idiom, mutation-guarded)
keeps `genuineIsLive` and the store's `isLive` out of presentational desk files, so a *new* file
cannot invent a fifth expression.

**`TapePulseStrip`'s `isLive` is a second fabrication site, and it is fixed here.** `:31-32` makes
`liveMid` require `tape.live?.mid != null`; `:33` makes `isLive` require only
`tape.isLive && tape.live?.live && !tape.streamOffline`; `:34` renders `displayMid = liveMid ??
structureMid`. When the stream is up but carries no `mid`, the readout at `:199,:204` prints
**`Live $<structureMid>`** — the word "Live" over the REST structure mid. **`isLive` gains the
`live.mid != null` requirement its own `liveMid` already has.** `:71` and `:73` push the same
fallback into the trail buffer on every rAF frame, so the drawn trail can be composed of
structure-mid samples; the same latch and the same gate fix both.

**Single store read.** Exactly one component in the hero calls `useLiveTape()` and passes the branded
claim and the mid down as props. That is the structural reason the four regions are presentational
children, not the aesthetic one.

### 2.2 The retention latch (owner ruling 2's debt) — value **and** boolean

`useFlashOnChange.ts:44` writes `prev.current = value` **before** the null guard at `:46`, so a drop
destroys the last non-null value. Nothing holds it today.

- A small hook holds a ref, updating **only** on a non-null **stream** value, keyed by a reset token
  of route symbol **and** replay-armed state — one token giving both clears ruling 2 requires.
- The latch composes **beside** `useFlashOnChange`, never through it. `LiveTape.tsx:93` already feeds
  the flash hook the raw stream value while `:96` composes a separate render value, so the
  "flash reads raw, render reads latched" split exists today. **`useFlashOnChange.ts:44` is not
  reordered.** Moving that write after the guard would make `prev.current` survive a drop and the
  first payload after a reconnect would flash against a pre-drop value — a fabricated tick on a
  figure whose whole purpose is honesty.
- **The latch owns both the rendered value and the `retained` boolean.** `FigureCell.tsx:267-275`
  (offline arm B) renders `<ValueGlyph value={value} … />` — it does not substitute a literal, it
  renders **whatever the caller passes**, in Sans at 15px. So fixing only `LiveTape.tsx:190`'s
  `retained: flipValue != null` while `:96`'s `?? m.gamma_flip` and `:188`'s `value=` stay would leave
  arm B rendering the bundle's structure flip as a 15px Sans pseudo-literal under an `offline`
  caption on a cell labelled live. Both come from the latch; neither reads `m.gamma_flip`.
- **The `(live)` suffix moves from the caption to the label.** `LiveTape.tsx:116` derives
  `gammaLabel = isLive ? 'Gamma flip (live)' : 'Gamma flip'`, so on a drop the label becomes
  byte-identical to the ladder's structure row while the two cells hold two different numbers — and
  the caption slot cannot carry the distinction, because `FigureCell.tsx:251,260,269` shows
  `effectiveCaption` is **overwritten** to `offline · last known` / `offline` in the offline arms,
  discarding the sub-copy on exactly the drop where the two numbers most need telling apart. The
  derivation lives in the label, which survives all four standings.
- ux's R1 substitute — swapping the *structure* flip in under the live label on a drop — is not
  available. It is a third fabrication (the two flips are different measurements by construction,
  `PROJECT_CONTEXT.md` §3) and it would delete ruling 2's arm A, which `DESIGN_SYSTEM.md:168`
  mandates for the one cell that can genuinely retain a value.
  <!-- spire:council-resolution:v1 aceb88547f1c7fa4c2e747d7b93124f584004111b1d599fb074bb861e828dc1c folded -->

### 2.3 The level ladder model

**Exactly five rows**, a closed five-member union (call wall · mid · max pain · gamma flip · put
wall) so a sixth row is a compile error, ordered by **computed** price — the levels can cross, and a
put wall above the mid is a real market state.

Per row: **price** (`number | NotANumber`, never `$—`); **distance** (`string | NotANumber`);
**liveness** (the branded claim, true on the **mid row only**); **stroke identity** (a token key, not
a colour).

**The distance anchor is the levels spot, not the mid.** All three lanes read this independently and
converged: `_kit/distanceToLevel.ts:11-14` anchors on `levelSpot(m) = m.gex_spot ?? m.price`,
`dealer-positioning/DealerPositioning.tsx:61` passes exactly that, and `ai-rec/copy.ts:318` labels
`gex_spot` *"levels spot, // NOT `spot` — the levels anchor is not the live display price"*.
Anchoring the column on the mid would silently change every distance the trader has read for months
**and** make all four structure rows recompute on every tick — five live rows, which canon 14 forbids
in the same sentence the criterion was drawn from. The mid row's distance cell renders the
not-applicable member, never a computed zero: a zero would assert the mid equals the structure
anchor, which it usually does not, and `distanceToLevel.spec.ts:8` pins
`distanceToLevel(250, 250) === 'at spot'`, so a computed mid distance is *anchor drift* wearing the
column's label — a different quantity, not merely a zero.
<!-- spire:council-resolution:v1 9923b1d9a01690c4f8d6d91fd0e0fabe28b820d7a95b669ee9ad6b97bf90902f folded -->
<!-- spire:council-resolution:v1 f4ad38a8ffd46134368808e9313925e4d751839c047d7884ad7ba213cde9307f folded -->
<!-- spire:council-resolution:v1 2e37b9d89c44cf98a84f89aa82f365bfc61fb66ebdabef3e004cf675be129c47 folded -->

**The twelve shipped cells decompose with zero orphans** — 3 to ladder rows (call wall, put wall, max
pain), 2 to the ladder foot (Vol-norm GEX, Raw GEX 1% shock), 7 to the read strip. The read strip's
eighth cell (IV rank) comes from `IvRank.tsx`. That accounting is what makes deleting
`DealerPositioning` reviewable. The **Field/Magnet view toggle** and `WallMagnetView` move with the
field, not into the bin, and the toggle's preference stays ephemeral component state (no new durable
key).

**Two gamma sources, deliberately.** The ladder's flip row is the **structure** flip (REST, dotless);
the live-recompute flip stays a tape figure. They differ by construction, so the live cell names the
structure flip it differs from, and the ladder row never adopts the live value — a level that moves
under the trader's eye is not a level.

### 2.4 The read strip model — eight fixed slots

**Eight fixed slots at every state, no reflow.** The architect withdrew its own R2 "7-or-8
cardinality" self-revision at R3 and conceded pm's position: the 7-or-8 fix repaired a fabricated
cause by recreating `[absent-is-not-none]` in the **scroll axis** — at 393px an absent cell and a
cell that scrolled off the rail are indistinguishable, and unlike the fabricated-cause problem that
has no repair inside the closed vocabulary. Fixed slots have a repair; variable cardinality does not.

The empty slot renders the member whose recorded meaning is "the feed did not send it" —
`shared/copy/notANumber.ts:9` (`not provided`), exported at `:48`. It is true when
`INCLUDE_DARK_POOL=false` suppressed the object and true when the best-effort computation failed, the
two causes `PROJECT_CONTEXT.md` §5 makes indistinguishable at the frontend with an empty `apps/api`
diff. It asserts neither. `unavailable` would assert a cycle that ran and produced nothing — a claim
the app cannot observe. `notANumber.ts:14-16` records the precedent that makes a per-surface choice
legitimate rather than sloppy (*"THE TYPE ENFORCES CLOSURE; THE CALLER PICKS THE MEMBER"*), so this
needs no tenth member and no new copy branch.
<!-- spire:council-resolution:v1 a4100aa2cb7bb692e152d140b40299fd1a5061c76a6edddc013e94ae6b111bc8 folded -->
<!-- spire:council-resolution:v1 a6439a93398104149a98f91b4fe6d857b91421fa05e503783a36cd54ebff130f folded -->

**`term_structure` keeps its shipped three-way render, and that is not a second vocabulary.**
`DealerPositioning.tsx:189-205` renders `unavailable` when the object is absent (`:194`), `—` when the
object is present but carries fewer than two points (`:196`), and the wire's `state` label otherwise
(`:197`). Both literals are members of the closed nine (`notANumber.ts:26-36`), and the three-way
split is legitimate for exactly the reason the off-exchange slot's single member is: **here the two
absences are distinguishable.** A present object with a thin `points` array is an observable fact, so
`—` — the minimum-claim member (§4.3) — is honest about it; an absent object is the *the cycle
produced nothing* case, which is what `unavailable` names and what the shipped tooltip already says in
words (`:201-203`, *"Term structure unavailable this cycle."*). Off-exchange has no such
discriminator, which is why it collapses to one member. The read strip carries this behaviour across
**unchanged**; criterion 60 pins it so the build lane neither guesses nor collapses it on the way.
Criterion 28 is untouched by it: `.state` is the wire's closed label, not a label re-derived from the
scalar.

All eight cells are REST/bundle reads — none is live-derived today, so the strip's honest liveness
state is eight dotless cells and any dot in it is a defect. `[dark-pool-context-only]` binds the
off-exchange cell (capped, no side, never success green); `[digested-labels-not-raw-dump]` binds term
structure, IV rank and skew (closed wire label through a closed lookup, never re-derived from the
scalar).

### 2.5 Component boundaries and the container-query hazard

**The hero is one `Widget` with four pure-props children** (`StructureFieldCanvas` · `LevelLadder` ·
tape-trail row · `StructurePathStrip`), with the store read and the claim derivation at the panel
host. Four peer panels would give four independent `panel` container contexts inside one visual
frame, four expand dialogs and four selection rings. Named cost: one `ErrorBoundary` around the whole
hero would let a canvas fault blank the ladder — §5 buys the inner boundary rather than waving at it.

**The strip is a rail; its *cells* are the container context.** `FigureCell.tsx:216-217` queries
`theme.containerQueries('panel').down(360)` / `.down(280)`, and CSS resolves `@container panel`
against the **nearest** ancestor bearing that name. `Widget.tsx:163` and `PanelContainer.tsx:16-17`
are the only two declarations in the app. Declaring the name **at the strip** would make the nearest
named ancestor of all eight ~140px cells the ~1280px panel body, so every cell would render at the
20px base and never step to 17 or 15 — at any viewport. It looks fine at desktop and merely looks
wrong at 393. Each strip cell is therefore wrapped in the shipped `PanelContainer` (same name,
nested — the nearest-ancestor rule does the work), with no edit to `FigureCell`'s query and none to
`type-floor.spec.tsx`'s assertion. The **bottom sheet re-declares the name at its own root**, because
MUI portals it to `document.body` and severs the ancestry — the same failure arriving by a different
route.
<!-- spire:council-resolution:v1 ea59389db41e25a65375ed5e66472d588b0d4b170d3073df03fe27ff557238fd folded -->
<!-- spire:council-resolution:v1 8501eb0fc07b63787479eb9e4707f47f6b3288d798ba64c4ccd297c235edba3d folded -->

`[lane-check]` **jsdom does not evaluate container queries.** A unit test may assert the
*declaration* only; the stepping *behaviour* is provable in the browser layer at a real width or by
review. No criterion in §3 claims a jsdom proof of stepping.

**The AI read is one component; the sheet is a container, not a variant.** The entire wide/narrow
difference is CSS — the two-column body becomes one column and the same section becomes a fixed
bottom sheet. Exactly one genuinely new subtree exists: the **peek row** under 768px, which carries
the verdict. Constraint: the peek row and the panel verdict are the **same value from the same model
field**, and **exactly one of the two is mounted at any width**.

### 2.6 The AI read: a shipped `(request, result)` space, not a flat enum

`ai-rec/presentationPolicy.ts:4-19` declares **fifteen** request states and `:20-26` **six** result
states, and `deriveAiRecPresentation` (`:106-181`) produces a **pair**, not a single enum. Canon 16
names nine.

- `AiRecRequestState` and `AiRecResultState` remain the authoritative closed unions. Nothing widens
  or narrows them this phase.
- **The two axes are computed independently, and they are not alternatives.** `:115-126` assigns
  `requestState` from one `??` chain; `:128-136` assigns `resultState` from `produced && rec.strategy`
  alone (`produced` is `rec.status === 'produced' && rec.strategy != null`, `:108`). **Nothing in the
  function makes the two mutually exclusive.** The space the mapping must cover is therefore the whole
  **15 × 7** grid — six result states plus `null` — not a list of fifteen alternatives. Any statement
  that a given request state "carries `resultState: null`" is a claim about a function this module
  does not contain, and the one place this spec previously made such a claim is corrected in §4.5.
- One **total** mapping `(requestState, resultState) → ReadLayout`, with an exhaustive switch and a
  `never` default arm on **each** axis, so a sixteenth request state or a seventh result state is a
  **compile error** at the mapping, not a silent fall-through to `idle`.
- **`ReadLayout` is a body plus its annexes, not one name:** `{ body: BodyCase; annexes: Annex[] }`.
  That shape is not invented here — *stale* and the full-analysis drawer already **compose over** a
  produced read (§4.5, ruling P4), and the shipped host already renders the produced body
  independently of the request axis: `AiRecPanel.tsx:205` computes `producedRec` from
  `rec.status`/`rec.strategy` alone and `:387-388` mounts `<DecisionCard>` on that alone.
- **Which axis picks the body.** `loading` (`:116`) and `signed_out` (`:117`) are **body-replacing** —
  the host suppresses the produced body under both (`AiRecPanel.tsx:387`: `signedIn && producedRec &&
  !loading`) — so those two pick the body for all seven result values. For the other thirteen request
  states, `resultState ≠ null` picks the body from the **result** axis, and `resultState === null`
  picks it from the **request** axis.
- **What the request axis contributes on top of a produced body** is fixed by the table below, so the
  `never` arm never has to invent behaviour. All fifteen request states are accounted for:

| request state(s) | reachable with `resultState ≠ null`? | what it contributes over the produced body |
|---|---|---|
| `loading` (`:116`), `signed_out` (`:117`) | yes | body-replacing (above) — the produced read is suppressed by the host, not annotated |
| `unavailable` (`:103`) and the seven other response-key states (`key_unusable`, `key_rejected`, `model_not_in_catalog`, `model_unset`, `oauth_expired`, `oauth_unlinked`, `subscription_unavailable`) | **no** | `responseKeyState` returns non-null only when `rec.status === 'unavailable'` (`:102`), which makes `produced` false at `:108`; and the host passes `poweringReason: null` whenever `rec.status === 'produced'` (`AiRecPanel.tsx:176-181`). **A10 never composes.** |
| `missing_key` | **yes**, by one route only — `!inAppEnabled && !scenarioSelected` (`:122`), which does not read `rec` | the shipped powering CTA renders beside the produced read (`AiRecPanel.tsx:373-375` and `:387-388` are independent branches); **unchanged this phase** |
| `daily_cap` (`:123`), `cooldown` (`:124`) | yes | **nothing — shipped rendering, unchanged.** This is a declared destination, not an omission, and §9 item 6 records why it is only *arguably* wrong and why it was not ruled |
| `no_edge` (`:125`) | yes | **the quiet-gate annex, case A1c** — the gate note and `Ask anyway` beneath a still-readable produced read (§4.5) |
| `idle` (`:126`) | yes | nothing — this is the ordinary produced read |

- **No nine-member state enum is introduced.** It would be worse than useless in exactly the way the
  six-member `NotANumber` union was at owner ruling 3: the eight powering reasons would not become
  type errors, they would become a lossy `string`.

The four homeless shipped states receive explicit dispositions in §4.5 — none is folded silently, and
`no_edge`'s disposition covers **every** pair it participates in, not only the pair where nothing was
produced.

### 2.7 The shared stroke table

Canon 14 binds each ladder row's tick to the same stroke as its line in the field. Today the field's
level strokes are module-level hex literals in the paint path, exempted in `hex-discipline.spec.ts`.
**One stroke table keyed by ladder-row identity, exporting token keys**, with the React host
resolving keys → colours via `useTheme()` / `extrasFor(theme)` and passing a **resolved palette** into
the canvas as a prop. Drift becomes impossible because there is one table. This is the same edit that
delivers P5's light-mode parity, and it is coordinated: deleting the literals **invalidates the
`hex-discipline.spec.ts` exemption entry**, and the live-exemption test fails if the entry stays while
the hex goes. The canvas's header comment currently claims *"Theme literals match tokens.ts"* — prose
standing in for the structural rule, which is the shape `[structural-over-prose-enforcement]` exists
to kill; it goes with the literals.

**Four clocks, never merged:** structure (~60s REST poll — never dims) · tape (SSE — dims, pause
mark, retained value, never blanked) · slow lane (structure history — neither live nor bundle-fresh,
never wears a live mark) · read (AI, pinned to a snapshot — never self-refreshes). **The AI read's
staleness is measured against the structure clock, not the tape clock** (`presentationPolicy.ts:130`
branches on `input.stale`, a newer-REST-snapshot fact). **An SSE drop must not make the read stale.**

**Failure modes + isolation:** see §5.

**Not buildable / rejected approaches:**

- **Unifying the two gamma sources**, or recomputing any level. The ladder is a re-presentation of
  shipped numbers.
- **Re-anchoring the distance column on the live mid** — five live rows, forbidden by canon 14 two
  clauses later.
- **Declaring `containerName: 'panel'` at the strip** or introducing a second container name.
- **Reordering `useFlashOnChange.ts:44`** — non-goal 8; it manufactures a tick.
- **A second stroke table for the ladder** — "one object" becomes a coincidence that drifts on the
  first token change.
- **A source scan asserting every canvas draw call sits inside a `model.live` branch** — cheap and
  brittle enough to be defeated by the first refactor.
- **Demoting the strip's `Live`/`Mid` word to a per-figure provenance mark** — see §4.2.
- **A rendered-value-keyed `retained` boolean** (`LiveTape.tsx:190` today).
- **Treating any request state as a peer of the result states**, i.e. a flat enum over both axes. It
  is the shape that produced this spec's one factual error about the shipped code (§4.5).

## 3. Acceptance criteria (with user stories)

Stories: **S1** find the five levels and my distance in one object · **S2** know which numbers are
live and which are snapshots · **S3** verdict first, risk before prose · **S4** "no trade" is a
complete answer that still ends in something useful · **S5** be told when the read is pinned to an
older snapshot · **S6** the desk stays readable signed-out or key-less · **S7** the read is reachable
on a phone without losing the desk · **S8** a stream drop preserves and marks the last value ·
**S9** context reads never feed the score · **S10** the AI's own numbers are labelled at the number.

`test` = automated · `review` = verified by inspection. **SB** = ship-blocking.

**DELEGATED lineage is carried on the row itself.** A row tagged **DELEGATED (P1…P5)** or
**DELEGATED (D-14)** exists because of a call the conductor made under delegation while the owner was
asleep — P1 in §4.4, P2 and P4 in §4.5/§4.6, P5 in §4.6, D-14 in §4.3 — and reversing that call
removes or rewrites the row. Untagged rows come from owner rulings, the BRIEF's invariants, or the
sixteen technical conflicts the voices settled at file:line in `decisions.md` §2; row 31, for one, is
`[ai-asserted-numbers-are-traceable]` doing the work, not P2.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | S1 | The ladder renders exactly five rows — call wall, mid, max pain, gamma flip, put wall — sorted by price, at every data state; a null level never removes a row | test |
| 2 | S1 | The ladder renders the level names **`Call wall`** and **`Put wall`** as visible text, unchanged in wording from the grid it replaces | test |
| 3 | S1 | Every non-mid row shows its distance from the levels anchor (`gex_spot`, falling back to `price`); the mid row's distance cell renders `—`, never a computed zero and never an empty cell | test |
| 4 | S1 | The ladder states, once, which price the distances are measured from | review |
| 5 | S1 | A level the current bundle does not carry keeps its row and its label, renders `—` in the not-a-number register (15px Sans) in its value cell, renders `—` in its distance cell, and is never a zero, another member's literal, `$—`, or an empty row — **DELEGATED (D-14)** for the choice of `—` | test |
| 6 | S1 | Vol-norm GEX and Raw GEX (1% shock) still render, with their shipped tooltips | review |
| 7 | S1 | Each ladder row's tick and its line in the field are drawn from one stroke definition — changing one token key moves both, and no ladder tick has a colour the field does not use | test |
| 8 | S2·S9 | On the whole desk, at every connection kind and replay standing, the only figure bearing a live dot is the ladder's mid row plus the live tape's stream-sourced cells; the quiet band contains zero live dots and zero `data-figure-state="live"` nodes | test (**SB**) |
| 9 | S2 | The desk carries exactly **one** connection chip in the viewport at both scroll positions, and no free-standing liveness **word** renders anywhere in the hero | test (**SB**) |
| 10 | S2 | The hero's mid readout is labelled `Mid` in every standing and never renders the structure mid under that label; when the stream is delivering but carries no mid, no live claim is made about it | test (**SB**) |
| 11 | S2 | The hero states its basis once: `levels are REST structure (as-of {age}) · the mid is tape` | review |
| 12 | S8 | On a stream drop, a live-derived figure **whose stream latch holds a value** renders that latched value at 50% opacity with the pause marker and the caption `offline · last known` | test (**SB**) |
| 13 | S8 | On a drop with an **empty** latch, the same cell renders a closed-vocabulary member with the pause marker and **no** "last known" words | test (**SB**) |
| 14 | S8 | No figure anywhere on the desk renders the "last known" retention wording over a value sourced from the REST bundle rather than the stream latch | test (**SB**) |
| 15 | S8 | A widget-level subtitle claiming last-known ticks renders only when at least one cell in that widget holds a latched stream value; otherwise the no-ticks-retained arm renders | test |
| 16a | S8 | **After a symbol change** the latch is empty: every live-derived cell shows the bare not-a-number member with **no pause mark and no dot** (the stream republishes `{live: null, streamOffline: false}` at `useTickerStream.ts:34`, so `LiveTape.tsx:100`'s `tileOffline` is false and `FigureCell.tsx:255`'s offline arm is never entered), no prior symbol's value survives in any cell, and the connection chip is simultaneously on its **wordless placeholder** (`connectionStateFor` returns `null` when `live == null`) | test |
| 16b | S8 | **After a replay arm** the latch is empty: every live-derived cell renders **F6** — full strength, no dot, no pause mark, caption `session replay` (`FigureCell.tsx:277-281`) — no pre-replay value survives, and the connection chip shows the **replay** state, **never** the placeholder (`connectionState.ts:92-96`: once `live` is non-null the resolver cannot re-enter `null` within a mounted session for that symbol) | test |
| 17 | S8 | A value restored from the latch on a drop does **not** produce a flash | test |
| 18 | S2 | The tape cell's label names its **derivation** (`· live` / `· session tape`) in every standing, never changes with connection state, and is never byte-identical to the ladder's `Gamma flip` row label | test |
| 19 | S8 | On a drop, the strip's static cells, the ladder's four structure rows and every quiet-band card render **identical text content** to their pre-drop render, and none is dimmed | test |
| 20 | S8 | On a drop the field keeps its last computed geometry — curve, wall lines and flip line still painted — while trail, drift, beam and sweep stop: against a recording 2D context, `live: false` yields zero trail points, zero particle `arc()` calls, zero sweep gradient fills and **non-zero** level strokes | test |
| 21 | S8 | The field's container is not dimmed on a drop | review (browser, both stream states) |
| 22 | S8 | With reduce-motion on, the field drift, the tape trail and the mid beam render as static frames at every width | review (browser, both settings) |
| 23 | S1·S2 | The levels, the tape trail's values and the mid are readable as **text** in the DOM beside the field (the ladder is their text equivalent) — **DELEGATED (P1)** | test |
| 24 | S1 | The field carries an accessible name, a short summary naming what it plots and the levels it marks, and a programmatic pointer to the ladder as its tabular equivalent — **DELEGATED (P1)** | test |
| 25 | S9 | The read strip renders **eight** cells at every state; the cell count does not change between states, an absent datum keeps its slot and its label and renders a closed-vocabulary member in body type, and its neighbours keep rendering their values | test (**SB**) |
| 26 | S9 | The off-exchange cell renders **`not provided`** whenever the bundle carries no off-exchange object — in both the disabled-source and failed-computation cases — and never `unavailable` or any member naming a cause the app was not told | test |
| 27 | S9 | The off-exchange cell renders neutrally, states that it is context only with no side, and never in the success/direction register | test |
| 28 | S9 | Term structure, IV rank and skew render the wire's closed label; no strip cell re-derives a label from a scalar | test |
| 29 | S3 | The verdict word is the first content node in the AI panel's reading order | test (**SB**) |
| 30 | S3 | The verdict word is the only element in the panel spending amber **as text**, in **every** state. Non-text amber is a **closed list of three**: the authored `:focus-visible` ring (canon rule 6), the in-flight progress indicator while a request is actually running, and **the fill of the state's ONE primary action** (`primary.main` — canon's fill/UI amber grade). A colour census of the panel — covering **text and non-text bindings both** — finds no fourth, and finds **at most one** primary-action fill mounted in any single state — **DELEGATED (P2), amended at GATE Z 2026-09-05 by owner ruling** | test (**SB**) |
| 31 | S3·S10 | Each of the four risk fields (max risk · invalidation · entry · target) renders its grounding **before** any prose, declaring traced vs the model's own number in the **type register** — Mono for traced, Plex Sans with a dotted rule for the model's own — and never in colour | test (**SB**) |
| 32 | S3 | Every named AI-read case of §4.5 is independently reachable from at least one producible `(request, result)` pair in the fixture harness — **DELEGATED (P4)** | test (**SB**) |
| 33 | S3 | No two non-synonymous AI-read cases render the same primary line, and no case is identified — in a criterion, a test or the build report — by a marker another reachable case also renders — **DELEGATED (P4)** | test (**SB**) |
| 34 | S3 | A **request failure** renders its own named line and never renders as *idle* or as a *no trade* verdict — **DELEGATED (P4)** | test (**SB**) |
| 35 | S3 | *Stale* and the full-analysis drawer **compose over** a produced read: the read stays present and readable beneath/behind them, and neither replaces it — **DELEGATED (P4)** | test (**SB**) |
| 36 | S3 | The cooldown and daily-cap renders never show each other's marker: a capped user is never shown a countdown, and a cooling-down user is never shown a reset time — **DELEGATED (P4)** | test (**SB**) |
| 37 | S6 | The eight powering reasons each render their own sentence and CTA label; no two collapse into one string | test (**SB**) |
| 38 | S4 | *Produced (no trade)* renders at the same typographic weight as a trade, with no warning chrome, no error tone and no red, and names the conditions that would change the read | test (**SB**) |
| 39 | S4 | In *produced (no trade)*, **every control the panel renders performs an action this build actually performs** — no disabled placeholder and no control whose label names a capability this build does not have | test (**SB**) |
| 40 | S4 | The *no trade* wording carries the level as a **condition** in the `Re-engage when {conditions}` line, never as a control label | review |
| 41 | S3 | *Idle* offers the ask control and states the snapshot's as-of, and carries **no** quiet-gate note or ask-anyway control; the quiet-gate arm carries both plus everything idle renders — **DELEGATED (P4)** | test |
| 42 | S3 | The quiet gate's `no_trade` renders in Mono lowercase and never in the verdict slot or the verdict's display register; the *no trade* verdict renders in Archivo display and never inside a note — **DELEGATED (P4)** | test |
| 43 | S5 | A read pinned to an older snapshot than the desk beside it renders an in-body **warning strip with the icon**, never a footnote, and the read stays legible beneath it — **DELEGATED (P4)** | test (**SB**) |
| 44 | S5 | An SSE drop alone never marks the AI read stale | test |
| 45 | S7 | Under 768px the brief renders as a bottom sheet with a peek row carrying the verdict; **exactly one** verdict-marked node is mounted at 393px and exactly one at 1280px, and the two carry the same string from the same field | test (**SB**) |
| 46 | S7 | Figures inside the bottom sheet step with their container exactly as they do in the panel | review (browser, 393) |
| 47 | S6 | Signed out, without a key, cooling down, capped or after a request failure, the structure, the tape, the strip and the quiet band all render unchanged | test |
| 48 | S9 | The quiet band carries its own basis and as-of and never wears a live mark | test |
| 49 | all | At **393px in both colour schemes**, and at **834, 900 and 1280 in the one scheme the standing suite runs**, the desk has no horizontal page overflow | test (browser) (**SB**) |
| 50 | all | At those same width × scheme combinations, the read strip scrolls sideways when its cells do not fit and **the page itself never scrolls sideways** | test (browser) (**SB**) |
| 51 | all | The suite's **executed** case list, captured before GATE Q, names every width × scheme combination rows 49 and 50 claim; a combination claimed but not executed is a FAIL of this row, not a PASS of the row that claimed it | review (build report, against the captured list) |
| 52 | all | **In light mode at 393 and 1280, the hero field renders on the active scheme's panel surface; no background fill is scheme-invariant** — **DELEGATED (P5)** | review (browser, both settings) |
| 53 | all | No surface this phase creates renders a hardcoded, scheme-invariant background or text colour — **DELEGATED (P5)** | test |
| 54 | all | The masthead's one primary action and the brief's "Review simulated trade" both open the one shared `TradeEntryDialog`; no second entry component exists and nothing reaches a real order path | test |
| 55 | all | `git diff --name-only <merge-base>..HEAD -- apps/api` returns zero lines, and `opportunity_score` / `opportunity_tier` / `state_fingerprint` are byte-identical | test (**SB**) |
| 56 | all | `npm run typecheck` exits 0, recorded separately from `nx test`'s exit code | test (**SB**) |
| 57 | all | Every gate this phase lands is proven by a poison run that goes red, and each poison proof is itself proven non-vacuous | review (build report) (**SB**) |
| 58 | S3·S5 | With the readiness gate reporting no fresh edge **and** a produced read on screen (`requestState: 'no_edge'`, `resultState ≠ null`), the gate note and its `Ask anyway` control render **in body, beneath the read**, and the read stays present and readable — the note never replaces it and the panel is never rendered as an ordinary fresh read — **DELEGATED (P4)** | test (**SB**) |
| 59 | S3 | The composing quiet-gate note renders **no** Mono `no_trade` stance line while a verdict is mounted; that literal renders only in the idle arm, where the verdict slot is empty. Neither the idle arm nor the composing arm is identified by the shared gate-note string alone — each is keyed on its own conjunction (§4.5) — **DELEGATED (P4)** | test |
| 60 | S9 | The term-structure strip cell renders `unavailable` when the wire object is absent, `—` when the object is present with fewer than two points, and the wire's `state` label otherwise; it never renders a label derived from the scalar and never a fourth literal | test |

**Where these criteria came from, where they were corrected, and why.**

**Overflow.** Row 49 is written to the suite's actual shape. `no-overflow.spec.ts:43-45` records the
decision in terms — *"ONE SCHEME for the wider bands, deliberately: horizontal overflow is box
geometry and dark/light change no widths … 393px keeps BOTH schemes because that is where content is
tightest"* — `:47-54` declares `WIDE_VIEWPORTS` as 834 / 900 / 1280 with **no scheme axis**, and
`DESIGN_SYSTEM.md:172` (rule 17) already states the split correctly. "Both schemes at all four widths"
was inherited from phase 1's brief into this BRIEF and into three lanes' rows; it is either a
criterion certified against runs that do not exist, or a silent doubling of the wide-band matrix that
reverses a documented decision. Row 51 exists because `playwright.config.ts` is an explicit
`testMatch` allowlist: **an unregistered spec reports green by never running**, so the row is proved
with `npx playwright test --list`, not with a passing summary. Row 52 is not covered by rows 49–50 —
a dark plate overflows nothing.
<!-- spire:council-resolution:v1 bb0e7c4521b3c8ce39c3b39d2f0bd2bf4f0ffe51b31e6999e316cd01c893dad3 folded -->
<!-- spire:council-resolution:v1 2c5bd4ed7c96010920f93f67f1ece3c75f928c2b23b5a53c9dc703c50569abae folded -->

**"Byte-identical" is split three ways** (rows 19 / 20 / 21), because one sentence hid three
obligations with three different verifications. Applied to the field it also **contradicted itself**:
the field's drift must *stop* on a drop, so a build satisfying the drift row red-builds the identity
row and vice versa. And it was unobservable: `StructureFieldCanvas` paints to a Canvas2D context and
its directory carries zero `aria-`, `role=` or visually-hidden text; `live-dot-census.spec.tsx:171`
counts DOM nodes and `single-motion-moment.spec.ts:54-55` scans literal `@keyframes` names, so no
shipped harness can read a canvas pixel. Row 19 is scoped to what has DOM text, row 20 rides on the
extracted pure paint step (§7), and row 21 is `review` because canvas opacity is a container-level
style the fake context cannot see.
<!-- spire:council-resolution:v1 c8501479224a1c6c07579ce281f098ab0b5500da2bb6c30161a774ae9b0841dc folded -->

**No criterion asserts a count.** The row that read *"all nine named states are independently
reachable … and no two of them render the same primary line"* was withdrawn by its own author: it is
unsatisfiable against a correct implementation, because *stale* composes **over** a produced read and
the drawer opens **from** one, so a stale trade read and a fresh trade read render the same verdict as
their primary line — correctly. Rows 32–35 keep the non-collapse teeth and drop the tally, exactly as
owner ruling 3 settled for the not-a-number vocabulary. The same rule applies to §4.5's own render-case
count: it is descriptive prose, and no criterion is keyed on it.
<!-- spire:council-resolution:v1 98909d6a382f6054a3ce8d7655ddd4302f25b66e835b3e878cbac8d9aa87977a folded -->

**"A useful primary action" is not a criterion.** Row 39 replaces it with the observable a stranger
can check by pressing the button. A reviewer looking at a control labelled `Alert me at 575` reads it
as useful whether or not pressing it does anything, and the row would have shipped as a green
assertion over three checkable clauses while the unverifiable one carried the honesty. The row now
covers **every** control the state renders, not just the primary.
<!-- spire:council-resolution:v1 c244d9322e8506f5f8aeada6d30e21d42cd5b99ea36d4d90a69f62a69533348a folded -->
<!-- spire:council-resolution:v1 d55d1d188499f798c1a94c8e5e3ca9fa45afc75201ac0cffd205bed5c66748e4 folded -->

**GATE Z amendment (2026-09-05, owner ruling) — the primary-action fill is the third permitted
non-text amber.** GATE Q #1 FAILed row 30 on evidence the conductor's P2 ruling had not accounted for: a
token-exact DOM census of the production build found four `variant="contained"` primary CTA fills
spending brand amber inside the panel (`Analyze current snapshot`, `Review simulated trade`, the sign-in
button, and the light-mode `#C57F19` equivalent). **The ruling was the outlier, not the code.** The canon's
own palette table defines **`primary.main` AS fill/UI amber**, deliberately distinct from the text grade
(`extrasFor(theme).textAmber`) — the two-grade system exists precisely so amber can be a fill *and* a
text colour with different contrast floors. The owner-approved design source draws these buttons amber
(`design/src/screens/ai-read.mjs` `btn primary`). Re-toning them would have contradicted the approved
canvas and made this panel's primary action weaker than every other primary button in the app.

What keeps the rule meaningful after the amendment is **cardinality, not exclusion**: each panel state
renders exactly **one** primary action, so the census asserts *at most one* primary fill is mounted —
amber stays spent, not sprinkled, which is what canon rule 16 actually protects.

**The second, independent ground for the FAIL stands and is NOT resolved by this amendment.** The census
row 30 names **did not exist**: `readLayout.render.spec.tsx:84`'s `amberBearingTexts()` scans `color:`
bindings only, so a `test (SB)` row shipped with automation for one of its two clauses. The row is
re-verified only once a census covering **non-text bindings** exists and is mutation-proven.

**The amber criterion excludes the focus ring, and does not branch on a ruling.** Read as "no other
amber pixel", the rule is **unsatisfiable against canon rule 6** (`DESIGN_SYSTEM.md:161`), which
mandates an authored `:focus-visible` ring in text-grade amber — and this panel is required to contain
focusable controls (the `AccessibleHelp` ⓘ per owner ruling 6, already mounted per cell at
`FigureCell.tsx:305`, plus the ask control, the drawer trigger and the review control). A reading that
contradicts another canon rule cannot be the right one. Row 30 is therefore unconditional and true in
every state: where there is no verdict word, the census of amber **text** in the panel is zero. The
conditional hedge *"if the ruling narrows the rule, this row narrows to…"* was withdrawn by its own
author — a criterion that branches on a pending ruling is not checkable.
<!-- spire:council-resolution:v1 6d672404065db32db8b7cc93b0fc40426ed0bf5f4077b91b5edcbcfc09361cbc folded -->

**"Has already received a value" did not say received from where, and today's code answers "from the
REST bundle".** `LiveTape.tsx:96` composes `flipValue = (numbersActive ? live?.gamma_flip : null) ??
m.gamma_flip` and `:190` passes `offline={tileOffline ? { retained: flipValue != null } : null}` —
the call site's own comment at `:180-184` states it in terms (*"its offline arm is RETAINED whenever a
fallback exists"*) — so `FigureCell.tsx:260` prints `offline · last known` over a structure number
that never came off the stream. Rows 12–15 are keyed on **the value the latch holds**, which is
narrower than "received on the stream" and is the property that is actually checkable: `LiveTape.tsx:93`
already passes the raw stream value to the flash hook while `:96` composes a different render value,
so a value can be received on the stream and then discarded by the render.
<!-- spire:council-resolution:v1 238b1c70b41701e272f5759c9bf49b284eb02d8a3f48c927a1fec2083140e330 folded -->

**Rows 58–59 exist because a disposition was written against a function the code does not contain.**
An earlier draft of §4.5 dispositioned `no_edge` as an idle-only arm on the claim that it "carries
`resultState: null`". `presentationPolicy.ts:115-136` computes the two axes independently, so
`(no_edge, fresh_trade)` is reachable — and in that state the shipped host renders the produced card
(`AiRecPanel.tsx:205,387-388`) while the gate note's only home never mounts (`:423` gates
`ActionRegion` on `!producedRec`; the note is `AiRecPanelBlocks.tsx:205-224`). The trader sees an
ordinary fresh trade with no sign that the guardrails see no fresh edge. Row 58 makes the annex
observable; row 59 keeps it out of the verdict's register **and** keeps the two quiet-gate arms from
being identified by the one string they share. Both are `test` because both are DOM facts at a
producible fixture pair.

## 4. UI + interaction

**Flows.** Masthead → hero (field + ladder + tape trail + structure path) → read strip → AI read
brief (wide beside tape / position / orders; a bottom sheet with a verdict peek row under 768px) →
quiet context band. The read strip scrolls sideways as a deliberate rail; the page never does.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (**Status: SET**).

### 4.1 Component states

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Level ladder | five rows sorted by price; mid row live-dotted, four structure rows dotless; anchor named once in the header | inherits the desk's cold skeleton | a null level keeps its row and label, `—` in the value cell, `—` in the distance cell | inner boundary keeps the ladder rendering when the canvas throws; a bundle failure leaves the desk behind the soft warning | four structure rows byte-identical and **un-dimmed**; only the mid row dims, with the pause mark |
| Structure field | curve, wall lines, flip line; drift/beam/trail/sweep running | cold skeleton | no curve → static message inside the field region only | inner `ErrorBoundary` → static message; ladder, tape row and path keep rendering | last computed geometry still painted, undimmed; trail, drift, beam and sweep **stop** |
| Tape trail row | `Mid` label + mono value; trail drawing | — | `—` with the pause mark | — | latched stream mid + pause mark, or `—` + pause mark; caption `tape paused · trail frozen` when the trail holds samples, `tape paused` alone when it never drew |
| Read strip | eight dotless figure cells | cold skeleton | absent datum → closed-vocabulary member in the slot, label kept | neighbours keep their values | byte-identical and un-dimmed (no cell is live-derived) |
| AI read brief | verdict → four risk fields with grounding → prose; with the readiness gate closed, the quiet-gate annex renders beneath the read (**A1c**) | in-flight indicator; **no verdict word mounted** | idle: ready line + composer + ask control; with the gate closed, plus the gate note and `Ask anyway` (**A1b**) | request failure: `AI unavailable — try again` + body, previously pinned read still pinned and readable | stale/superseded: in-body warning strip with the icon, over a still-readable read |
| Quiet context band | quiet panels, own basis + as-of, never lift, never sheen | — | per-card closed-vocabulary member | per-card | byte-identical, un-dimmed, no live mark |
| Connection chip | one per page, six states | wordless placeholder before the first stream fact, latching irreversibly | — | — | `offline` (warning + icon, "reconnecting…") |

### 4.2 The hero's mid readout — the `Live` / `Mid` word is **deleted**

Not demoted. Rule 13's provenance mark is a **dot plus a visually-hidden word**
(`FigureCell.tsx:129-148`), not a visible one, so "demote to a per-figure provenance mark" deletes the
visible word either way; and the datum is the mid, which already receives exactly one mark inside the
same frame at the ladder's mid row — a second mark on one number in one panel reads as two claims
about it. `TapePulseStrip.tsx:207-211` records that phase 1 deleted the neighbouring
`tape-stream-state` node for being *"a SECOND page-scope liveness authority beside the header
connection chip"*, and then left `{isLive ? 'Live' : 'Mid'}` standing at `:199`.

**Deleting it removes no information**, which is why it is free: `:71` computes
`displayMid = liveMid ?? structureMid` and `:73` pushes a trail point every rAF frame
unconditionally, so today `Mid` denotes a **basis fallback** — "you are looking at the structure mid
moving". Canon rule 22 removes that fallback this phase, so the word describes a state that stops
existing.

The mid's label is `Mid` unconditionally (a label, not a claim), beside the existing
`Structure ${structureMid}` readout (`TapePulseStrip.tsx:219-221`), unchanged. Liveness is carried
once by the ladder mid row's per-figure dot. Basis is stated once in the hero head.
<!-- spire:council-resolution:v1 e005d715e9e7e5bee7c6250abc6c4dd3b2ae11e87b0abe2cabb657a5005bfd25 folded -->

### 4.3 The ladder's absent-value rule — one member, chosen by wire **shape** — **DELEGATED (D-14)**

Choosing a literal that "matches **why** a level is absent" asserts knowledge the frontend does not
have, and it cannot fail honestly — any shipped literal can be argued to match. Both lanes read the
wire: `generated/schema.ts:1687,1703,1705,1716,1748` carry `call_wall`, `gamma_flip`, `gex_spot`,
`max_pain` and `put_wall` as **optional and nullable** with **no companion reason field**, and the
hand-written client disagrees with its own schema (`libs/api/src/lib/convexa.ts:212-215` declares
three of them non-nullable while `convexa.spec.ts:366-367` fixtures two of them null), so the type
cannot be used as evidence either. **There is no discriminator.** The SPEC therefore names **one**
member for all five level absences, chosen by a rule the frontend can evaluate — *the level field is
absent or null* — and books the missing attempted-versus-failed discriminator as debt with a phase
attached (§1 Future).

**That member is `—`** — and this is **DELEGATED (D-14)**, the sixth call, not a council convergence.
`decisions.md` settled that **one** member covers all five absences but did not say **which**, and
pm's R3 §10 and ux's R3 §11 named different ones; the choice was made by the R4 synthesizer under the
same delegation as P1–P5 and is recorded as a real call in
`state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md` §*"Decided at R4"* / D-14. It is
reversible by changing one constant. The grounds: the shipped precursor already picks it —
`dealer-positioning/DealerPositioning.tsx:109,117,157` render `'—'` for an absent call wall, put wall
and max pain, while `:127` and `:147` render `'unavailable'` for `vol_normalized_gex` and `net_dex` —
absent **sub-objects with a documented input dependency** (`:133`: *"unavailable until ATM IV or 30d
HV lands"*), the one case where the frontend genuinely can observe the reason. `—` is also the
minimum-claim member: `FigureCell.tsx:285` names its state `empty`, so it asserts less than
`unavailable` (a cycle ran and failed) and less than `not provided` (the feed omitted it — true for a
missing key, **false** for a present null, which this wire permits). The read strip's empty
off-exchange slot keeps `not provided` (§2.4) because there the whole **object** is omitted; the rule
is one rule keyed on wire shape, not two vocabularies. No tenth member; rule 24's closure at nine
holds. Row 5 carries the D-14 tag for exactly this literal. *See also §9 item 1.*
<!-- spire:council-resolution:v1 9fd66af16ac8179486f4303b74e9c324f1ac48c5f5f0eeaa90fe56c991dca98c folded -->

**The distance cell is never blank.** An empty cell in a column is indistinguishable from a render
bug — `[absent-is-not-none]` in the column axis — and leaving the mid row's absent distance typed
while a null level's was blank treated two rows inconsistently with no mechanism distinguishing them.
A null level's distance cell renders `—` for the same reason the mid row's does: the distance is
undefined **because the level is**, a predicate the frontend can evaluate directly.
`distanceToLevel.ts:24-25` already returns `null` when either input is missing, so this is a caller
choice at the ladder, not a change to the helper. (This half is a settled technical conflict, not
D-14 — D-14 chose only the absent-**value** literal.)
<!-- spire:council-resolution:v1 a0f5ddca890f921c7283b7a0bb74c53998fda7b9ea4bc6e21b12c3c1ec1cce2f folded -->
<!-- spire:council-resolution:v1 a5896ba42ede2d83940fad754a8c1f8eb9ce87c21431b819216768559af63b04 folded -->

### 4.4 The canvas gets a name and a summary — **DELEGATED (P1)**

The clause *"every value they carry is still readable as text"* is split three ways, because the
ladder changes the arithmetic:

1. **The levels are already text — assert it (row 23).** Canon 14 puts call wall · mid · max pain ·
   gamma flip · put wall with their distances in the ladder, in the DOM, beside the field, and says
   the two read as one object. Every *level* the field draws therefore has a text equivalent today,
   for free — as do the tape trail's values and the mid.
2. **The canvas gains an accessible name and a summary alternative (row 24) — not optional.** This
   phase promotes an unlabelled canvas from one widget among thirteen to the desk's primary
   instrument; scoping it out would create a regression *by this phase's promotion*. The design
   source already does it — `design/src/lib.mjs:296` emits
   `role="img" aria-label="Net dealer gamma by strike"` (**correcting `decisions.md`, which cites
   `:293`**) — and the shipped canvas does not.
3. **The curve's point-by-point text equivalent is named debt, phase 4** (§1 Future). It is unpriced,
   and owner ruling 5's precedent is that an audit whose failures can only be fixed by re-laying-out
   screens the phase may not touch is ship-blocking in the wrong way.
<!-- spire:council-resolution:v1 bbd9e6aaa6d596150801c2775312747cb0367c7d760028657d60c31885ac5ab0 folded -->

### 4.5 AI read — the named render cases, and the disposition of every shipped state

Nine names in canon 16; **thirteen render cases** on three axes — nine exclusive body cases, one outer
gate, and three that **compose over** a produced read. (Descriptive prose. No criterion is keyed on
the count — rows 32–33 carry the non-collapse teeth instead.)

| case | canon-16 name | marker the test keys on | composition |
|---|---|---|---|
| A1a | idle | ready line + composer + primary control, and **no** gate note | exclusive body |
| A1b | idle · quiet gate | everything A1a renders **plus** `No fresh edge right now` + its caption (`ai-rec/copy.ts:60-64`), the Mono `no_trade` stance line (`AiRecPanelBlocks.tsx:209`) and the `Ask anyway` control (`:14`, tooltip `:89`) — **and no mounted verdict** | exclusive body — the `no_edge` arm where `resultState === null` |
| A2 | loading | in-flight indicator, no verdict word mounted | exclusive body |
| A3 | produced (trade) | the `Trade · {bias}` verdict in Archivo display | exclusive body |
| A4 | produced (no trade) | the `No trade` verdict in Archivo display + `Re-engage when {conditions}` | exclusive body |
| A6a | cooldown / daily cap | `Cooling down · {remaining}s` (`:167`) + `cooldownCaption` (`:173-175`) + `retryInCooldown` (`:186`) | exclusive body |
| A6b | cooldown / daily cap | `Daily AI limit reached — resets {when}` (`:169`) + `CAP_CAPTION` (`:170-171`) + `retryWhenReset` (`:187`) | exclusive body |
| A7 | signed out | the sign-in gate | outer gate |
| A8 | add a key | eight non-collapsing powering reasons inside it | exclusive body |
| A10 | **request failure** (new) | `AI unavailable — try again` + its body (`ai-rec/copy.ts:51-52`); the previously pinned read stays pinned and readable | exclusive body |
| A5 | stale | in-body warning strip **with the icon** | composes over A3/A4 |
| A9 | full-analysis drawer | the drawer surface | composes over A3/A4 |
| A1c | **request-scope annex** over *produced (trade)* / *produced (no trade)* — no new canon name | the same `No fresh edge right now` note + caption + `Ask anyway`, rendered **in body beneath the read**, **beside a mounted verdict**, and **without** A1b's Mono `no_trade` line | composes over A3/A4 — the `no_edge` arm where `resultState ≠ null` |

**A6a and A6b are two render cases under one canon-16 name.** The architect proposed splitting them
into two peer rows; ux adopted the split; the architect then withdrew the *peer-row* form because ux's
own A8 already carries the right idiom (a body case whose non-collapse obligation lives **inside**
it), and ux agreed the canon's "nine" reads as nine **names**. Both lanes therefore land in the same
place and this spec states it once: one name, two render cases, each keyed on its own shipped
constants, and a build that renders a capped user a countdown red-builds. The substance is shipped and
non-synonymous — `presentationPolicy.ts:16-17` declares `cooldown` and `daily_cap` as two distinct
members, and `ai-rec/copy.ts` ships four non-synonymous pairs for them. It costs no new union member
and no new test idiom. (One correction carried in: the merged row said the case "names the wait in
Mono" — `cooldownLabel` names a wait, `capTitle` names a **reset time**, so one row could never have
been true of both.)
<!-- spire:council-resolution:v1 e955ae399c45374a067bf33c13554617184a829e0e358669136ceded4bfca89f folded -->
<!-- spire:council-resolution:v1 a4feb589178f1d3b7bee653641cfd24b3b7e6504c004341d46b1c1666a5fd41f folded -->

**A1 is two arms, because one marker could not tell two shipped states apart.** A panel showing
"Ready to read this snapshot" plus the composer rendered identically for plain idle and for
idle-with-a-quiet-gate-note, so a marker suite would have passed while certifying precisely the
collapse it exists to prevent. **Behaviour change, named rather than absorbed:** the shipped app
renders the gate as an early return **in place of** the composer and the primary action
(`AiRecPanelBlocks.tsx:205-224`), while the design source draws it as a footnote inside a still
complete idle panel. v2 adopts the drawn behaviour — on the lane's own grounds, not the drawing's
authority: `no_edge` is an **override**, not a wall (`ai-rec/copy.ts:89`: *"Override the quiet gate
and request a read anyway"*), and a state that hides the composer renders an override as a block.
**The gate note never wears the model's verdict:** `AiRecPanelBlocks.tsx:209` renders the literal
`no_trade` in Mono, and A4's verdict is `No trade` in Archivo display. Mono lowercase is Convexa's own
machine stance (canon rule 23); Archivo display is the model's verdict. The guardrails declining to
*ask* and the model answering *no trade* are two different claims and the register must hold them
apart. Idle's verdict slot stays empty (row 42).
<!-- spire:council-resolution:v1 8c0a5e9fe970842c2e197e9e14ddd2ddaa3f8ed724a8c048c1449c8d172c841e folded -->

#### The rule-16 amendment — **DELEGATED (P4)**

Canon 16 enumerates nine states, none of which is failure. So a provider timeout, a mid-flight key
rejection or a network error must render as *idle* — which asserts the user never asked — or as *no
trade* — which asserts an answer the model never gave. Both lie, and a count-shaped ship-blocking row
passes either way. This is the canon lagging the code, the shape owner ruling 3 already settled: the
copy **already ships** (`ai-rec/copy.ts:51-52`) and `presentationPolicy.ts:19` carries `unavailable`
as a shipped request state. The amendment:

- **Adds `request failure` as a named state.** The copy exists; this names it.
- **Records the composition clarification** that *stale*, the *full-analysis drawer* **and the quiet
  gate** compose over a produced read rather than being exclusive peers — the same clarification shape
  rule 18 took when the per-figure dot and the page chip were found to contradict rule 13 read
  literally. The quiet gate joins that list for a mechanical reason, not an aesthetic one: it is a
  **request-scope** condition and the request axis is computed independently of the result axis
  (§2.6).
- **Gives each of the three other homeless shipped states an explicit disposition** — an unmapped
  shipped state is the hole this ruling exists to close:

| shipped state | disposition | evidence for the mapping |
|---|---|---|
| `no_edge` (`presentationPolicy.ts:18`) | **Request-scope, not a peer body state.** Its disposition is a composition rule with two arms, and together they cover every pair it can appear in. **(i) `resultState === null` → A1b**, the *idle · quiet gate* body arm under the existing canon name *idle*. **(ii) `resultState ≠ null` → A1c**: the same gate note and `Ask anyway`, **composing over** the produced body (A3/A4), which stays present and readable (rows 58–59). It never occupies the verdict slot in either arm, and it never renders A1a's marker. | It is a **request** state, produced at `:125` from `readinessGateState === 'no_fresh_edge'` **regardless of `rec.status`**, while `resultState` is assigned independently at `:128-136` from `produced && rec.strategy` — `fresh_trade` at `:135`. So `(no_edge, fresh_trade)` is reachable and `resultState` is **not** `null`. `:168` already enables `askAnyway` on `requestState === 'no_edge'` alone — the shipped **policy** already puts the override control in this state whether or not a read is pinned; the **host** is what drops it, because `AiRecPanel.tsx:423` mounts `ActionRegion` — the note's only home (`AiRecPanelBlocks.tsx:205-224`) — only when `!producedRec`, while `:205,387-388` mount the produced card independently of the request axis. A1c is the render change that closes that hole. |
| `superseded_inputs` (`:25`) | **Mapped onto the named state *stale***, as a third non-synonymous member of the same in-body degraded strip. It renders `SUPERSEDED_STRIP` (`ai-rec/copy.ts:228-229`) and **never** `staleStrip`'s or `staleBornStrip`'s words. | It already ships this way: `DecisionCard.tsx:321-338` renders `stale_newer_snapshot`, `stale_at_generation` and `superseded_inputs` through **one** `data-testid="decision-degraded"` alert with **three different lines**, and `presentationPolicy.ts:138-142` groups all of them as `degraded`. The mapping is a description of shipped behaviour, not an invention. |
| `incomplete_trade` (`:26`) | **Mapped onto the named state *produced (trade)*** — it **is** a produced trade read that is not actionable as given. It renders the shipped standing line `incompleteAction` (`ai-rec/copy.ts:429-430`) in-body, offers no simulated entry, and **never** renders as *produced (no trade)* and never as *request failure*. | `presentationPolicy.ts:134` sets it only when `produced && decision === 'trade' && missingPositionFields.length > 0`; `:172` already suppresses `reviewTrade` for it; `DecisionCard.tsx:371-382` already renders its line **inside** the `isTrade` branch. |

**Correction carried in, because it is the kind of error this spec exists to prevent.** An earlier
draft of the row above dispositioned `no_edge` as an idle-only arm on the ground that it *"carries
`resultState: null` — so it lives inside the idle body phase by construction, not by choice."* **That
is false about the shipped function.** `deriveAiRecPresentation` assigns the two axes in two
independent statements (`:115-126` and `:128-136`); a user holding a produced, pinned trade whose
conditions have since tightened — the ordinary shape of *"the market moved after I got my read"* — is
in `(no_edge, fresh_trade)` today, and in that state the produced card renders exactly like an
ordinary fresh trade while the gate note never mounts at all. There is currently **no visible sign
anywhere on the desk** that the guardrails see no fresh edge. That is precisely the silent
fall-through P4 was ruled to close, and it is `[model-read-carries-its-assumptions]` failing on the
assumption that matters most.

Four consequences fall out of the two-arm disposition, stated here so the build lane does not
re-derive them:

- **A1c drops the Mono `no_trade` line** (`AiRecPanelBlocks.tsx:209`). That literal is the guardrails'
  stance standing in for a verdict that does not exist; where a real verdict **is** mounted, printing
  Convexa's machine `no_trade` beside the model's `Trade · {bias}` in Archivo display puts two
  competing stances at the top of one panel — the register collision canon rule 23 and row 42 exist to
  prevent. The note's title, caption and `Ask anyway` carry the whole meaning without it (row 59).
- **A1b and A1c are told apart by conjunction, never by the note.** Both render
  `No fresh edge right now`, so neither may be keyed on that string alone — row 33's second clause
  forbids identifying a case by a marker another reachable case also renders. **A1b** is *the note
  **and** the Mono `no_trade` stance line **and** no mounted verdict*; **A1c** is *the note **and** a
  mounted verdict **and** no Mono stance line*. Row 59 is what makes that discriminator hold, and it
  is why the Mono line is dropped by rule rather than by taste.
- **The re-ask control in this state is `Ask anyway`, not refresh and not retry.** `:177` requires
  `requestState === 'idle'`; `:169` is `(degraded && requestState === 'idle') || unavailableRetryGate`,
  which is **not** idle-only in general (corrected after S2 pass 2 — the earlier text said both were).
  Under `no_edge` both still resolve false **by construction**: `requestState` is not `'idle'`, and
  `unavailableRetryGate` needs `'unavailable'`, which the same `??` chain makes unreachable here. So a
  stale or superseded read under `no_edge` has `refresh: false` and `retry: false`, while `askAnyway`
  is true (`:168`). A1c
  therefore also supplies the recovery control that A5's strip would otherwise leave the user without.
  No policy change; one render change.
- **A1c cannot collide with A6a/A6b, A8, A10, A2 or A7.** `requestState` is a single assignment from
  one `??` chain, and `daily_cap` (`:123`) and `cooldown` (`:124`) are evaluated **before** `no_edge`
  (`:125`), so a capped or cooling-down user is never in `no_edge` at all. That is what makes rows 33
  and 36 checkable rather than aspirational.

`unavailable` — the fourth state the architect found — is the one that becomes **A10, request
failure**, above. All four are now dispositioned; none is folded silently; and the total mapping
function's `never` arm has a declared destination for every pair on §2.6's 15 × 7 grid, including
every pair `no_edge` participates in.
<!-- spire:council-resolution:v1 9e855edbc81d21917d695a63ea95739d7f4d17baf77f92ced4be5767c665cb7a folded -->

#### Rule 16's amber scope — **DELEGATED (P2): amber text, not amber pixels**

The literal reading — *no other amber pixel in the panel* — is **already unsatisfiable against canon
rule 6**, which requires an authored `:focus-visible` ring in text-grade amber; any focusable control
puts amber on screen. A reading that contradicts another canon rule cannot be the right one. The
evidence that the word "spend" is genuinely ambiguous rather than merely misapplied:
`design/src/screens/ai-read.mjs:140` draws a legend chip reading `amber spent once` **beside four
amber spends in the same file** (`:8` header icon tint, `:15` pinned-read provenance dot, `:67` the
`Thinking…` pulse, `:71` the spinner edge) — the author believed the rule held while breaking it.

**Rule 16 means: the verdict word is the only amber-rendered TEXT in the panel, in every state.**
Amber that is not text is limited to exactly two things, and the amendment names them so the list is
closed:

- the **focus ring** (rule 6 — a system-wide affordance, not a panel spend);
- the **in-flight progress indicator**, while a request is actually running. It qualifies on rule
  22's own logic (driven by a real request, stops when it resolves, disabled under reduced motion)
  and it is **mutually exclusive with the verdict word** — the panel never shows both.

The **header icon tint** and the **pinned-read provenance dot** are **defects**, regenerated out of
`design/` (`node design/src/build.mjs`); `design/` is a drawing, not authority. The dot becomes
`signal`, which the palette already reserves for links/info/live and explicitly describes as
"quieter than amber". Row 30 is the single unconditional criterion, with a colour census asserting the
list above is closed. This tension belongs in the canon's Amendments table as a clarification, in the
same shape as the rule 13 / rule 18 tension phase 1 recorded.
<!-- spire:council-resolution:v1 6b4274a28470981d635fb595c3fb07d1721971a9ae0c784c5d03a9d4cf4af8da folded -->

### 4.6 Copy — the exact strings

**Hero.** Basis line `levels are REST structure (as-of {age}) · the mid is tape`. Tape cell label
`Gamma flip · live` (live/drop) or `Gamma flip · session tape` (replay). Captions:
`live recompute · levels flip {structure flip}` (live), `offline · last known` (drop, latch
non-empty), `offline` (drop, latch empty), `session replay`. Trail caption on a drop:
`tape paused · trail frozen` when the trail holds samples, `tape paused` alone when it never drew —
the second arm exists so the caption never asserts a frozen trail that was never drawn, the same
two-arm discipline owner ruling 2 sets for values. Mid readout label: `Mid`, beside
`Structure ${structureMid}`.

**Live-tape widget subtitle** — three arms, two shipped and one new constant in the same module:
delivering → `Live stream · not the structure snapshot below` (`_kit/copy.ts:531`); offline with at
least one non-empty latch → `Stream offline · last known ticks · structure levels stay current`
(`:532-533`); offline with every latch empty → `Stream offline · no ticks retained · structure levels
stay current` (**new**). `LiveTape.tsx:110` selects on the stream flag alone today, so the retention
claim is made unconditionally on every drop.

**Ladder.** Level names unchanged: `Call wall`, `Put wall`, `Max pain`, `Gamma flip`, `Mid`. Anchor
named once in the header, e.g. `distance from levels @ {gex_spot}`. Absent value cell `—`; absent or
inapplicable distance cell `—`.

**Read strip.** Absent off-exchange slot: `not provided`. Off-exchange cell states it is context only
with no side. Term-structure slot: `unavailable` (object absent) / `—` (present, fewer than two
points) / the wire's `state` label (§2.4).

**AI read.** Verdicts `Trade · {bias}` / `No trade`. Gate note `No fresh edge right now` + *"The
guardrails don't see a fresh, actionable edge. You can still ask if you want a read — it counts
against your cooldown and daily limit."*, control `Ask anyway`. **A1c uses those same three strings
verbatim** — the annex over a produced read is the same note in a different position, not new copy,
and it drops only A1b's Mono `no_trade` line. Request failure
`AI unavailable — try again` + *"Couldn't get a read right now. This didn't affect the rest of the
dashboard."*. Cooldown `Cooling down · {remaining}s` / `Retry available in {remaining}s`. Cap
`Daily AI limit reached — resets {when}` / `Retry available when the daily limit resets {when}`.
Stale strips as shipped; superseded *"Your risk inputs changed after this read. The sizing below is
based on the earlier values."*; incomplete *"Not actionable as given. Never named: {labels}. Nothing
is saved until you review and confirm."*. No-trade `Re-engage when {conditions}`, primary = the
shipped refresh / re-ask control, secondary = full analysis.

**Design direction.** This feature applies the canon; it does not restate the token table.
It spends canon **13** (figure cell: state in the label row and the type register, container steps
20 → 17 → 15, the conditional `last known` clause), **14** (level ladder, the mid the only live row,
shared strokes), **15** (read strip as a deliberate rail of figure cells), **16** (verdict-first
brief), **17** (six bands, container queries, no horizontal overflow), **18** (one connection chip,
chip-scoped), **21** (panels are containers), **22** (liveness is gated), **23** (type register) and
**24** (the closed nine). It lands **four canon amendments**, each a correction of stale prose against
shipped code, each confined to its stated clause:

| rule | amendment | product behaviour? |
|---|---|---|
| 11 | the "vertical diverging" lock names a chart `chart.tsx:4` records as already replaced; the second clause — *"do not collapse mid + last-trade into a single price without an amendment"* — is kept **verbatim**, because the masthead redraw is precisely when that collapse gets proposed for space | none |
| 14 | *"distance from **mid**"* → *"distance from the levels anchor (`gex_spot ?? price`), stated once in the ladder header"*; *"the mid is the **only** live row"* and the shared-stroke clause kept **verbatim** — **DELEGATED (P3)** | none |
| 16 | amber scope (P2) + `request failure`, the composition clarification (now including the quiet gate) and the three dispositions (P4) — **DELEGATED** | rows 30, 32–36, 41–43, 58, 59 |
| 17 | tense only — 834 has landed | none |

Rule 14 is amended for the same reason rule 11 is: stale prose naming something the code does not do
either red-flags correct code at GATE Q or pushes a lane to "fix" it — and here the "fix" is worse
than cosmetic, because re-anchoring the column on the live mid makes all five rows live and breaks
the same rule two clauses later. **Four amendments is enough churn that the skeptic should check none
of them widens beyond its stated clause.**
<!-- spire:council-resolution:v1 76e8043d9262314647ab1780d64eb71a0091ea07c2fd50d549c707ef121e2e06 folded -->

**Light-mode parity — DELEGATED (P5, In), rows 52 and 53.** The AC set's only scheme-differentiated
obligation checks **overflow alone**, so a build could satisfy every "both schemes" row while the hero
renders as a dark plate inside a light desk — and the wide bands run dark-only by documented decision,
so **nothing** in the suite would see it. Scoping it out means it ships broken *and* invisible, the
combination this system exists to prevent. `[theme-token-discipline]` is in the BRIEF's own invariant
watch (*"zero hardcoded hex; mode-aware values only through `extrasFor(theme)` / `elevationFor(theme)`"*),
and the fix is a theme input on an edit §2.7 is already making, not a new surface.
<!-- spire:council-resolution:v1 9cbb4882c66e879d699abf6b2770ce1f46d9ea995892016c4e4cfe79ee431d6b folded -->

## 5. Error handling

- **Cold start is the only blank screen.** A post-success poll failure keeps the whole desk behind the
  soft warning, unchanged.
- **A canvas fault does not take the ladder.** An inner `ErrorBoundary` wraps the canvas region only,
  so a field throw degrades to a static message while the ladder, the tape row and the path keep
  rendering. The ladder is REST-only and shares no failure mode with the paint path, and the five
  levels are the phase's most load-bearing readout. Cost: two boundaries in one panel.
- **Each of the five ladder rows is independently nullable** (`[best-effort-isolated-or-null]`): a
  null level renders `—`, never `$—`, never `0`, and **never a dropped row** — dropping a row changes
  the row count and silently breaks "sorted by price" as a reading.
- **Each of the eight read-strip cells is independently nullable**, and the slot count does not move.
- **A stream drop never blanks and never zeroes.** Latched value at 50% opacity with the pause mark
  where the latch holds one; the bare member with the pause mark and **no** "last known" words where
  it does not. It never dims a structure figure, and it never makes the AI read stale.
- **A stream that is up but carries no mid makes no live claim** (§2.1). It is not an error state; it
  is the absence of a fact, and it renders as such.
- **AI-read failure is isolated.** The brief failing, cooling down, being capped or having no key
  changes nothing about the structure, the tape, the strip or the band. A request failure renders
  A10, keeps any previously pinned read pinned and readable, and is never rendered as idle or as a
  no-trade verdict.
- **A closed readiness gate is not an error and never hides a read.** `no_edge` renders the quiet-gate
  note — as the A1b body when nothing is produced, as the A1c annex beneath a produced read — and in
  neither arm does it blank, replace or dim the read (§4.5, rows 58–59).
- **Auth-class outcomes are not AI-class outcomes.** A 403/503 on the recommendation POST surfaces
  the sign-in / couldn't-reach prompt, never the cooldown, cap or no-key states.
- **Nothing is partially applied.** The stroke table, the `hex-discipline` exemption entry and the
  canvas literals move in **one** change: deleting the literals while the exemption entry stays fails
  the live-exemption test, and that failure is the intended coupling, not a surprise.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/curvature-v2-desk-and-read/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** this phase is **`NO_BACKEND_CHANGE`** — the `apps/api` diff is
empty (row 55) and no endpoint, payload field, query parameter, route, persistence shape, score input
or streaming behaviour changes. It consumes **four** existing surfaces unchanged: `GET
/api/ticker/{ticker}` (the levels, the read strip's eight figures, the AI read's anchors), `GET
/api/recommendation/status/{ticker}` (the gate, cap and availability facts behind the AI read's
request states), `POST /api/recommendation/{ticker}` (the read itself — session-bound and mutating,
so deliberately **not** pinned in the conformance block; that file says why) and `GET /api/stream`
(SSE, the tape — not machine-checkable, the runner does not read event streams). The authoritative
field list and the machine-checkable conformance block live in that file and are **not** restated
here. The quiet-gate annex §4.5 adds consumes **no new wire field**: `gate.state` — already pinned in
that file — is the fact behind `readinessGateState === 'no_fresh_edge'`, so the conformance block is
unchanged by it.

## 7. Testing strategy

Risk-based: automate what regresses silently and invisibly; verify visible or cosmetic behaviour by
review.

**Tiers.** Unit/component (jsdom, Vitest) for render cases, copy selection, the latch and the
mapping's exhaustiveness. Integration mocks **the network boundary only** — the bundle fetch, the rec
status/POST and the SSE source — never a component. Browser (Playwright) for overflow, container
stepping, colour scheme and reduce-motion.

**Invariants that must never silently regress:**

1. **One liveness claim predicate.** Compile-time: the branded type on every claim prop, proven with
   `@ts-expect-error` on a raw-boolean call site — **TS2578 fires the day the brand is removed**,
   never a runtime `expect`. Plus a mutation-guarded source scan keeping `genuineIsLive` and the
   store's `isLive` out of presentational desk files.
2. **The retention latch's two arms**, and that a latched value is not re-flashed.
3. **The read strip's eight fixed slots** and the closed-vocabulary member in an empty one.
4. **The ladder's five-row closure** — a sixth row is a compile error via the closed union and an
   exhaustive switch with a `never` arm.
5. **The AI-read mapping is total over the *pair*** — exhaustive switches with `never` arms on **both**
   axes (§2.6), so a sixteenth request state or a seventh result state is a compile error, not a
   fall-through to idle. Runtime companion: a fixture at `(no_edge, fresh_trade)` proving the produced
   read **and** the annex both render (rows 58–59). A compile-time `never` arm alone cannot catch a
   pair whose destination was written down wrongly, which is how the earlier `no_edge` disposition
   survived a whole council round.
6. **AI-read cases do not collapse** — assert the literals that must *not* appear across paired
   states (the `BrokerGroupHeader.spec.tsx:193-194` idiom), never a tally.
7. **No horizontal overflow**, proved by the suite's **executed** case list.
8. **The design mirror actually covers v2** — `design/src/verify-tokens.mjs` extended to set-equality
   on the `additions` block plus per-value equality against `tokens.ts`; changing `steel2` on one side
   only must exit non-zero.

**How the motion rule actually bites — and what it still cannot see.** Adding a name to
`single-motion-moment.spec.ts`'s allowlist closes neither hole:

- The spec's inventory is built from `namedKeyframesIn` (`:54-55`), which matches only **literal**
  `@keyframes <name>` text, and compared set-equal against `KEPT_KEYFRAMES` (`:36-43`). **A Canvas2D
  rAF loop declares no keyframe at all**, so `TapePulseStrip`'s trail and `StructureFieldCanvas`'s
  drift, sweep and particles are invisible to the entire spec. Enforcement for them is the
  **extracted pure paint step** (§2.1, and this is the phase's largest single mechanical cost — a
  460-line rAF closure holding cross-frame mutable state must move into an explicit frame-state
  object): drive `(model, ctx, now, reduced)` against a **recording fake 2D context** and assert that
  `live: false` yields zero trail points, zero particle `arc()` calls, zero sweep gradient fills and
  non-zero level strokes, and that `reduced: true` yields the same. If that extraction is dropped for
  budget, criterion 20 becomes `review` — it does not become a `test` mark on something no harness
  can see.
- `useFlashOnChange.ts:71-74` mints a **dynamic** `@keyframes flash-{tone}-{id}` name inside `sx`.
  `:58`'s `declaresDynamicKeyframes` only detects *that* a file does this and gates it to the single
  allowed home (`:47`), so the family's names can never enter the literal inventory and the
  live-stream/reduced-motion predicate the spec applies **by name** cannot reach them. Enforcement is
  behavioural, on the hook itself: with `active: false` or reduced motion, no flash state is
  produced (`useFlashOnChange.ts:45`), and the latch test in invariant 2 covers the retained-value
  path.
- What the allowlist **does** still catch is a **new named** keyframe. Non-goal: this phase adds
  zero, and the set-equality assertion is what proves it.

**Two execution traps that make a green suite lie**, both live here: `playwright.config.ts` is an
explicit `testMatch` allowlist — an unregistered spec **never runs and reports green**, so execution
is proved with `--list`; and e2e runs against the **production build**, never the dev server, after
`npm run ports:free` on both address families.

**`no-overflow.spec.ts:398` uses `page.getByText('Call wall').first()` as the readiness anchor for
`/ticker/TSLA` at every width**, and this phase deletes the component that renders that text today.
The ladder keeps the exact words (criterion 2), so the anchor survives — **deliberately, not by
luck.** A rename reds roughly twelve e2e cases for a reason nobody will connect to a copy change.

Reviewed rather than automated: copy wording, ordering and presence (criteria 4, 6, 11, 21, 22, 40,
46, 51, 52, 57) — pinning those strings in assertions buys nothing a reviewer does not already give,
and container stepping is not observable in jsdom at all.

## 8. Guardrails this feature must not break

From the BRIEF's invariant watch, plus the promoted canon this phase touches:

- **`[live-vs-static-isolation]`** (ledger key `one-liveness-predicate`) — the ladder's mid is the
  only live row; the trail is live and the structure path is the slow lane; the strip is entirely
  snapshot; the quiet band never wears a live mark and never feeds the score.
- **`[absent-is-not-none]`** — the closed **nine**, distinct, never synonyms, 15px Sans, never a
  figure; no tenth member.
- **`[ai-asserted-numbers-are-traceable]`** — authorship in the type register, never in colour;
  counts and the cited contract live in the drawer.
- **`[model-read-carries-its-assumptions]`** — the brief carries its snapshot as-of and persona; the
  quiet band carries its own basis and as-of; **and a read the guardrails no longer back carries that
  fact on its face** (A1c, row 58) rather than reading as an ordinary fresh trade.
- **`[single-motion-moment]`** — the hero curve-draw stays the one orchestrated moment; every desk
  animation qualifies only as a **data signal** (genuinely live stream, stops on drop, fully disabled
  under `prefers-reduced-motion`). Zero new `@keyframes` names.
- **`[theme-token-discipline]`** — zero hardcoded hex; mode-aware values only via `extrasFor(theme)`
  / `elevationFor(theme)`.
- **`[single-shared-sim-entry-dialog]`** + **`[no-real-order-path]`** — one `TradeEntryDialog` as a
  variant, never a fork; nothing reaches a real order path.
- **`[additive-keeps-score-byte-identical]`** — FE-only; nothing here is a scoring input.
- **`[dark-pool-context-only]`** · **`[digested-labels-not-raw-dump]`** ·
  **`[best-effort-isolated-or-null]`**.
- **`[structural-over-prose-enforcement]`** — every rule this phase lands ships as a guard that goes
  red when poisoned, and each poison proof is itself proven non-vacuous (phase 1 shipped two
  `expect(true).toBe(true)` bodies under a "MUTATION PROOF" heading).
- **`[cited-code-is-verified-not-assumed]`** — a wrong path is a false citation even when the
  substance holds. Two are corrected in this spec: the levels-anchor comment is `ai-rec/copy.ts:318`,
  **not** `_kit/copy.ts:318` (which is `mcMomentumLine`/RSI); and the canvas `aria-label` source is
  `design/src/lib.mjs:296`, **not** `:293`. The same rule applies to citing *behaviour*: §4.5's
  earlier `no_edge` disposition cited real line numbers around a claim the function does not make,
  which passed a citation check and still described the wrong code.
- **`[loss-free-durable-migration]` — declared not engaged.** No new durable client key. If a hero
  view-mode preference were persisted it *would* engage, so that preference stays ephemeral component
  state.

## 9. Open questions

1. **The level-absence member is a DELEGATED call — D-14, the sixth.** pm's R3 §10 names
   `not provided`; ux's R3 §11 names `—`. Both agree on everything else (one member for all five
   level absences, chosen by a rule the frontend can evaluate, with the discriminator booked as debt).
   `decisions.md` settled the *one member* rule but **not which member**, so this was **not** settled
   by the file:line technical-conflict process that resolved the other sixteen conflicts in
   `decisions.md` §2 — it was taken by the R4 synthesizer under the same written delegation as P1–P5
   and recorded as a real call in `state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md`
   §*"Decided at R4"* / D-14. §4.3 resolves it to **`—`** on shipped precedent
   (`dealer-positioning/DealerPositioning.tsx:109,117,157`) and minimum claim (`not provided` means
   "the feed did not send it", which is false for a present-and-null level, and this wire permits
   present-and-null). Row 5 carries the tag. Reversing it is one constant and one row.
2. **The six delegated calls (P1–P5 and D-14) are the conductor's, not the owner's.** They are binding
   for this spec and **reversible by a sentence until the build lane starts**; each is restated in
   `state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md`. Reversing any of them is a spec
   edit, not a rebuild.
3. **Widening the wide overflow bands to two schemes is available to the owner and was not taken.**
   It is a deliberate reversal of `no-overflow.spec.ts:43-45` with a runtime cost (three widths × the
   manifest's per-route walk) and belongs in the build report as a change to the suite's design.
   Nothing in this phase's value depends on it, and `DESIGN_SYSTEM.md:172` already answers it.
4. **The undeclared `tooltip` z-rung is still undeclared.** MUI's `Tooltip` defaults to **1500**,
   above every declared v2 rung (nav 20 · scrim 29 · sheet 30 · popover 35 · dialog 40 · toast 50).
   This phase puts `AccessibleHelp` tooltips inside a bottom sheet at rung 30 and inside the expand
   dialog at 40, where 1500 renders above both — which is the behaviour we want, so the gap is
   **benign here**. It still wants declaring, and it is not this phase's blocker.
5. **`hex-discipline.spec.ts`'s canvas exemption is invalidated by §2.7 and must be removed in the
   same change.** This is a known coupling, not an open design question, but it is the most likely
   place a partially-applied edit lands, so it is named where a later session will look.
6. **`cooldown` and `daily_cap` over a pinned read: render unchanged this phase — DELEGATED (D-15).**
   Pass 1 of this spec narrated this as an open question. The skeptic's pass-2 review judged that
   framing insufficient — "same defect, different name" — because declaring a rendering *unchanged*
   **is** a decision, and an undisclosed one is exactly what the DELEGATED marking exists to prevent.
   It is therefore disclosed here as the **seventh** conductor call, not as an open item.
   These two are structurally the same shape as `no_edge`: Both are reachable with `resultState ≠ null` (`presentationPolicy.ts:123-124`
   do not read `rec.status`), and the shipped host renders neither: `AiRecPanel.tsx:423` gates
   `ActionRegion` on `!producedRec`, and `:186-196` puts the panel in phase `produced`/`no_trade`
   rather than `unavailable`, so a cooling-down or capped user reading a pinned trade sees **no**
   countdown and **no** cap notice anywhere in the panel body. §2.6's table declares that rendering
   **unchanged** for this phase, so the mapping is total and no build lane has to invent behaviour —
   but the question of whether it *should* change is open. The distinction this spec relies on to
   treat `no_edge` differently: `no_edge` is a claim about **the market the pinned read describes**
   and therefore qualifies the read itself, while a cooldown or a cap is a claim about the **request
   budget** and qualifies only the next ask. P4's obligation named `no_edge`, `superseded_inputs` and
   `incomplete_trade`; it did not name these, and no voice argued them. **The ruling: unchanged
   this phase**, on that distinction — a budget claim does not qualify what the pinned read asserts,
   so nothing in the read becomes untrue while a cooldown runs. **Reverse it by** saying so: the
   annex mechanism (A1c) already exists and the change is one more row in §2.6's table plus one
   acceptance criterion — not a rebuild.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"a4100aa2cb7bb692e152d140b40299fd1a5061c76a6edddc013e94ae6b111bc8","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"aceb88547f1c7fa4c2e747d7b93124f584004111b1d599fb074bb861e828dc1c","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"e955ae399c45374a067bf33c13554617184a829e0e358669136ceded4bfca89f","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":3,"conflict_id":"ea59389db41e25a65375ed5e66472d588b0d4b170d3073df03fe27ff557238fd","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":4,"conflict_id":"c8501479224a1c6c07579ce281f098ab0b5500da2bb6c30161a774ae9b0841dc","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":5,"conflict_id":"a0f5ddca890f921c7283b7a0bb74c53998fda7b9ea4bc6e21b12c3c1ec1cce2f","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":6,"conflict_id":"bb0e7c4521b3c8ce39c3b39d2f0bd2bf4f0ffe51b31e6999e316cd01c893dad3","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":7,"conflict_id":"d43b5ffdabe7099fd4937f4aeeaaf35a111acba3a4770a3494a7b0770907dca4","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":8,"conflict_id":"9923b1d9a01690c4f8d6d91fd0e0fabe28b820d7a95b669ee9ad6b97bf90902f","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":9,"conflict_id":"bbd9e6aaa6d596150801c2775312747cb0367c7d760028657d60c31885ac5ab0","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":0,"conflict_id":"98909d6a382f6054a3ce8d7655ddd4302f25b66e835b3e878cbac8d9aa87977a","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":1,"conflict_id":"f4ad38a8ffd46134368808e9313925e4d751839c047d7884ad7ba213cde9307f","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"3a3afe31fdc8257cc903db81fc55d46b48a2930aa77c06db00ec76774cfb9592","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":3,"conflict_id":"1cdbe12fb5f5282288d1682a22624af6becf43f282fd963a30d78d3c21d62225","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":4,"conflict_id":"6b4274a28470981d635fb595c3fb07d1721971a9ae0c784c5d03a9d4cf4af8da","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":5,"conflict_id":"c244d9322e8506f5f8aeada6d30e21d42cd5b99ea36d4d90a69f62a69533348a","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":6,"conflict_id":"a6439a93398104149a98f91b4fe6d857b91421fa05e503783a36cd54ebff130f","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":7,"conflict_id":"8c0a5e9fe970842c2e197e9e14ddd2ddaa3f8ed724a8c048c1449c8d172c841e","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":8,"conflict_id":"a79ca8bc02f3a9246704aeb007ad13a1a5cff4494b4cb6af55d7a0439e3bdc72","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":0,"conflict_id":"2e37b9d89c44cf98a84f89aa82f365bfc61fb66ebdabef3e004cf675be129c47","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":1,"conflict_id":"76e8043d9262314647ab1780d64eb71a0091ea07c2fd50d549c707ef121e2e06","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":2,"conflict_id":"6d672404065db32db8b7cc93b0fc40426ed0bf5f4077b91b5edcbcfc09361cbc","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":3,"conflict_id":"238b1c70b41701e272f5759c9bf49b284eb02d8a3f48c927a1fec2083140e330","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":4,"conflict_id":"9fd66af16ac8179486f4303b74e9c324f1ac48c5f5f0eeaa90fe56c991dca98c","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":5,"conflict_id":"9e855edbc81d21917d695a63ea95739d7f4d17baf77f92ced4be5767c665cb7a","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":6,"conflict_id":"9cbb4882c66e879d699abf6b2770ce1f46d9ea995892016c4e4cfe79ee431d6b","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":7,"conflict_id":"e005d715e9e7e5bee7c6250abc6c4dd3b2ae11e87b0abe2cabb657a5005bfd25","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":8,"conflict_id":"a5896ba42ede2d83940fad754a8c1f8eb9ce87c21431b819216768559af63b04","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":9,"conflict_id":"8501eb0fc07b63787479eb9e4707f47f6b3288d798ba64c4ccd297c235edba3d","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":10,"conflict_id":"a4feb589178f1d3b7bee653641cfd24b3b7e6504c004341d46b1c1666a5fd41f","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":11,"conflict_id":"d55d1d188499f798c1a94c8e5e3ca9fa45afc75201ac0cffd205bed5c66748e4","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":12,"conflict_id":"2c5bd4ed7c96010920f93f67f1ece3c75f928c2b23b5a53c9dc703c50569abae","disposition":"folded","section":"§3"}]}
-->
