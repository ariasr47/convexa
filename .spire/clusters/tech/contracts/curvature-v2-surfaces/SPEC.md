# curvature-v2-surfaces — spec

**Source brief:** .spire/clusters/tech/contracts/curvature-v2-surfaces/BRIEF.md
**Council:** R1 positions · R2 critiques · R3 resolutions · decisions.md   (under council/)
**Status:** draft

> **Provenance markings — four OWNER rulings, one CONDUCTOR call, and nothing else is a "call".**
> Four product questions were surfaced to the owner one at a time and ruled on 2026-09-06:
> **D-A** (scanner price liveness → **A**), **D-B** (settings section navigation → **OUT, phase 4**),
> **D-C** (widget-frame ⓘ as a focusable control → **IN**), **D-D** (register of a user-entered number
> → **TRACED**). One further call was taken by the **conductor** and is reversible: the hover-only
> positions literal tips are repaired **IN** this phase (`council/decisions.md` §3 #3). Every criterion
> that depends on one of these carries **OWNER** or **CONDUCTOR** on the row itself, so GATE Q and the
> ledger can tell a ruled call from a converged technical resolution. Untagged rows come from the
> eleven technical conflicts the three voices settled at `file:line`, from the seven self-revisions, or
> from the BRIEF's invariant watch. Phase-1's eight owner rulings still bind, and **ruling 6 assigns
> this phase its quiet-band work by name**.

## 1. Goal + scope

Carry Curvature Terminal v2 onto the four remaining product surfaces — **scanner · positions ·
settings · alerts** — and convert the **eight ticker quiet-band widgets** phase 1 deliberately left
hand-rolled, so that the **type register** (Mono = traced to Convexa's own computation *or to a record
the trader entered*; Plex Sans + dotted rule = asserted but untraced), the **closed nine-member
not-a-number vocabulary** and the **one liveness answer** become properties of the **app** rather than
properties of the ticker desk. It is for the trader who spends the other half of the session off the
desk — triaging the universe, watching an open book, arming a rule, setting a preference — and who
must never mistake a snapshot for live, an absent value for a zero, or the model's number for
Convexa's. Frontend-only: the `apps/api` diff is **empty measured three-dot** and
`opportunity_score` / `opportunity_tier` / `state_fingerprint` stay byte-identical.

**Decision impact, corrected against what the council read at source.** Today the register rule is
enforced **only on the ticker desk**: these four surfaces have **zero** figure primitive between them,
and so do the eight quiet-band widgets — which **corrects phase 2's brief**, whose claim that the band
"already consumes `FigureCell` from phase 1" is false (`MarketContext.tsx:440` states the true
position). Three of the BRIEF's own framings are corrected here and do not survive into scope:

- **The scanner is not a snapshot surface.** It runs a real price SSE (`useLivePrices.ts:39-57`) and
  ships a page-level prose liveness claim (`labels.ts:25`). All three voices falsified the BRIEF's
  "Scanner rows and positions rows are **snapshot** surfaces" as an absolute. Liveness is per **datum**
  — and on the scanner, per **D-A**, no datum may claim it this phase.
- **Settings has no rail to collapse.** `SettingsPage.tsx:156` is a 640px centred column of five
  stacked panels. "Brought under the same responsive discipline" sizes construction as a media query;
  that wording does **not** survive into this SPEC (**OWNER — D-B**).
- **The Broker tab is not a separate surface.** `PortfolioPanel.tsx:22,176` mounts `BrokerTabPanel`
  as the second tab of `/positions`, so it is inside the phase by the BRIEF's own naming.

Observed when: every figure on the four surfaces and in the eight widgets declares its register at its
call site and resolves register, liveness and absence through the **one shared decision module**; the
positions surface asserts its three closed-nine members **non-synonymous** against the shipped testids;
the eight widgets' figures step against their **own** named panel container, proven by a rendered
assertion; and the no-overflow suite stays green at **393 in both schemes, 834 / 900 / 1280 in one**
against **seeded, non-empty** pages.

**In scope**

- **The shared figure-state module** (§2.1) — the whole F1–F9 branch extracted to `shared/figure/`,
  consumed by `FigureCell`, the scanner atoms and the positions row cells.
- **Scanner** — register + closed nine on every figure in **both** layouts; the degraded price arm
  (retained value, stroke pause mark, `offline · last known`); the flash gated on the stream; the
  cadence header reworded (**OWNER — D-A**).
- **Positions (sim book + Broker tab + header readout)** — register on every figure; the three-way
  non-synonymy asserted as three facts; the offline contract on the six live-derived cells; the Net P/L
  readout's five states; one register inversion removed; the literal tips made keyboard-reachable
  (**CONDUCTOR**).
- **Settings** — register + `not set`; the declared scales; neutral confirmation chrome; the
  browser-only persistence claim; five sections reachable at every checked width (**OWNER — D-B**).
- **Alerts** — closed-lookup labels; no fabricated threshold; thresholds rendered by type (47a–47d);
  unread state off the coloured edge; the honesty and durable disclosures; the **read-fault latch** on
  `convexa.alerts.v1`.
- **The eight quiet-band widgets** — register enforcement and container steps, converted **in place**
  (ruling 6's layout freeze stands); the two mono-run widgets split **by figure, not by widget**.
- **The `Widget` frame's ⓘ** becomes a focusable control at all seven live `info=` sites; **the ticker
  desk is reopened for this single shared-frame change and nothing else** (**OWNER — D-C**).
  <!-- spire:council-resolution:v1 db0bcfc326c947b21aaabf909014cb358d08993e3ee249ce6912f7470d0d4849 folded -->
- **Widening the liveness fence** — `liveClaim.spec.ts:68-80`'s glob reaches the four surfaces with
  explicit EXEMPT entries, and `PositionsPage.tsx:88`'s banned `genuineIsLive` is replaced. Independent
  of D-A and IN either way.

**Out of scope**

- **Settings section navigation (rail ≥900 → horizontal control <900) — OUT, phase 4** (**OWNER —
  D-B**). Settings ships its single 640px column this phase; its figures convert and its panels adopt
  the declared scales, nothing else. pm rows 37/38 and ux U-17/U-18 are **withdrawn**. Carried debt,
  dated, with the canvas citation `design/src/screens/settings.mjs:1,5,15,28-31`: phase 4's GATE I must
  answer three behaviours before build — active item on click vs scroll-spy, deep-link landing below
  900, focus order — plus the 44px floor on the horizontal strip. **One copy hazard travels with the
  debt:** the canvas footnote `Saved to your account.` (`settings.mjs:30`) is **false** for
  `convexa.uiprefs.v1` (`localPrefs.ts:15`) and must not be imported (criterion 39).
  <!-- spire:council-resolution:v1 fac0c6c7cb9d520bed8cd172d20621a41cbb9dc6c8e403c6fa76d7361bf13303 folded -->
  <!-- spire:council-resolution:v1 faf6bdeea68ca330fb0ec69ddc959c2f2cde9b33d1c27fd1c60ffa42b27d3996 folded -->
  <!-- spire:council-resolution:v1 ae1248895375efba2db214ba22c43a8a3b6fed751d82b839e0ac8e8416d392a9 folded -->
- **Re-labelling alert history — carried debt.** Every stored `AlertEvent` holds a pre-rendered
  `message` and no `level` / `scoreMin` (`types.ts:32`), and `evaluate.ts:83` baked `rule.scoreMin ?? 60`
  into durable strings for rules whose records hold no minimum. Repair needs additive fields on the
  durable shape; it is **not chosen**. Pre-phase event strings are legacy content
  (`types.ts:32`, `AlertsPage.tsx:225`), and **the Recent list may not claim history was re-labelled**.
- **`TermHeatChart.tsx:105-106` — an explicit non-goal, cited.** It paints
  `${p.atm_iv.toFixed(1)}%` onto a canvas with a hard-coded `'600 10px "IBM Plex Mono"'`. No
  `data-figure-register` and no DOM assertion can reach it, so it is named here rather than left to
  read green under a register criterion that cannot see it.
- **Per-symbol live marks on `/scanner` — carried debt, dated** (**OWNER — D-A**), against the phase
  that adds `market_session` and a `live` flag to `/api/stream/prices`. Until then the scanner's
  branded predicate can only produce `NOT_LIVE`.
- **No broker DATA work.** No `/api/broker/*` change, no new broker network call, and **no change to
  the deliberate `NOT_RECORDED → NOT_PROVIDED` per-surface substitution** that `notANumber.ts:15-16`
  records as by design. The Broker tab's **figures** are in scope for register enforcement and for the
  non-synonymy assertion; its data is not.
  <!-- spire:council-resolution:v1 8ba032e3b5182d3fa9d37d5366463a8d5c744786ac49def808a374f5b53e9d7b folded -->
  <!-- spire:council-resolution:v1 a3216467da2136193323c885d477a9bffcd78fe6c5f36e06e99ab31835e60339 folded -->
- **The `⚠` glyph in the scanner status chips stays.** ux withdrew U-7 at source: the canon's Icons row
  names exactly **two** typographic truth marks (the pause mark on an offline figure, the ring on a
  closed/replay chip) and `⚠` is neither; rule 5 requires *warning + icon always*, and `labels.ts:196`
  records the glyph as the deliberate mechanism for it. `'⚠ Stale'` (`:205`) and `'⚠ Error'` (`:211`)
  are byte-identical after this phase. The question it raises — does the Icons row's colour-emoji clause
  reach `U+26A0` in a chip label? — is filed for the owner as an **Amendments** line, not asserted here
  (§9 item 3). ux's U-11 (no `⏸` character on positions) is unaffected and stands as criterion 29.
  <!-- spire:council-resolution:v1 7374669048f7e8a04a8ce276b1bef3c6ee9589dd0c558862cec0f93d8c0955cd folded -->
- Landing, blog, site, methodology and lab pages; the responsive sweep (including the scanner's
  five-band column set and any move of its table→cards threshold); the structure field's point-by-point
  curve text-equivalent; the spacing-exemption remainder — **all phase 4**.
- Any backend change, any new wire field, any new SSE event, **any new durable client key or shape**,
  any real order path, any score/tier/fingerprint change, any alerts server sync.
- Any **tenth** not-a-number member. A tenth is an Amendments event (owner ruling 3).
- Re-composing any of the eight quiet-band widgets. Ruling 6's layout freeze stands; only the *reason*
  for it was corrected.

**Future (deliberately deferred), each booked in `BUILD_REPORT.md` with `file:line` and a phase**

- Per-symbol live marks on `/scanner` — the phase that adds session fields to `/api/stream/prices`.
- Alert-history re-labelling as an **additive**, read-new-else-old shape change with `message` retained
  as fallback and a fixture authored from a pre-phase blob.
- Settings section navigation — phase 4, with the three behaviours named above.
- The scanner's five-band responsive column set and the positions table's laptop column drop — phase 4.
- Server-owned alerts (multi-device sync) — post-go-live track, not a Curvature phase.
- Broker tab real data — the `broker-connect` track.

## 2. Architecture

### 2.1 The one shared figure-state decision — `shared/figure/`

This is the phase's central mechanism and its single point of failure. `FigureCell` is **not a value
renderer, it is a card**: `FigureCell.tsx:72-106` styles `CellCard` with `overflow: 'hidden'` (`:77`)
and a hover `translateY(-2px)` (`:94-101`), and `:302-329` renders a label row, a body and a caption
row with `AccessibleHelp` — a real focusable `button` (`:26-28`) — mounted at `:307`. Two shipped
structures refuse that shape: `ScanCard.tsx:54-59` makes the **entire** card one anchor
(`component={RouterLink}`), pinned by `no-overflow.spec.ts:938`, so a focusable button inside it is
interactive content nested in a link; and in the table the **column header already IS rule 13's label
row** (`ScanTable.tsx:107-145`), so a per-cell card would repeat every label eleven times a row and
clip the sticky first column.

**Therefore the decision travels, not the component.**

- **Placement.** `shared/figure/figureState.ts` (pure, no JSX) plus `shared/figure/FigureMarks.tsx`.
  **Not** under `pages/ticker/widgets/_kit/`: `features/trading/positions/` importing from `pages/`
  inverts the repo's binding dependency direction, recorded twice in shipped code at
  `notANumber.ts:18-23` and `liveClaim.ts:9-14`.
- **Scope: the WHOLE F1–F9 branch** (`FigureCell.tsx:250-300`), not the register/vocabulary
  sub-branch. Rule 13 puts the rest of the state in the cell — the label-row dot, the pause marker and
  the conditional `offline · last known` clause, computed at `:257-278` from `offline.retained`. If the
  extraction ships register-only, the scanner's degraded arm has **no host**: `Scanner.tsx:144` swaps
  one header string, `ScanTableProps` and `ScanCardProps` take no offline input, and `labels.ts:30-32`
  keeps promising *"the figures stay, dimmed, and say why"* against nothing rendering it.
- **Signature, signed by both lanes:**
  `figureStateOf({ value, register, live, offline, replay, caption, assertedBy }) → { figureState, isLiteral, mono, isFigure, dim, untraced, showDot, showPause, caption }`.
  `dim` (`:266,275`) and `untraced` (`:294`) are included deliberately — without `dim` the scanner's
  retained arm has no reduced-emphasis output at all. `figureState` is one of the nine shipped names
  (`default · loading · live · offline-retained · offline-bare · replay · empty · unavailable ·
  untraced`), and the captions are the **shipped strings verbatim**, not re-authored:
  `offline · last known` (`:262`), `offline` (`:271`), `session replay` (`:282`),
  `${assertedBy} · untraced` (`:293`).
- **`live` keeps the `LiveClaim` brand** (`FigureCell.tsx:171`, `liveClaim.ts:23-29`), so the
  extraction is not a back door around the one-mint rule. A scanner caller holds no `LiveUpdate` and
  can pass only `NOT_LIVE`.
- **The two marks move out.** `PauseMark` (`:154-156`) and `LiveDot` (`:130-149`) are module-private
  today — the file exports only `:158`, `:238`, `:339`, `:355` — so the stroke pause icon is genuinely
  unreachable outside the primitive. They become named exports of `shared/figure/FigureMarks.tsx` and
  `FigureCell` imports them back. Criteria 12, 27a, 27b, 28, 29 and 35e depend on this landing.
- **Consumers:** `FigureCell` (`:238`), the `ScanCells` atoms (`:51,68,82,98,161,178,218`),
  `PositionRow.cellContent` (`PositionRow.tsx:191`). The positions header readout
  (`PositionsPage.tsx:177-195`) is panel-shaped, has no anchor ancestor, and keeps **`FigureCell`
  itself**.
- **`data-figure-state` emission, with its co-location caveat.** Every consumer emits it on the element
  wrapping the value. `FigureCell` keeps it on the **card root** (`:303`) so the nine shipped specs keyed
  on it are untouched; the atoms and cells emit it on **their own node** (e.g. `cell-price`,
  `ScanCells.tsx:71-77`). On `FigureCell` the state attribute sits on the card and the register
  attribute on the value (`:303` vs `:212`); on the atoms both sit on one element. **An assertion must
  query state at the cell testid and must never assume co-location with `data-figure-register`.**
- **Chrome does not travel.** No `CellCard`; **no second label row**; **no nested focusable button**
  inside `ScanCard`'s single anchor — the scanner passes no `info`, keeps `focusableHelp={false}`
  (`ScanCard.tsx:107`) and keeps its shipped tip and `aria-describedby`
  (`ScanCells.tsx:115,132-140`).
- **The ladder does not travel.** 20/17/15 and the fixed 15px literal size are `FigureCell`'s
  **panel-scale constants** (`:216-221`). Table cells keep `fontSize: 'inherit'` (`ScanCells.tsx:74`)
  and 12px list rows keep their size. **Register and state travel; size does not.** A criterion that
  made scanner cells step would fight `ScanTable.tsx:237`'s density sizes.
- **Input plumbing — exactly one new prop.** `ScanTableProps` (`ScanTable.tsx:47-60`) and
  `ScanCardProps` (`ScanCard.tsx:30-35`) each gain **one** per-symbol prop,
  `{ retained: boolean } | null`, computed once at `Scanner.tsx:119-126` where the live price is already
  in hand. `retained` is true **only** when the displayed price came from the now-dead stream; a symbol
  that never ticked keeps the polled swept price, which the poll still refreshes — no pause mark, no
  F5. **Offline-bare therefore does not occur on scanner prices** (criterion 13).

<!-- spire:council-resolution:v1 6c2cf2c5e93575614599ab70258ced726ec21b5b55f570477ba3ecc4d14cded4 folded -->
<!-- spire:council-resolution:v1 7da0330a44483301c998f19632bec0a5c147878ed449e89b297191331a0b090d folded -->

**Risk this mechanism carries, named:** the extraction touches a primitive **sixteen** shipped desk
call sites depend on. If it is done as a **copy** rather than a **move**, the two copies drift and the
phase *creates* the inconsistency it exists to close. The structural guard is criterion N-1's `?raw`
scan: `FigureCell.tsx` may name no font family directly.

### 2.2 Liveness on these four surfaces — one predicate, and no scanner mark (**OWNER — D-A**)

**The facts all three voices agreed.** The scanner runs a real price SSE; the frame carries **no
`market_session` and no wire `live` flag** (`useLivePrices.ts:69` parses
`{ prices?: Record<string, LivePrice> }`, and `LivePrice` is `{ price, ts }` at `:24-27`); and
`labels.ts:25` reads `Prices live · structure ~3 min · hot names sooner`. `isDeliveringLive`'s true arm
(`liveClaim.ts:47-52`) is therefore **not computable** from what the scanner receives, and `andPresent`
only narrows an existing claim. All three voices rejected "option A with `Prices live` left standing".

**Ruling: A — OWNER, 2026-09-06.**

- **No scanner figure — the price included — carries a live mark in any connection state**
  (criterion 11A). pm row 11 is withdrawn as written and row 15 is amended so the basis line states the
  two cadences and asserts liveness in **no** state.
- **`labels.ts:25` is reworded without the word `live`** — the **one** scanner sentence this phase may
  touch. It edits the shipped `scanner.risk.spec.tsx:869`, which pins `/Prices (live|offline)/` on the
  page text; that edit is expected, not incidental.
- **A stream drop renders the F4 retained arm through the unbranded `offline.retained` route**
  (`FigureCell.tsx:174,257-268`) — dim + stroke pause mark + `offline · last known` — computed at
  `Scanner.tsx:119-126` and driven by the **age of the per-symbol `ts`** (`useLivePrices.ts:24-27`).
  This repairs a real shipped defect on the way: `useLivePrices.ts:65-67` calls `setOffline(false)` on
  **any** frame, including a payload-less heartbeat, so the pause mark would otherwise clear while
  prices are stale. **Staleness of a timestamp is not a claim about the venue**, so it mints nothing and
  `[one-liveness-predicate]` is untouched.
- **Options B and C are closed, with their real costs recorded** so nobody re-proposes them cheaply.
  **B** (a second mint in `liveClaim.ts`) needs **no** backend change — the R1 claim that it did was
  withdrawn — but it *defeats the only shipped enforcement of the rule it re-opens*:
  `liveClaim.spec.ts:68-80` scans banned **names**, so a fourth mint inside `liveClaim.ts` passes by
  construction; and its dot could not be censused against a closed venue, because
  `live-dot-census.spec.tsx:1-31` builds its worst case from `market_session:'closed'` + `live:true`,
  which the prices frame never carries. **C** (adding the two fields to `/api/stream/prices`) re-opens
  NO_BACKEND_CHANGE and criterion 67. The client cost of C is small — `LivePrice` is declared locally —
  and the whole cost is the backend fence.

<!-- spire:council-resolution:v1 d09285682d4490f06fc76ed83d39d867b63b029563280f733b7604c84c1b48a6 folded -->
<!-- spire:council-resolution:v1 2c93136ce62c937e4d523a88e246921fc732d1d43ae424e232c407fbeac7f54e folded -->

**Independent of the ruling and IN either way.** `liveClaim.spec.ts:68-80` globs **only**
`pages/ticker/widgets/**`, and `PositionsPage.tsx:88` still calls the banned `genuineIsLive` — the
predicate `liveClaim.ts:41-45` names in terms as the wrong answer, because *"it does not check
`market_session`, so it reads `true` while the venue is closed"*. So `/positions` answers the liveness
question today with the expression the canon predicate exists to replace, **and no test can see it**.
The glob widens to `pages/scanner/**`, `pages/positions/**`, `pages/alerts/**`,
`features/trading/positions/**` and `features/auth/**`, keeping the existing mutation guard and the
live-checked `EXEMPT` idiom so a stale exemption red-builds. `PositionsPage.tsx:114-128` already holds
`live: LiveUpdate | null` and `streamOffline` — precisely `isDeliveringLive`'s two arguments — so the
conversion is a **deletion**: one predicate leaves the tree and none arrives (criterion 6).

`PositionsPage.tsx:147-154`'s Net P/L sum was checked at source for this spec: it is consumed only by
`formatNetPl(netPl)` at `:193` and by the colour at `:189`. It is **purely presentational**, page-local,
and no scoring input — so §4.3's state set lands inside criterion 67's fence. The architect's open
`[lane-check]` on `composeMark.ts:14` (does a drop resolve every leg to `last_known`?) is therefore
**not load-bearing**: criteria 35a–35e are written on what the readout can observe about its own inputs
(open rows, marked rows, retained value), not on how a leg resolved.

### 2.3 Positions — what converts, what keeps its atoms, and the one inversion

**`literal()` and its per-member tips stay.** `PositionRow.tsx:145-153` is a single Tooltip-wrapped
renderer differing by text and testid only, built once for exactly that reason (`:139-144`).
`FigureCell` has **no value-row help host** — `:307` mounts help in the LABEL row with the fixed
accessible name `About {label}`, and the literal branch renders a bare `ValueGlyph` (`:284-288`) whose
only extra slot is `caption ?? null` (`:253`). Converting those cells would **delete the tips**, and
the non-synonymy criterion would read green while the distinction went invisible. The architect
**withdrew** the alternative (funding a value-row help host on the primitive): it would put two
focusable-help affordances in one cell of the component sixteen sites depend on — the duplicate pattern
ruling 6 bans.

- **Non-synonymy is asserted by `test` against the shipped testids** `cell-unavailable` (`:164`),
  `cell-not-recorded` (`:166`) and `cell-no-basis` (`:348`), already asserted at
  `positions.risk.spec.tsx:858,859,885`. The **tip texts** are `review` — the tip carries the
  explanation, not the distinction.
- **Boundary the build must not cross:** `dashCell` (`:167`) is deliberately **untestidded** (`:69`),
  so the `—` member on positions has **no DOM hook**. No assertion may assume one.
- **`FigureCell` conversion on positions = the header readout only** (`PositionsPage.tsx:177-195`).
- **CONDUCTOR call, reversible — the tips are hover-only and that is fixed here.** `literal()` wraps a
  plain `<Typography>` with no `tabIndex` and no `describeChild` (verified at source), so all three
  explanations are hover-only — canon rule 20 and the Banned row *"Hover-only affordances"*. The fix
  uses the file's **own idiom** three hundred lines down (`PositionRow.tsx:396-401`:
  `Tooltip describeChild` + `aria-describedby`), attributes only, **zero wording change**. Reason: a
  `review` mark must not certify an affordance a keyboard cannot reach on the very cells the
  non-synonymy criterion rests on. **Reversal:** OUT → carried debt with `PositionRow.tsx:147-151`
  attached, and criterion U-15a is removed.

<!-- spire:council-resolution:v1 b0f85405a787d1728f858066f4a117e8c5e9b4ff2f4f9a7f024b7c857e2f0a17 folded -->

**"The table keeps its atoms" is mechanism, never scope.** The six live-derived cells still owe the
offline contract and get it from the §2.1 module, not from a local swap: `mark` (`:284-320`), `pl`
(`:321-341`), `pl_pct` (`:342-367`), `delta_entry` (`:368-382`), `session_delta` (`:383-392`), `trend`
(`:393-411`). The three character marks go — `OFFLINE` (`:68`, `'⏸ offline'`), the appended `' ⏸'`
(`:378`), and the bare `'⏸'` that today replaces the **entire** session-delta value (`:388`). `:388`
has a retained arm available (`ctx.sessionDelta` is ephemeral per cycle but still in memory on a drop,
`RowContext:119-120`), so it renders the last value dimmed with the stroke mark and the
`offline · last known` caption, **not a naked glyph**. `dim` comes from the module's output, never from
a cell-local `liveDim` (`:200`) — that is what stops `PositionsPage.tsx:190`'s shape (opacity, no
pause, no caption) being re-minted per cell. `PositionCard.tsx:76-87` roots on a plain `Box` with no
anchor, so the card **could** host the primitive directly; it takes the module route anyway, so table
and card can never render one datum two ways (`ScanCells.tsx:1-3` is the shipped precedent).

<!-- spire:council-resolution:v1 1f765d5bd84f31321e34e0403952a4cdf369e6cb1f05c30cc74de1f2c0fb219c folded -->

**Exactly one positions cell inverts rule 24 and it is removed.** `delta_entry` (`PositionRow.tsx:374`,
`...MONO`) renders `DASH` (`:377`, `'—'`, a member of the closed nine at `:70`) **inside the mono
figure register**, on the surface canon rule 24 names by name. It routes through the shipped `dashCell`
(`:167`, same `DELTA_ENTRY_TIP`): the word `—` stays **byte-identical**, only the register changes Mono
→ Sans. `session_delta` (`:387-388`) is the icon/vocabulary defect above, not this. `dte` (`:518`),
`entry_time` (`:522`), `stop` (`:526`) and `target` (`:528`) already render `DASH` in Sans and are
correct. The header readout hand-binds the mono face at `PositionsPage.tsx:185`, absorbed by its
`FigureCell` conversion.

**Enforcement is an extension of a shipped scan, not a new one.** `fonts.spec.ts:154-167` is already
`?raw` over `/src/app/**` and already mutation-guarded (`:157-161`). It gains **two needles** —
(1) no closed-nine member inside a mono-bound `sx`; (2) no font-family literal or widget-local
`monoFontFamily` binding outside `shared/theme/tokens.ts` and the shared figure module — scoped to
`features/trading/`, `pages/positions/` and `pages/scanner/` (criterion N-1). Forty-nine spec files
already use this idiom.

<!-- spire:council-resolution:v1 66cd71c1073343c1d28610a3a99270ffd80a1ebe3926d7f866e6aea77ca92557 folded -->

### 2.4 The quiet band — split by figure, not by widget

`term-structure` and `setups` are figure-free **in the DOM**. Two of the remaining six bind a
widget-local mono constant and are the real work: `OffExchangeBlocks.tsx:24` → `:79-81` renders
`{b.shares.toLocaleString()} sh @ ${b.price.toFixed(2)}` at `fontFamily: MONO, fontSize: 12`, and
`FreshPositioning.tsx:15` → `:56-58` does the same **and interpolates `'—'` INTO the mono run**. For
both: delete the local `MONO`, resolve register through the module, lift the absent-value token into
its own **Sans span at the row's own 12px** (never `FigureCell`'s 15px literal size — a 15px absent
value inside a 12px list inverts the hierarchy), **no size, layout or order change**, and name the
visible register diff in the build report. `lookalikes.spec.ts:22-27,47-55` is a live-checked exemption
list naming four **other** widgets; neither of these two is on it, so converting them edits no spec.

**The container-step hazard, and its shipped fix.** `Widget.tsx:180` declares
`containerName: 'panel'`, but the nearest **named** ancestor of a quiet-band figure is the whole widget
body: `MarketContext.tsx:443` lays `repeat(auto-fit, minmax(210px, 1fr))` across one panel, so four
~210px figures inside a ~900px panel **never cross the 360px threshold and the declared step never
fires at any viewport** — with a green build and a green `type-floor.spec.tsx`, which asserts only that
the declaration exists. Every converted multi-figure widget therefore wraps **each figure in its own
nested `PanelContainer`** (same name, nearest-ancestor wins — `ReadStrip.tsx:54` is the shipped
precedent), never a second container name and never `containerName` on the widget's own grid. Criterion
7a is verified by a **rendered** assertion at a narrowed container width, never by rule presence.

<!-- spire:council-resolution:v1 cbef7514e4f4d78dbe8d130859c845c98f464b1980353a9bff26184e390eab38 folded -->
<!-- spire:council-resolution:v1 4f915a4ad0c90fc3bac8a153606c3d2aab488976872efbef3b6f1dd0ca68adb6 folded -->

### 2.5 Durable client stores — no key, no shape, one read-path repair

Seven `convexa.*` keys exist; **none changes**. `convexa.uiprefs.v1` (`localPrefs.ts:15`) is untouched
and remains browser-only — which is why criterion 39 forbids importing the canvas's account-persistence
footnote. The positions stores (`convexa.positions.v3`, `positions/store.ts:60`, reading `…v2` at `:61`
and `…ghost-trade.v1` at `:62`) and `convexa.orders.v1` (`orders/store.ts:19`) are read and written
exactly as they ship.

**`convexa.alerts.v1` (`features/alerts/types.ts:47`) carries a live `[loss-free-durable-migration]`
breach and this phase repairs it.** Verified at source: `store.ts:59-68` casts `parsed.events` straight
to `AlertEvent[]` with no per-field validation and resets to `empty()` on a parse failure — correct so
far, nothing is written — but the **next** `upsertRule` / `pushEvent` / `setNotifyBrowser` calls
`persist` at `:41-49`, which `setItem`s the empty state over **the same key the corrupt blob occupies**.
`resolveDurable`'s "never delete old" guarantee does not apply, because it reads one key and writes
another. **The fix is pm's P4 read-fault latch**: once `readAlerts()` takes the catch branch, `persist()`
refuses to write to `ALERTS_KEY` for the session. It is a **read-path guarantee, not a key or shape
change**, so criterion 51 is a no-op migration rather than a version chain.

**What `/alerts` renders while writes are refused** (ux's open P10 arm, answered by the architect's own
mechanism): the shipped **faulted** posture, identical to `PositionRow.tsx:122-127` — a banner explains
it, every write affordance is refused but still focusable and explained, **nothing dims and no pause
mark appears**. Faulted is not offline, and this phase keeps them two states (criteria 30 and N-5).

**Alert labels are forward-only.** `evaluate.ts:73,94,116` builds durable event strings; fixing it
repairs firings written **after** the phase (U-23a) and nothing already stored. The live rule list stops
rendering a threshold the record does not hold (`AlertsPage.tsx:192` `≥ ${r.scoreMin ?? 60}`, against
`types.ts:22` `scoreMin?: number` and `evaluate.ts:83`'s third copy of `60` — while the composer's own
default is `70` at `AlertsPage.tsx:39`). **If** repair is ever funded, its shape is now known and
priced: additive fields, read-new-else-old, `message` **never deleted**, never gated behind a read that
can throw, with a fixture authored from a pre-phase blob.

<!-- spire:council-resolution:v1 50ef9a81beb6c8cd5a2d6899d7fec0c385d9267cbe4e672a2eafcfbeb4ef4da5 folded -->

### 2.6 The register of a **user-entered** number — one cross-surface rule (**OWNER — D-D**)

Canon rule 13 defines Mono as *"traced to Convexa's computation"* and Sans + dotted rule as *"asserted
but untraced"*. The shipped primitive renders `register: 'asserted'` with the F9 caption
`${assertedBy} · untraced` (`FigureCell.tsx:293`) — which on the trader's **own** typed number would
read `you · untraced`.

**Ruling: TRACED — OWNER, 2026-09-06.** A user-entered number renders in the **Mono (traced) register
with no dotted rule**, and the F9 caption `${assertedBy} · untraced` is **never** produced for a
user-entered value. The number **is** the record, reproducible from it exactly, with no inference and
no model in the path. This is stated **once, here, as a cross-surface rule**: it binds risk inputs, sim
entry and alert thresholds alike, and no per-surface row restates it. Criteria 1, 36, 47a and 47b are
its instances.

**The canon amendment is queued for GATE S, not applied by this build.** Rule 13's clause becomes
*"traced to Convexa's computation **or to a record the trader entered**"* — a one-clause widening, filed
now under `_MANIFEST.md` Open amendments and applied at close-out like phase 2's four, never mid-build.
Declaring a **third** register value instead would be an Amendments event out of this phase, and would
leave alert thresholds rendering Sans without the dotted rule in the meantime.

The same conflict split row 47 by threshold **type**, which is §4.5's copy: a **price** threshold has a
real unit and renders its currency prefix; a **score gate** is a unitless 0–100 index
(`types.ts:20-22`) and renders the bare index — `≥ 72`, never `≥ 72 pts`. Rendering a suffix would be
the inferred-unit failure the 2026-08-12 canon amendment names, where the fix was a visible unit
**control**, not a fabricated suffix.

<!-- spire:council-resolution:v1 77667a5927811e72e01a8f47e963f87b338200d2e1b57748d119aeeb35b1a7be folded -->

### 2.7 The copy freeze, narrowed to what it was protecting

The absolute *"shipped copy on positions and scanner is not a variable this phase"* was withdrawn by
its own author: pm's row 29 requires the positions pause mark to stop being a text character, and
`PositionRow.tsx:68,378,388` are shipped strings. **Frozen:** the semantic wording, meaning and order of
every shipped label, tooltip, column name and status on positions and scanner. **Permitted, and only
these three classes, each itemized in the build report so GATE Q sees a diff it was told to expect:**
(1) replacing a typographic truth mark (`⏸`) with the declared stroke icon; (2) replacing a raw wire
token with its closed-lookup label; (3) adding a new honesty or basis line. Anything beyond those is an
R2-class conflict, not a lane decision.

**The closed set of sentences this phase may touch is enumerated as criteria CF-1 / CF-2 / 56a**, and
everything else is proven byte-identical by a scan:

- **Scanner: exactly one sentence** — the cadence header at `labels.ts:25`, and only under D-A(A).
  **Nothing else on scanner.** Two consequences follow and are recorded rather than absorbed:
  ux's **U-8** (a new foot line *"Per-row age is the structure snapshot, never the price."* from the
  canvas) is a new sentence on a surface the residual closes — it is **withdrawn** and future-dated to
  phase 4; and ux's **U-6** survives only in its **member** half (below).
- **Positions: additions only** — the Net P/L coverage caption (35b/35c) — plus the three permitted
  classes above. No existing positions wording changes; the `—` in `delta_entry` is byte-identical and
  only its register moves.
- **Quiet band: exactly two sites** (56a), and the `*_WHOLE_EMPTY` prose sentences
  (`copy.ts:297,352-354`) are untouched — they are widget-body prose, not values.
- **Settings and alerts copy are not frozen** by this rule; their changes are the criteria in §3 D and
  §3 E and the strings in §4.4/§4.5.

**Two R4 reconciliations inside this fence, stated so the sections agree.**
(i) **U-6 is folded in its member half only.** Changing which **closed-nine member** a lookup-miss cell
renders (`—` → `unavailable`) alters no shipped *sentence*, so it sits inside the freeze; but ux's tip
half is **dropped**, because `LabelCell` (`ScanCells.tsx:161-171`) has no help host and adding one is
new chrome on the frozen surface — while the status path already renders `Unavailable` with the
recognized-state tip one cell away (`labels.ts:225-235`). (ii) **U-30 is withdrawn.** Routing
`Setups.tsx:41`'s `s.conviction.toUpperCase()` through a closed lookup would be a **third** quiet-band
string change, and 56a closes that set at two: *"a third change is a conflict, not a detail."* It is
carried debt with `Setups.tsx:41` attached.

<!-- spire:council-resolution:v1 65bd9b07f217cdbe9cb38ea758360b3d3cf3fd0b53b7102a6365aff22958b24f folded -->

**Failure modes + isolation:** see §5.

**Not buildable / rejected approaches** — recorded so a later session does not cheerfully re-propose
them:

- **`FigureCell` inside the scanner table or scan card.** It deletes the single-anchor navigation
  contract and re-writes a pinned e2e, and it duplicates the label eleven times a row (§2.1).
- **A second liveness mint for the prices stream** (option B) — it defeats the only shipped enforcement
  of the rule it re-opens (§2.2).
- **Adding `market_session` / `live` to `/api/stream/prices`** (option C) — re-opens
  NO_BACKEND_CHANGE and criterion 67 this phase.
- **A value-row help host on `FigureCell`** — the duplicate focusable-help pattern ruling 6 bans, in the
  one component that currently proves the pattern is single (§2.3).
- **Converting the positions `literal()` cells to `FigureCell`** — it deletes the three tips.
- **Assuming a DOM hook for the positions `—`** — `dashCell` (`:167`) is deliberately untestidded.
- **Declaring `containerName` on a widget's own grid, or a second container name** — the step is
  declared and never fires (§2.4).
- **Asserting the container step by rule presence** — `type-floor.spec.tsx` passes while nothing steps.
- **A durable shape change on `convexa.alerts.v1` to repair history** — priced, not chosen (§2.5).
- **A count-shaped criterion over the eight widgets** — `term-structure` and `setups` have no DOM
  figure, so any tally is unsatisfiable without inventing figures. The deliverable is the property.
- **Any new persisted user preference on these surfaces** — it would create a durable key and pull
  `[loss-free-durable-migration]` from "satisfied by absence" to the phase's sharpest risk.

## 3. Acceptance criteria (with user stories)

**Stories.** **S1** scan honestly — per row, which number Convexa computed and how old it is ·
**S2** read my book — tell "we never captured this" from "the feed did not send it" from "the
denominator is absent" · **S3** set up without being lied to · **S4** arm a rule and trust what it says ·
**S5** the band under the desk agrees with the desk · **S6** degraded is styled truth · **S7** empty and
signed-out are their own states · **S8** my data survives the upgrade.

`test` = automated · `review` = verified by inspection · `e2e` = browser (Playwright, production
build). **SB** = ship-blocking. No row demands a test per criterion; one test may carry several.

**Row numbering is the council's, deliberately.** Rows keep the number the voice that authored them
used, so GATE Q can trace a row to its origin: plain numbers are pm's R1 set as amended at R3
(`7a/7b`, `11A`, `27a/27b`, `35a–35e`, `47a–47c`, `56/56a`, `57b`); `U-n` rows are ux's; `CF-n` and
`N-n` rows were created at R3/R4 and have no R1 ancestor. **Withdrawn and not silently dropped:** pm 7
(→ 7a/7b), pm 11 (→ 11A, D-A), pm 37 and 38 (→ 37A, D-B), pm 55 (subsumed by 7a), ux U-4 (D-A), U-7
(§1), U-8 and U-30 (§2.7), U-17 and U-18 (D-B), U-23's second clause (§2.5).

**Provenance tags ride the row.** **OWNER** marks a row that exists because of D-A / D-B / D-C / D-D;
**CONDUCTOR** marks the one reversible conductor call. Reversing a tagged call removes or rewrites that
row and is a spec edit, not a rebuild.

### A. Cross-surface — the register becomes a property of the app

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | S1·S5 | Every figure on scanner, positions (sim **and** Broker tabs), settings and alerts renders with a **visible register** — Mono where the figure is traced to Convexa's own computation **or to a record the trader entered** (**OWNER — D-D**), Plex Sans with a dotted rule where it is asserted but untraced — and no surface sets a figure's typeface from a local font constant | test (**SB**) |
| 2 | S1 | A converted call site that supplies no register **cannot render a figure**: poisoning one site by deleting its register makes the build go red, and that poison proof is itself shown non-vacuous — `[structural-over-prose-enforcement]` | test (**SB**) |
| 3 | S6 | A not-a-number value on these surfaces renders **one of the closed nine** (`shared/copy/notANumber.ts:26-36`) as Sans text — never in the mono register, never with a unit or currency prefix, never stepped as a figure | test (**SB**) |
| 4 | S6 | No figure on these surfaces renders `null`, `undefined`, `NaN`, an empty cell, or a `0` standing in for an absent value, in any state | test (**SB**) |
| 5 | S1 | No surface asserts liveness for a figure by page convention, by a header sentence or by a widget-level flag; a live mark appears only where **that figure's own value** came from a delivering stream, resolved through the one branded predicate | test (**SB**) |
| 6 | S1 | These surfaces consume the **one** shipped liveness predicate and mint no second one: `liveClaim.spec.ts:68-80`'s banned-name scan reaches `pages/scanner/**`, `pages/positions/**`, `pages/alerts/**`, `features/trading/positions/**` and `features/auth/**` with live-checked EXEMPT entries, and `PositionsPage.tsx:88`'s `genuineIsLive` call is gone | test (**SB**) |
| 7a | S5 | Every figure that renders at the **20px base** steps 20 → 17 → 15 against its **own named `panel` container**, proven by a **rendered** assertion at a narrowed container width — never by the presence of the declaration | test |
| 7b | S5 | A figure deliberately off the base ladder (a 12px list row; a table cell at `fontSize: 'inherit'`) keeps its **shipped size**, and every such site is named with its reason in the build report | review (build report) |
| 8 | S5 | Every panel that hosts a stepped figure is a container-query context under the single shipped name `panel` — nested `PanelContainer`s where a widget lays several figures across one panel — and **no second container name** is introduced anywhere this phase touches | test |
| N-1 | S2·S6 | **Negative space, mutation-proved:** no closed-nine member renders inside a mono-bound `sx`, and no font-family literal or widget-local mono binding exists outside `shared/theme/tokens.ts` and the shared figure module, across `features/trading/`, `pages/positions/` and `pages/scanner/` — the shipped `?raw` scan at `fonts.spec.ts:154-167` extended with two needles, keeping its mutation guard (`:157-161`) | test (**SB**) |

### B. Scanner

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 9 | S1 | Every scanner figure — price, chg %, score, tier, regime, vol, flip, walls, distances, as-of — states its register in **both** the table and the card layout, and the two layouts render the same datum **identically** | test (**SB**) |
| 10 | S1 | Scanner **structure** figures (score, tier, regime, vol, flip, walls, distances, as-of) carry **no** live mark in any connection state | test (**SB**) |
| 11A | S1 | **No scanner figure — the price included — carries a live mark in any connection state** (**OWNER — D-A**) | test (**SB**) |
| 12 | S6 | On a price-stream drop, a price whose displayed value came from the **now-dead stream** renders at reduced emphasis with the declared stroke pause mark and the caption `offline · last known` — observable as `[data-testid="cell-price"][data-figure-state="offline-retained"]` — while every structure figure beside it keeps **identical text** and is **not** dimmed | test (**SB**) |
| 13 | S6 | On the same drop, a symbol that **never** received a streamed price renders its swept price at full strength, with no pause mark and no last-known wording; `offline-bare` never occurs on a scanner price | test (**SB**) |
| 14 | S6 | While the price stream is down, **no price figure flashes on change** | test (**SB**) |
| 15 | S6 | The cadence header states the **price cadence** and the **structure cadence** as two claims and asserts liveness in **no** state; the word `live` does not appear in it (**OWNER — D-A**) | review |
| 16 | S6 | With the sweep worker down, rows keep their last-known values under the warning treatment (burnt orange + icon), every figure keeps its register, and **no row is blanked** | test |
| 17 | S6 | A row the sweep has not computed yet renders its status chip plus closed-nine members in its figure cells — never a `0`, never a **mono** em-dash | test |
| U-6 | S6 | A closed-lookup **miss** on tier / regime / vol renders the member `unavailable`, not `—`: the two are non-synonymous, and "the wire sent an enum this build does not know" is a fact this build can observe | test |
| 18 | S7 | First load renders the cold placeholder with **zero figures**; it never appears after the first successful read and is not confusable with an uncomputed row or a degraded read | test |
| 19 | S7 | An **empty saved view** and a **filter matching nothing** render two different messages with two different recovery controls, and neither renders as an error | test |
| 20 | S7 | Signed out, the scanner renders the sign-in wall **naming the surface** — never an empty table, never a converted-but-blank page | test |
| 21 | S1 | At every checked width where the dense table renders, no column is clipped, the table scrolls **inside its own container**, and the page itself never scrolls sideways | e2e (**SB**) |
| 22 | S1 | At phone width the card layout carries **every** datum the table row carries, in the same register and the same words, and the card stays **one** anchor to `/ticker/{SYMBOL}` with no focusable control nested inside it | test (**SB**) |
| CF-1 | S6 | **The scanner's closed copy set is exactly one sentence** — the cadence header (`labels.ts:25`). Every other shipped scanner string, including the `⚠ Stale` / `⚠ Error` status labels and every tooltip, is **byte-identical** after the conversion, proven by a scan (**OWNER — D-A** for the one exception) | test (**SB**) |

### C. Positions — sim book · Broker tab · header readout

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 23 | S2 | Every figure in the sim book, in the **Broker tab** and in the page header readout renders with a stated register; a value the app could not compute never renders in the mono register | test (**SB**) |
| 24 | S2 | `not recorded`, `not provided` and `no basis` are each reachable in at least one **producible** positions state, each carrying its own explanation | test (**SB**) |
| 25 | S2·S6 | Non-synonymy is asserted as **three facts** against the shipped testids: the sim book renders `not recorded` (`cell-not-recorded`) and **never** `not provided`; the Broker tab renders `not provided` and **never** `not recorded`; `no basis` (`cell-no-basis`) appears **only** on `pl_pct`. Three different fixtures reach three different arms | test (**SB**) |
| 26 | S2 | `no basis` is a **cell-level** state — the dollar P/L beside it still renders as a figure | test |
| 27a | S6 | On a stream drop, a live-derived positions cell holding a last streamed value renders that value at reduced emphasis, with the declared **stroke** pause icon, **and** a caption saying it is the last known | test (**SB**) |
| 27b | S6 | On a stream drop, a live-derived cell with **no** retained value renders a member of the closed nine **with** the pause icon and **no** last-known words | test (**SB**) |
| 28 | S6 | **No** positions cell renders a bare pause marker with neither a value nor a closed-nine member beside it | test (**SB**) |
| 29 | S6 | The pause marker is the declared **stroke icon** on every positions surface, never a text character a platform may colour-emoji: no `⏸` survives in any positions source string | test (**SB**) |
| U-9 | S6 | Record fields — contract, structure line, qty, net entry, **max loss**, expiry, status — never dim and never show a pause mark on a stream drop (`max loss`'s own tooltip promises exactly this) | test |
| U-15 | S2 | Each of the three positions-side members keeps its **own distinct tip**, wording unchanged | review |
| U-15a | S2 | Each of those three tips is reachable **by keyboard**: `Tooltip describeChild` + `aria-describedby` on the value, focusable, with **zero wording change** (**CONDUCTOR**) | test (**SB**) |
| 30 | S6 | With the durable store **faulted**, every write affordance on a row is refused but still focusable and explained, **nothing dims** and **no pause marker appears** — faulted and offline stay distinct states | test |
| 31 | S6 | A closed or cancelled row carries no live mark and no pause marker in any connection state | test |
| 32 | S7 | Signed out, positions renders the sign-in wall **naming the surface** — never an empty book that reads as "you have no positions" | test |
| 33 | S7 | Signed in with an **empty book**, the empty state is distinct from the wall and from a load failure | test |
| 34 | S2 | The Broker tab renders **read-only** with no entry, order or cancel control and issues **no new network call**; the one entry affordance on the surface opens the single shared `TradeEntryDialog` | test (**SB**) |
| 35 | S2 | Tinting stays **signed-P&L direction only** — never by side, never call-vs-put, never by tier — **and only where the tinted value is a computed P&L over marked rows**: never a zero standing in for an unmarked or empty book, never on a closed-vocabulary member | test |
| 35a | S2·S6 | With **no open positions at all**, `Net P/L (open)` renders `—`: no number, no direction colour | test (**SB**) |
| 35b | S2·S6 | With open positions but **none marked**, it renders `unavailable`: never a number, never a zero, never a direction colour, with the caption `0 of {m} open marked` | test (**SB**) |
| 35c | S2 | With **some** open rows marked, it renders the sum it can compute and carries the **mandatory** caption `{n} of {m} open marked` | test |
| 35d | S2 | With **every** open row marked, it renders the total and carries **no** coverage caption | test |
| 35e | S6 | On a stream drop it renders the degraded arm — retained total + pause icon + `offline · last known`, or `unavailable` + pause icon + `offline` — never a bare dimming with no marker and no caption; the **offline caption takes precedence** over the coverage caption | test (**SB**) |
| CF-2 | S6 | **Positions copy changes are exactly**: the three permitted classes (typographic truth mark → declared stroke icon; raw wire token → closed-lookup label; a new honesty/basis line) plus the **additions** in 35b/35c. Every other shipped positions label, tooltip, column name and status is byte-identical, proven by a scan, and each permitted change is itemized in the build report | test (**SB**) |

### D. Settings

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 36 | S3 | Every figure on settings renders with a stated register (**OWNER — D-D** for the trader's own risk inputs), and a value the user has not supplied renders **`not set`** — never a pre-filled number, never an inferred unit | test (**SB**) |
| 37A | S3 | Every one of the five sections — Account · Preferences · Risk inputs · AI providers · Brokerage — is reachable at **every checked width** in the shipped single column, with **no page-body overflow** (**OWNER — D-B**: the section rail and tabs are phase 4) | e2e |
| 39 | S3·S7 | Signed out, the page states that preferences are stored **in this browser only** and never claims account persistence; the canvas footnote `Saved to your account.` is **not** imported | test (**SB**) |
| 40 | S3·S6 | A failed write renders a **non-blocking** error, returns the control to its last known value, and shows **no** confirmation | test (**SB**) |
| 41 | S3 | The save **confirmation** is neutral chrome: no chip, confirmation or readiness mark on settings renders in the direction-reserved colours. The save **error** keeps its error severity **with its icon** — an error is a *state*, not a *direction* | test (**SB**) |
| 42 | S3 | No control or chip on settings carries a live mark or a pulse; credential readiness is stated as a **state**, never as a stream | test (**SB**) |
| 43 | S3 | A stored credential is shown as a **masked hint** only, with no key material rendered in any state | review |
| U-19 | S3 | While the session is still resolving, settings says so in one line above the fields and removes it the moment the session resolves — controls are never silently frozen with no explanation | review |
| U-35 | S3·S1 | Panels this phase converts render the **declared scales** — radius panel **12** / control **8** / pill **999**, on the 4-pt spacing rhythm — and the three off-ladder sites (`SettingsPage.tsx:67` → 30px; `ScanTable.tsx:289-290` and `ScanCard.tsx:70` `'10px'`) are on the ladder afterwards | test |

### E. Alerts

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 44 | S4 | Read and unread firings are distinguishable in a **black-and-white screenshot**: the distinction is carried in the label row and in type, and **no state on this surface is carried by a coloured edge alone** | test (**SB**) |
| 45 | S4 | Every rule's kind and level render the human label from the surface's **closed lookup**; no raw wire token reaches the DOM | test (**SB**) |
| 46 | S4·S6 | A rule with no threshold recorded renders a **closed-nine member** — never a default number the record does not hold | test (**SB**) |
| 47a | S4 | A rule carrying a **price** threshold displays it in that rule's own summary line, in the **Mono (traced)** register (**OWNER — D-D**), with the currency prefix on the number | test (**SB**) |
| 47b | S4 | A rule carrying a **score gate** displays the **bare index** beside its closed-lookup label `Score gate`, in the Mono register (**OWNER — D-D**) — `≥ 72`, never `≥ 72 pts`, no unit invented | test |
| 47c | S4 | **No numeric control** on this surface takes a value whose unit is only implied by its label: a money input states its unit as part of the control | review |
| 47d | S4·S6 | A **structure-level** rule renders its level from the closed `LEVELS` lookup and carries **no threshold number of its own** (the level's value is a market fact the record does not hold); an absent level renders `not recorded`, never the bare word `level`. A **tier-change** rule's threshold line stays byte-identical | test (**SB**) |
| 48 | S4·S7 | "No rules", "rules armed, nothing fired" and "nothing evaluated yet" render **three different** messages, each naming the next action, and none renders as an error | test |
| 49 | S4·S6 | The page states that rules evaluate on **structure snapshots** rather than a stream, and no element on it carries a live mark or a pulse | test (**SB**) |
| 50 | S4 | A denied or unavailable browser-notification permission renders a state **saying so**; the control never reads as "on" for a permission the browser did not grant | test |
| 51 | S8 | Every rule and firing saved **before** this phase is present after it, enabled or disabled exactly as saved | test (**SB**) |
| 52 | S8 | An unreadable alerts blob degrades to an empty list **without overwriting the stored original**, and the page renders its empty state rather than throwing | test (**SB**) |
| N-5 | S6·S8 | While the read-fault latch is refusing writes, `/alerts` takes the shipped **faulted** posture: a banner explains it, every write affordance is refused but still **focusable and explained**, **nothing dims and no pause mark appears** | test |
| U-23a | S4 | A firing recorded **after** this phase builds its label from the closed lookups, so a new event and its rule row read the same words. The Recent list makes **no claim** that stored history was re-labelled | test |
| U-24 | S4 | The back-fill honesty line and the "stored in this browser" durable disclosure are both present | review |
| U-27 | S4 | Every firing timestamp **names its zone** | review |

### F. The eight quiet-band widgets

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 53 | S5 | Each of the eight widgets renders its figures with a **stated register**, and none sets a figure typeface from a widget-local font constant | test (**SB**) |
| 54 | S5 | **No** quiet-band widget can render an untraced figure in the mono register, in any state | test (**SB**) |
| 56 | S5 | Each widget keeps its **shipped composition** — ordering, grouping and label wording unchanged; every shipped sentence not named in 56a is byte-identical after the conversion, proven by a scan | review |
| 56a | S5 | **The quiet band's closed copy set is exactly two sites:** (i) the market-context string occupying a figure **value** slot becomes the member `unavailable`, with the this-cycle meaning moved to that figure's **caption**; (ii) the setups widget renders **two** sentences where it renders one, the checked-and-empty arm keeping its shipped sentence byte-for-byte. **Nothing else** — the `*_WHOLE_EMPTY` prose is untouched | test |
| 57 | S5·S6 | Each widget's unavailable-this-cycle state renders **its own** message with its figures as closed-nine members, and an unavailable widget never blanks or degrades a neighbour | test |
| 57b | S5·S6 | A widget whose input was **never delivered** says so in its own words and states **no market fact** about a ticker nobody scored | test |
| 58 | S5 | **No** quiet-band figure carries a live mark in any connection state | test (**SB**) |
| 59 | S5 | Every hover-revealed help control across the eight widgets is reachable **by tap and by keyboard focus** at every checked width — including the off-exchange proximity chip, which sits outside the four widgets ruling 6 fixed | test (**SB**) |
| U-32 | S5 | The **`Widget` frame's ⓘ** is a focusable control (tap, Enter/Space, Escape) at **all seven** live `info=` sites, using the ONE shipped focusable-help pattern. **The ticker desk is reopened for this single shared-frame change and nothing else** — no desk layout, copy, state or spec content changes — and the desk's own shipped specs (a11y tree, focus order, single-motion-moment, live-dot census) are **re-run inside this criterion** and stay green (**OWNER — D-C**) | test (**SB**) |
| 60 | S5 | Each widget states its **own** basis and as-of, and none is a scoring input | review |
| 61 | S5 | The off-exchange band stays neutral and **context-only**: no directional colour, no side claim, block prints display-only | test |

### G. Whole-phase guardrails

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 62 | all | At **393px in both colour schemes** and at **834, 900 and 1280 in the one scheme the standing suite runs**, none of the four surfaces has horizontal page overflow — measured on **seeded, non-empty** pages (an alerts blob at `convexa.alerts.v1`; a guaranteed non-zero scan row count), never on an empty page | e2e (**SB**) |
| 63 | all | The suite's **executed** case list, captured before GATE Q, names every width × scheme combination row 62 claims; a combination **claimed but not executed** is a FAIL of this row, not a PASS of 62 | review (build report) (**SB**) |
| 64 | all | In light mode at 393 and 1280, no surface this phase touches renders a scheme-invariant background or text colour | test |
| 65 | all | No figure, chip or label on the four surfaces or the eight widgets renders below the **11px floor** at any checked width | test |
| 66 | all | Every control this phase creates or touches meets the **44px** effective hit area in **both** dimensions on a coarse pointer at 393px; anything failing outside that set is itemized with `file:line` in the build report as carried debt with a phase attached | e2e |
| 67 | all | `git diff origin/main...HEAD -- apps/api` returns **zero lines**, and `opportunity_score` / `opportunity_tier` / `state_fingerprint` are byte-identical | test (**SB**) |
| 68 | all | `npm run typecheck` exits 0, recorded **separately** from the suite's own exit code | test (**SB**) |
| 69 | all | Every gate this phase lands is proven by a **poison run that goes red**, and each poison proof is itself proven **non-vacuous** — `[structural-over-prose-enforcement]` | review (build report) (**SB**) |
| 70 | S8 | No durable key or shape this phase touches loses user data: read-new-else-old, promote-forward, never-delete, idempotent, never-throw — verified against a blob written **before** the phase | test (**SB**) |
| U-37 | S6 | Every surface's degraded copy **names the degrade**; no surface dims without saying why | review |

**95 criteria; 53 marked SB.**

**Where these criteria came from, where they were corrected, and why.**

**"Renders through `FigureCell`" was not observable and is gone.** A stranger at GATE Q can open
`/scanner` and check that a figure states its register; they cannot see which component produced it. ux
withdrew the mechanism half of U-1 itself, and rows 1, 2, 3 and 9 state the same requirement as
**outcomes**: a visible register, no call site able to render a figure without one (proven by a poison
run), no not-a-number in the mono register, and the table and card never disagreeing about one datum.
The component name lives in §2, never in a criterion.
<!-- spire:council-resolution:v1 eebd259eca1f92682e5e9d916b09d21c56c93367a9186e2572a906b9a3d30cf9 folded -->
<!-- spire:council-resolution:v1 1eee801a384f28f17b062101b1c2776f350b2955a0ae42d5876f55871d5e1ddf folded -->

**The universal step row was withdrawn by its own author and split.** `FreshPositioning.tsx:15,56`
renders its mono rows at a deliberate `fontSize: 12` inside a recessed list; stepping them 20 → 17 → 15
would **enlarge** them and break ruling 6's layout freeze, and `term-structure` and `setups` carry no
DOM figure to step. Worse, the row's verification method was wrong as well as its scope: a
rule-presence assertion passes while nothing steps, and **no shipped test would catch it**. 7a is a
rendered assertion at a narrowed container width; 7b names the off-ladder sites in the build report.
Rows 53 and 54 stand unchanged on all eight, because the property — register enforced, no untraced
mono figure — is what this phase actually owes and is satisfiable everywhere.
<!-- spire:council-resolution:v1 d000b908a8a2d352ef7c18efcbc1b63ea54cb8794b9d1412cd04a88d84957f5b folded -->

**The copy freeze became a closed, enumerated set rather than an absolute.** As an absolute it collided
with pm's own row 5 given `labels.ts:25`, and with pm's own row 29 given `PositionRow.tsx:68,378,388`.
CF-1, CF-2 and 56a **enumerate** the sentences this phase may touch, and everything not enumerated is
proven byte-identical by a scan. §2.7 records the two rows this closure withdrew (U-8, U-30) and the
one it narrowed (U-6), so no criterion is dropped without a visible reason.
<!-- spire:council-resolution:v1 3dba77c9ca6f8fb70f14c9dfb1f37e8b4ff5c8e2a46aff0e85db8767c084d5c8 folded -->

**Non-synonymy is three facts, not a count** — matching owner ruling 3's *"closure and non-synonymy,
never a count"*. Row 25 is only meaningful if **three different fixtures reach three different arms**;
a single fixture asserting three strings differ proves nothing about the app, and the row says so.

**Degraded arms name which arm they assert.** Phase 2's split of its criterion 16 is the lesson: a
criterion demanding two marks the app cannot produce together goes green against an unreachable state.
12/13, 27a/27b and 35a–35e each name their arm; if a fixture cannot reach one, the honest outcome is a
bounce, not a pass. Criterion 13 records the reachability fact that makes the scanner pair honest:
under the `retained` computation of §2.1, **offline-bare does not occur on scanner prices at all**.

**Row 62 measures seeded pages, because the shipped suite does not.** `no-overflow.spec.ts`'s `seed()`
takes `{ scheme, positions }` only; `/alerts` is walked with **no rules and no events**, so it measures
an empty state, and `/scanner`'s wide-band walk asserts only that the page is attached — a zero-row
scan passes. Without the seeding work the phase's headline responsive criterion is green on empty
pages. Row 63 exists because `playwright.config.ts` is an explicit `testMatch` allowlist: **an
unregistered spec reports green by never running**, so execution is proved with `--list`, not with a
passing summary.

**Rows that are `review` are review for a reason.** 7b, 15, 43, 47c, 56, 60, 63, 69, U-15, U-19, U-24,
U-27 and U-37 describe visible, intentional output whose regression a reviewer opening the page would
see at once, and whose automation would pin wording or composition this phase promises not to change.
The rows that are `test` are the ones that regress **silently**: a wrong literal, a missing register, a
fabricated default, a bare pause glyph, an overwritten store and a green `+$0` all render as plausible
pages.

## 4. UI + interaction

**Flows.** `/scanner`: head (identity + the two-speed basis) → toolbar → the 11-column table above the
card threshold, cards below → per-row status + as-of. `/positions`: header (identity + Net P/L (open))
→ toolbar → the two tabs (Simulated · Broker) → table or cards → the static Track record.
`/settings`: one 640px centred column of five stacked panels, in the shipped order. `/alerts`: head →
composer → Rules → Recent. **Quiet band:** eight `Widget` frames beneath the desk, unchanged in
arrangement.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (**Status: SET**).

### 4.1 Component states

| Component | default | loading | empty | error / degraded | offline / stale |
|---|---|---|---|---|---|
| **Scanner table + cards** | every figure states its register; no live mark anywhere; per-row status chip + as-of | cold placeholder, **zero figures**, never re-entered after the first read | empty saved view and filter-matches-nothing are **two** messages with two recovery controls; an uncomputed row shows its chip + closed-nine members | sweep worker down → warning treatment (burnt orange + icon) over **intact** rows; every register kept; no row blanked; signed out → the sign-in wall naming the surface | price from the dead stream → **F4** (dim + stroke pause + `offline · last known`); price never streamed → **unchanged, full strength, no mark**; structure figures byte-identical and **un-dimmed**; no flash |
| **Positions row (table + card)** | record fields never dim; live-derived cells carry the register; tints only on a computed P&L | inherits the page skeleton | `not recorded` / `unavailable` / `no basis` / `—` per cell, each with its own tip, each keyboard-reachable | durable store **faulted** → banner, every write refused but focusable and explained, **nothing dims, no pause mark**; closed/cancelled rows carry neither mark | live-derived cell with a retained value → **F4**; without one → **F5** (closed-nine member + pause icon, no last-known words); record fields unchanged |
| **Positions header readout** (`FigureCell`) | `Net P/L (open)`, Mono, direction tint permitted | inherits the page skeleton | no open rows → `—`, Sans, **no tint** | open rows, none marked → `unavailable`, Sans, **no number, no tint**, caption `0 of {m} open marked` | **F4** (retained total, pause icon, `offline · last known`) or **F5** (`unavailable`, pause icon, `offline`); the offline caption **overrides** the coverage caption |
| **Broker tab** | read-only figures with a stated register; `not provided` where the feed did not send it | its shipped skeleton | `not provided` in its own cells; **never** `not recorded` | its shipped provenance/stamp states, unchanged; no entry, order or cancel control in any state | inherits the same module states; no second offline treatment |
| **Settings panels** | five sections in the shipped order; `not set` for anything the user has not supplied; declared radii | one line says the session is still resolving; controls are not silently frozen | `not set`, never a pre-filled number | failed write → non-blocking error **with its icon**, control reverts, **no** confirmation; signed out → browser-only persistence stated | nothing on settings is live: **no** live mark, **no** pulse, in any state |
| **Alerts** | rules read back in the composer's own words; unread carried in the label row and in type | — | **three** distinct empties: no rules · rules armed nothing fired · nothing evaluated yet | read-fault latch engaged → banner, writes refused but focusable and explained, **nothing dims, no pause mark** | nothing on alerts is live: **no** live mark, **no** pulse; the page says rules evaluate on structure snapshots |
| **Quiet-band widget** | figures state their register and step against their own nested `panel` container | its shipped skeleton | checked-and-empty keeps its shipped sentence; the value slot holds a **member** of the closed nine with the qualifier in the caption | never-delivered renders its **own** words and asserts **no** market fact; an unavailable widget never degrades a neighbour | **never** — the quiet band wears no live mark and no pause mark in any connection state |

### 4.2 Scanner copy — one sentence changes (**OWNER — D-A**)

The cadence header is the **only** scanner sentence this phase may touch. Shipped:
`Prices live · structure ~3 min · hot names sooner` (`labels.ts:25`). It becomes a two-cadence basis
line that asserts liveness in no state — this spec's authored value is:

> **`Prices per tick · structure ~3 min · hot names sooner`**

"Per tick" names the **price cadence** (a price changes when a tick arrives) without claiming a tick is
arriving now; it is parallel to the structure cadence; the separator, the order and the third clause are
byte-identical; and it removes the banned token, which the file's own header comment
(`labels.ts:4-9`) records as this surface's standing discipline for two other clauses. Any substitute
that satisfies criterion 15 is acceptable at GATE Z; the *criterion*, not this string, is the contract.

The **offline** arm is unchanged: `Prices offline · showing last known · structure ~3 min`
(`labels.ts:32`) — and it becomes **true** for the first time, because the figures now dim
(criterion 12). Both edits land on the shipped `scanner.risk.spec.tsx:869`, which pins
`/Prices (live|offline)/` on the page text.

Everything else on the scanner is byte-identical, including `'⚠ Stale'` and `'⚠ Error'` (§1) and every
tooltip (CF-1).
<!-- spire:council-resolution:v1 f81c19bae589857ec75639d1474a2787f03d93eb8c346901ef30f94d2bfbacc8 folded -->
<!-- spire:council-resolution:v1 918e6655610811bcf259e38e34d95236f39cb8228e0d36f31ff198a739bf4006 folded -->

### 4.3 Positions copy — additions only

Label `Net P/L (open)` and `data-testid="positions-net-pl"` are **unchanged**. The five states of that
one figure, with their copy:

| state | value | tint | caption |
|---|---|---|---|
| no open rows at all | `—` (F7), Sans | none | the caller's basis line |
| open rows, **none** marked | `unavailable` (F8), Sans | **none** | `0 of {m} open marked` |
| **some** marked | the computable sum, Mono | direction permitted | `{n} of {m} open marked` (**mandatory**) |
| **all** marked | the total, Mono | direction permitted | **none** |
| stream drop | retained total (F4) or `unavailable` (F5) | none | `offline · last known` / `offline` — **overrides** the coverage caption |

`{n} of {m} open marked` is **one** template used by two states, so no second sentence is minted, and
coverage is countable from the same set the sum already walks. The offline precedence is the
primitive's shipped behaviour (`FigureCell.tsx:253,262,271`), not a new composition rule.

Everywhere else on positions: the three literal tips keep their exact wording (U-15); `—` in
`delta_entry` is byte-identical and only its register moves; `'⏸ offline'`, `' ⏸'` and the bare `'⏸'`
are replaced by the declared stroke icon plus a value or a member (27a/27b/28/29) — the icon, not the
words, is what changes.
<!-- spire:council-resolution:v1 338807da910a82d14a08017f624036f616802f14d023d5e8c469341a401cc2f0 folded -->

### 4.4 Settings copy

The five section headings are the **shipped** ones and their order is load-bearing — the file records
that a trader input must not be grouped with credentials — so nothing reorders. Signed-out copy states
browser-only persistence and never claims the account; the canvas footnote `Saved to your account.` is
**not** imported (criterion 39). The confirmation keeps the word it ships with and loses the success
palette slot (criterion 41). The **error** alert keeps its error severity **with its icon**: canon rule 5
requires *warning/error + icon always*, and the Banned row reserves green/red against *"status chips,
success states or hit rates"* — an error alert is none of those. That is the routed ask settled: an
error is a **state**, not a **direction**. One line states that the session is still resolving while it
is (U-19), and is removed the moment it resolves.

### 4.5 Alerts copy

- Rule label: `{SYMBOL} · {closed KINDS label}` — never the raw wire enum (criterion 45).
- **Score gate:** label `Score gate`, value `≥ {scoreMin}` in the **Mono** register, bare index, **never
  a fabricated suffix** (47b). Absent → **`not set`**, never a default the record does not hold (46).
- **Price threshold:** label `Price threshold`, value with the **currency prefix**, Mono (47a). Absent →
  **`not set`**.
- **Structure level:** label from the closed `LEVELS` lookup; **no threshold number of the rule's own**.
  Absent → **`not recorded`** — the member whose literal meaning is *never captured* — never the bare
  word `level` (47d).
- **Tier change:** no threshold; its threshold line is byte-identical.
- **`not set` is a member of the closed nine, confirmed at source** (`notANumber.ts:30`, third position
  in the `NOT_A_NUMBER` tuple at `:26-36`). ux's proposal needed no substitution and mints nothing; the
  Amendments fallback the council reserved is **not** used.
- **`not recorded` on alerts is a per-surface subset, not a second vocabulary.** Canon rule 24 says the
  three ship *"on the positions and broker surfaces"*, and it also states the accepted cost in the same
  rule: *"the fix if one appears is a per-surface subset, not a second vocabulary."* Alerts is a third
  durable client store with the same failure mode, and the alternative shipped today is the bare word
  `level` — a **tenth** literal outside the closed set. Using an existing member on a fourth surface
  keeps the vocabulary closed; minting `level` does not. (If the skeptic disagrees, this becomes an
  Amendments line rather than a criterion — §9 item 4.)
- The unread mark moves off the coloured left edge into the label row and type (44); the honesty line
  about back-fill and the "stored in this browser" disclosure are both present (U-24); every firing
  timestamp names its zone (U-27); and the three empties are three sentences (48).
- The Recent list renders stored `message` strings **verbatim** and makes no claim that history was
  re-labelled (U-23a, §1 carried debt).

### 4.6 Quiet-band copy — exactly two sites

1. **Value-slot member.** `_kit/copy.ts:355` `MC_CELL_EMPTY = 'unavailable this cycle'` occupies a
   figure **value** slot (`MarketContext.tsx:291,299,375`) and is not a member of the closed nine. It
   splits into value **`unavailable`** + caption **`this cycle`**, exactly as
   `design/src/components/figure-cell.mjs:40` already draws it.
2. **One sentence for two states.** `Setups.tsx:52` renders `No clean setup right now.` for both
   `undefined` and `[]` (`:32`) — a positive claim about the market for a ticker nobody scored. `[]`
   keeps that sentence **byte-for-byte**; `undefined` renders **`Setups unavailable this cycle.`**,
   matching the `*_WHOLE_EMPTY` family idiom.

This is the **only** collapse in the band: `FreshPositioning.tsx:41` vs `:45` and
`OffExchangeBlocks.tsx:46` vs `:50` already split never-checked from checked-and-empty, and no other
quiet-band widget has a list-empty arm at all. The `*_WHOLE_EMPTY` prose sentences
(`copy.ts:297,352-354`) are widget-body prose, not values, and are untouched. A third change is a
conflict, not a detail.
<!-- spire:council-resolution:v1 154fb2122f510075e58a1dbef185abb14ce4af91eeb519a3f0483a60a2197773 folded -->

### 4.7 Design direction

This feature **applies** the canon; it does not restate the token table. It spends canon **13** (the
figure cell: state in the label row and in the type register, the container steps, the conditional
`last known` clause), **16** (the ten-state discipline read as *states are not directions*, §4.4),
**17** (the checked widths and no horizontal overflow), **20** (every hover-revealed control has a
tap/focus path — U-15a, U-32, 59), **21** (panels are containers — criterion 8), **22** (liveness is
gated — 11A, 14), **23** (the type register) and **24** (the closed nine, non-synonymous, Sans, never a
figure). It lands **one queued canon amendment** and files **one Amendments question**:

| rule | change | when | product behaviour? |
|---|---|---|---|
| 13 | *"traced to Convexa's computation"* → *"traced to Convexa's computation **or to a record the trader entered**"* — a one-clause widening (**OWNER — D-D**) | **GATE S**, at close-out; **not** applied by the build | criteria 1, 36, 47a, 47b |
| Icons row | **question, not an amendment:** does the colour-emoji clause reach `U+26A0` in a chip label, or is the glyph a deliberate third truth mark? (`labels.ts:196,205,211`) | filed for the owner; **not** this phase | none — the chips stay byte-identical |

## 5. Error handling

- **Cold start is the only blank screen.** On the scanner, a failed poll after a successful one keeps
  the last-known rows and flips the degraded banner; it never blanks the table and never throws into the
  trader path.
- **A price-stream drop never blanks and never zeroes.** A retained price renders F4 with the stroke
  pause mark and `offline · last known`; a never-streamed price renders unchanged at full strength with
  **no** mark and **no** last-known words. Structure figures beside it are byte-identical and un-dimmed.
  The flash stops (criterion 14).
- **A positions stream drop degrades cells, never records.** Live-derived cells take F4 or F5 from the
  shared module; record fields — including `max loss`, whose own tooltip promises it — never dim and
  never wear a pause mark. The header readout takes 35e.
- **Faulted is not offline.** With the durable store refusing writes, every write affordance is refused
  but still focusable and explained, a banner says why, **nothing dims and no pause mark appears** —
  on positions (30) and identically on alerts (N-5).
- **A corrupt alerts blob is never overwritten.** The read degrades to an empty list, the page renders
  its empty state, and the read-fault latch refuses every write to `ALERTS_KEY` for the session, so the
  original survives for recovery (52).
- **A closed-lookup miss is a state, not a guess.** An unrecognized status already resolves to the
  fail-honest `Unavailable` meta with its own tip; an unrecognized tier / regime / vol label resolves
  to the member `unavailable` rather than `—` (U-6). Neither ever renders the raw enum.
- **A settings write failure reverts and explains.** Non-blocking error **with its icon**, the control
  returns to its last known value, and **no** confirmation is shown (40) — the error state never
  borrows the direction palette (41).
- **Absent is never none.** Every absent value on these surfaces is a member of the closed nine chosen
  by the caller, in Sans, never in the mono register, never a `0`, never an empty cell, never a tenth
  literal (3, 4, 17, 46, 47d, 56a).
- **Nothing is partially applied.** The module extraction, the `FigureCell` re-import of the two marks
  and the `?raw` scan's two needles land in **one** change: extracting the marks while `FigureCell`
  still declares them locally, or deleting a widget's `MONO` while the scan is not yet extended, leaves
  the phase's central guarantee unenforced in a green build. That coupling is intended, not a surprise.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/curvature-v2-surfaces/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** this phase is **`NO_BACKEND_CHANGE`** — the `apps/api` diff is
empty, measured **three-dot** (`git diff origin/main...HEAD -- apps/api`, criterion 67), and no
endpoint, payload field, query parameter, route, persistence shape, score input or streaming behaviour
changes. The surfaces consume existing read-only wire unchanged: `GET /api/scan` (the sweep behind every
scanner figure — pinned in that file) and `GET /api/stream/prices` (SSE, the price overlay — its parsed
shape is documented there and is **not** machine-checkable, because the runner does not read event
streams). Mutating and session-bound surfaces the pages also touch — `PUT /api/scan/view`, the broker
book and credential reads, the positions page's ticker stream — are **deliberately not pinned**, and
that file says why for each. The durable client stores this phase touches, their keys and the loss-free
rule are named there too. The authoritative field list and the machine-checkable conformance block live
in that file and are **not** restated here.

## 7. Testing strategy

Risk-based: automate what regresses **silently and invisibly**; verify visible or intentional behaviour
by review.

**Tiers.** Unit/component (jsdom, Vitest) for the module's nine states, register resolution, closed-nine
membership, the Net P/L state set and the alerts store's read/write paths. Integration mocks **the
network boundary only** — the scan poll, the price SSE, the ticker SSE, the broker reads — never a
component. Browser (Playwright) for overflow, container stepping, touch targets and colour scheme.

**Invariants that must never silently regress**

1. **One liveness answer.** The `LiveClaim` brand on every claim prop (compile-time), plus the widened,
   mutation-guarded banned-name scan with live-checked EXEMPT entries (criterion 6). A stale exemption
   red-builds.
2. **One register decision.** The `?raw` scan of criterion N-1, extending the shipped, already
   mutation-guarded scan rather than minting a new one — no closed-nine member in a mono-bound `sx`, no
   font-family literal outside the tokens module and the shared figure module.
3. **The two offline arms**, on both surfaces, each keyed on the DOM marker at the cell testid — never
   assuming co-location with `data-figure-register` (§2.1).
4. **The closed nine stays closed** — membership, non-synonymy against three shipped testids, Sans
   always, no tenth literal.
5. **The container step fires**, proven by a **rendered** assertion at a narrowed container width. A
   rule-presence assertion is explicitly not sufficient and no criterion claims a jsdom proof of
   stepping.
6. **The durable stores are loss-free** — read-new-else-old, never-delete, never-throw, verified against
   a blob written before the phase, with the alerts read-fault latch covered on both its arms (the
   corrupt read **and** the refused write).
7. **No horizontal overflow on seeded pages**, proved by the suite's **executed** case list.

**Two execution traps that make a green suite lie**, both live here. `playwright.config.ts` is an
explicit `testMatch` allowlist — an unregistered spec **never runs and reports green**, so execution is
proved with `--list` (criterion 63). And e2e runs against the **production build**, never the dev
server, after `npm run ports:free` on **both** address families.

**A third trap specific to this phase:** the shipped e2e `seed()` takes `{ scheme, positions }` only, so
`/alerts` is measured empty and `/scanner` is measured with a possibly-zero row count. Extending
`seed()` with an alerts blob at `ALERTS_KEY` and a scan-row guarantee, plus pre-measure count
assertions (the idiom the positions cases already use), is **required work**, not optional — without it
criterion 62 is green on empty pages.

**Desk churn is measured here, not discovered at GATE Q.** D-C reopens the desk for one shared-frame
change; U-32 re-runs the desk's own shipped specs — a11y tree, focus order, single-motion-moment, live
dot census — inside the criterion.

**Reviewed rather than automated:** 7b, 15, 43, 47c, 56, 60, 63, 69, U-15, U-19, U-24, U-27, U-37 —
pinning those strings or that composition in assertions buys nothing a reviewer does not already give,
and this phase promises not to change them.

## 8. Guardrails this feature must not break

From the BRIEF's invariant watch, restated with **where each one bites**:

- **`[live-vs-static-isolation]` / ledger key `one-liveness-predicate`** — bites at criterion 6 (the
  widened fence and the deleted `genuineIsLive`), at 11A (no scanner mark in any state, **OWNER —
  D-A**), at 5 and 10 (no page-level or widget-level claim), at 58 (the quiet band wears none) and at
  42 and 49 (settings and alerts wear none). The BRIEF's "scanner and positions are snapshot surfaces"
  is corrected: liveness belongs to the **datum**, and the scanner's answer this phase is *no datum
  claims it*.
- **`[absent-is-not-none]`** — bites at 3, 4, 17, 46, 47d and 56a, and hardest at 24/25, where the
  three positions-side members must stay non-synonymous, asserted by **three fixtures reaching three
  arms**. No tenth member: `not set` was checked against `notANumber.ts:26-36` and **is** a member;
  `level` and `unavailable this cycle` are not, and both are removed from value slots.
- **`[ai-asserted-numbers-are-traceable]` + `[digested-labels-not-raw-dump]`** — bite at 1 (the register
  is how authorship renders), at 45 and U-23a (labels come from closed lookups, never re-derived from a
  scalar) and at U-6 (a lookup miss is a named state, never a guess and never a raw enum).
- **`[theme-token-discipline]`** — bites at 64 and U-35. Note that phase 2 extended
  `hex-discipline.spec.ts` to catch `rgb(a)` literals and narrowed its exemptions to **per-value**, so a
  whole-file waiver is no longer available, and these four surfaces are already inside its glob: a new
  hardcoded colour is build-breaking **today**.
- **`[structural-over-prose-enforcement]`** — bites at 2, N-1, 7a and 69. Every rule this phase lands
  ships as a scan or a type with a poison run that goes red and an anti-vacuity assertion. Phase 1
  shipped two `expect(true).toBe(true)` bodies under a "MUTATION PROOF" heading; that is the failure
  69 exists to catch.
- **`[single-shared-sim-entry-dialog]` + `[no-real-order-path]`** — bite at 34: the Broker tab stays
  read-only with no entry, order or cancel control, and the one entry affordance opens the single shared
  `TradeEntryDialog` as a variant, never a fork.
- **`[additive-keeps-score-byte-identical]`** — bites at 67. Nothing on these surfaces is a scoring
  input; the Net P/L readout was verified at source to be page-local and purely presentational (§2.2).
- **`[loss-free-durable-migration]` — the sharpest risk on this surface set** — bites at 51, 52, 70 and
  N-5. No key and no shape changes; the one repair is a **read-path** guarantee. `convexa.uiprefs.v1` is
  untouched, which is also why criterion 39 forbids importing the canvas's account-persistence footnote.
- **`[cited-code-is-verified-not-assumed]`** — bites on this document. Where `decisions.md` summarises,
  the signed R3 text was read for the exact wording; six facts were re-read at source for this
  synthesis, and two of them changed what is written here: `not set` **is** a member of the closed nine
  (`notANumber.ts:30`), so no substitution and no Amendments line is needed; and the Net P/L sum is
  consumed only by its own render (`PositionsPage.tsx:189,193`), which answers pm's open ask.
- **`[best-effort-isolated-or-null]`** — bites at 16, 57 and §5: a dropped stream never blanks a row,
  and an unavailable widget never degrades a neighbour.

## 9. Open questions

1. **The scanner's cadence *gloss* still says "Prices stream live." and D-A's closed set does not reach
   it.** Read at source for this synthesis: `labels.ts:26-29` (`cadenceGloss`, rendered on the page at
   `Scanner.tsx:145`) opens *"Prices stream live."* — a second page sentence asserting liveness, in the
   same constant object as the header D-A reworded. **No voice cited it**, so the owner ruled a closed
   set of one sentence without this fact. Under the ruling as written the gloss **stands**, and no
   criterion in §3 claims otherwise — criterion 15 and CF-1 are scoped to the header. The file's own
   comment (`labels.ts:4-9`) records that two neighbouring clauses already shipped with the banned token
   removed and their meaning intact, so a one-clause repair has a ready form and a shipped precedent.
   **This is an owner call at GATE Z: extend the closed set by one sentence, or carry the gloss as debt
   with the citation.** It is one constant either way.
2. **The e2e seeding work is required by criterion 62 and is not yet sized.** Extending `seed()` with an
   alerts blob and a scan-row guarantee is the difference between a headline responsive criterion and a
   green run over empty pages. It is named as required (§7), but it is the item most likely to be
   deferred under time pressure, and deferring it silently invalidates 62 and 63.
3. **Amendments question filed, not answered: does the canon's Icons row colour-emoji clause reach
   `U+26A0` in a chip label?** ux withdrew U-7 on the canon as written — the Icons row names exactly two
   typographic truth marks and `⚠` is neither, while rule 5 and `labels.ts:196` make the glyph the
   deliberate mechanism. The hazard ux saw is real (the Icons row's own reasoning about colour-emoji
   rendering applies to `U+26A0` exactly as it does to `⏸`), but it is an **Amendments** line for the
   owner with `labels.ts:196,205,211` attached — not a criterion this phase may assert. The chips ship
   byte-identical.
4. **`not recorded` on a fourth surface is stated as settled here and is the skeptic's to test.** §4.5
   applies canon rule 24's own *"per-surface subset, not a second vocabulary"* clause, on the ground
   that the shipped alternative is the bare word `level` — a tenth literal outside the closed set. If the
   skeptic reads rule 24's *"ship on the positions and broker surfaces"* as exhaustive rather than
   descriptive, this becomes an **Amendments** line and criterion 47d's absent arm re-points to a member
   already licensed on alerts.
5. **The conductor's call on the hover-only tips (U-15a) is reversible until the build lane starts.**
   Reversing it is a spec edit, not a rebuild: U-15a is removed and the defect lands in carried debt with
   `PositionRow.tsx:147-151` attached. It is recorded here so a reader can tell it from the four owner
   rulings, which are not reversible by the same route.
6. **The canon amendment queued for GATE S is one clause and must not widen at close-out.** Rule 13
   becomes *"traced to Convexa's computation **or to a record the trader entered**"*. Phase 2 landed four
   amendments and the skeptic's standing check applies: verify none of them widens beyond its stated
   clause.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"6c2cf2c5e93575614599ab70258ced726ec21b5b55f570477ba3ecc4d14cded4","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"d09285682d4490f06fc76ed83d39d867b63b029563280f733b7604c84c1b48a6","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"cbef7514e4f4d78dbe8d130859c845c98f464b1980353a9bff26184e390eab38","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"b0f85405a787d1728f858066f4a117e8c5e9b4ff2f4f9a7f024b7c857e2f0a17","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":4,"conflict_id":"50ef9a81beb6c8cd5a2d6899d7fec0c385d9267cbe4e672a2eafcfbeb4ef4da5","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":5,"conflict_id":"fac0c6c7cb9d520bed8cd172d20621a41cbb9dc6c8e403c6fa76d7361bf13303","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":6,"conflict_id":"db0bcfc326c947b21aaabf909014cb358d08993e3ee249ce6912f7470d0d4849","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":7,"conflict_id":"8ba032e3b5182d3fa9d37d5366463a8d5c744786ac49def808a374f5b53e9d7b","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":8,"conflict_id":"2c93136ce62c937e4d523a88e246921fc732d1d43ae424e232c407fbeac7f54e","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"faf6bdeea68ca330fb0ec69ddc959c2f2cde9b33d1c27fd1c60ffa42b27d3996","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":1,"conflict_id":"f81c19bae589857ec75639d1474a2787f03d93eb8c346901ef30f94d2bfbacc8","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":2,"conflict_id":"a3216467da2136193323c885d477a9bffcd78fe6c5f36e06e99ab31835e60339","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":3,"conflict_id":"eebd259eca1f92682e5e9d916b09d21c56c93367a9186e2572a906b9a3d30cf9","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":4,"conflict_id":"1f765d5bd84f31321e34e0403952a4cdf369e6cb1f05c30cc74de1f2c0fb219c","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":5,"conflict_id":"d000b908a8a2d352ef7c18efcbc1b63ea54cb8794b9d1412cd04a88d84957f5b","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":6,"conflict_id":"65bd9b07f217cdbe9cb38ea758360b3d3cf3fd0b53b7102a6365aff22958b24f","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":0,"conflict_id":"7da0330a44483301c998f19632bec0a5c147878ed449e89b297191331a0b090d","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":1,"conflict_id":"66cd71c1073343c1d28610a3a99270ffd80a1ebe3926d7f866e6aea77ca92557","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":2,"conflict_id":"918e6655610811bcf259e38e34d95236f39cb8228e0d36f31ff198a739bf4006","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":3,"conflict_id":"ae1248895375efba2db214ba22c43a8a3b6fed751d82b839e0ac8e8416d392a9","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":4,"conflict_id":"3dba77c9ca6f8fb70f14c9dfb1f37e8b4ff5c8e2a46aff0e85db8767c084d5c8","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":5,"conflict_id":"154fb2122f510075e58a1dbef185abb14ce4af91eeb519a3f0483a60a2197773","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":6,"conflict_id":"77667a5927811e72e01a8f47e963f87b338200d2e1b57748d119aeeb35b1a7be","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":7,"conflict_id":"338807da910a82d14a08017f624036f616802f14d023d5e8c469341a401cc2f0","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":8,"conflict_id":"1eee801a384f28f17b062101b1c2776f350b2955a0ae42d5876f55871d5e1ddf","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":9,"conflict_id":"7374669048f7e8a04a8ce276b1bef3c6ee9589dd0c558862cec0f93d8c0955cd","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":10,"conflict_id":"4f915a4ad0c90fc3bac8a153606c3d2aab488976872efbef3b6f1dd0ca68adb6","disposition":"folded","section":"§2"}]}
-->
