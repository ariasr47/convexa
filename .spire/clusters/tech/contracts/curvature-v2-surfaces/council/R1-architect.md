# R1 — architect position: curvature-v2-surfaces

> Every code fact below was **read at source in this session** and is cited `file:line`
> (`[cited-code-is-verified-not-assumed]`). Where I could not read a fact, it carries `[lane-check]`
> and is stated as an assumption, not asserted. Paths are relative to `apps/dashboard/src/app/`
> unless the citation says otherwise.

## Position

### 0. Binding constraints I restate (they govern every section below)

**Domain / math — untouched by construction.** This phase computes nothing. `opportunity_score`,
`opportunity_tier`, `state_fingerprint`, the two gamma sources, the ±20% / 100-pt flip grid, the
`MIN_GREEK_T = 1/365` floor and every window rule stay byte-identical, and the enforcement is a
module boundary, not a promise: nothing on these four surfaces is a scoring input.
`[additive-keeps-score-byte-identical]` · `[score-change-is-deliberate-and-measured]` (this is **not**
the deliberate-change feature). Measured as an empty three-dot `apps/api` diff.

**Promoted build invariants this phase touches, each with the mechanism that holds it:**

| Key | Mechanism, named |
|---|---|
| `[one-liveness-predicate]` / `[live-vs-static-isolation]` | `shared/liveness/liveClaim.ts:17-29` — a `unique symbol` brand no `&&` chain can inhabit; the only mints are `isDeliveringLive` (`:47`), `andPresent` (`:60`), `NOT_LIVE` (`:29`). §4 below is entirely about extending its **reach**, not its **arity**. |
| `[absent-is-not-none]` | `shared/copy/notANumber.ts:26-38` — nine-member `as const` union + `isNotANumber` (`:41`). `FigureCell.tsx:250,284-288` branches on membership: a literal is always Sans, never a figure, never steps. |
| `[loss-free-durable-migration]` | `shared/lib/durable/resolveDurable.ts:28-49` (new-wins → promote-forward-once → never-delete → never-throw) and `positions/migrate.ts:58-65` (`aborted` forbids writing v3 when any source is unread). §5. |
| `[theme-token-discipline]` | `shared/theme/hex-discipline.spec.ts:20-24` globs `pages/**`, `features/**`, `shell/**`, `shared/ui/**`, now catches `rgb(a)` too, exemptions narrowed to **per-value** (`:80-83`). The four surfaces are already inside the glob — a new hardcoded colour is build-breaking today. |
| `[structural-over-prose-enforcement]` | Every rule this phase lands ships as a scan or a type, with a mutation proof and an anti-vacuity assertion — the shape `liveClaim.spec.ts:118-144` and `type-floor.spec.tsx:130-165` already use. |
| `[single-shared-sim-entry-dialog]` + `[no-real-order-path]` | Positions entry stays the one `features/trading/TradeEntryDialog`; the Live tab's zero-import lock is untouched. Non-goal 8/9. |
| `[digested-labels-not-raw-dump]` + `[ai-asserted-numbers-are-traceable]` | The wire enum is authoritative; a label comes from a closed lookup. Shipped on the scanner already (`ScanCells.tsx:161-171`, `:173-174` — a lookup miss renders the literal, never the raw enum). Do not regress it. |
| `[cited-code-is-verified-not-assumed]` | This document. |

---

### 1. Five corrections to the BRIEF, read at source

The BRIEF asked for this. Three of its five "read at source" facts hold; two of its scoping
statements do not, and both change what the phase is.

**C1 — the scanner is NOT a snapshot surface.** "Invariant watch" says *"Scanner rows and positions
rows are **snapshot** surfaces and must never wear a live mark."* The scanner ships a real SSE:
`pages/scanner/useLivePrices.ts:39-95` opens `EventSource('/api/stream/prices?symbols=…')` (`:57`),
merges per-symbol prices (`:73`), and runs a 45s silence watchdog (`:37,84-86`).
`Scanner.tsx:115,119-126` overlays those onto the polled rows. The page already makes a **page-level
liveness claim in prose** (`Scanner.tsx:144` selects between two strings; `labels.ts:25` reads
`'Prices live · structure ~3 min · hot names sooner'`). The scanner is a **mixed** surface — polled
structure, streamed price — and `useScan.ts:9` says so. The honest rule is **per-column, not
per-surface**.

**C2 — settings has no rail.** BRIEF (e) says *"the **settings rail → tabs at 900**"* is brought
under responsive discipline. `features/auth/SettingsPage.tsx:156` is
`<Container maxWidth="sm" sx={{ py: 4, maxWidth: 640 }}>` — a single centred 640px column of stacked
`PanelCard`s (`:54-73`). There is no rail to collapse. "Rail → tabs at 900" is **net-new
construction of two layouts**, not a responsive fix.

**C3 — the eight quiet-band widgets are not eight equivalent conversions.**
`term-structure/TermStructure.tsx:18-58` renders a canvas chart and a subtitle and has **zero
figures**; its only vocabulary use is `'—'` interpolated *into a subtitle sentence* at `:26-27`.
`setups/Setups.tsx:38` renders names. Six of the eight declare a local `MONO`
(`straddle-move:31`, `market-context:112`, `off-exchange-blocks:24`, `dealer-flow-projection:49`,
`iv-rank:64`, `fresh-positioning:15`). The deliverable is a **property** ("no untraced figure renders
mono; every figure that exists steps"), not a count of eight.

**C4 — positions already conforms to rule 24; the scanner does not.** BRIEF says the positions
surface is where the three literals "must stay non-synonymous". They already do:
`positions/PositionRow.tsx:145-153` is a single `literal()` renderer — `variant="body2"` (Sans),
`color: 'text.disabled'`, a tooltip, differing by text and testid only, with the comment at `:139-144`
stating exactly why it is one function. The **scanner** is where the inversion lives:
`ScanCells.tsx:51-61` renders the em-dash with `...MONO`, and so do `:193` and `:224`. Today every
absent value on `/scanner` renders in the **mono figure register** — the precise inversion ruling 3
exists to prevent. The vocabulary work is scanner-side.

**C5 — BRIEF facts (1)–(5) hold.** Zero `FigureCell` on the four surfaces and zero in the eight
widgets (confirmed: the only importers are `live-tape/LiveTape.tsx:40`, `read-strip/ReadStrip.tsx:27`,
`level-ladder/LevelLadder.tsx:25`, `level-ladder/LadderFoot.tsx:14`). `StatTile` is gone
(`_kit/index.ts:7`). Settings is at `features/auth/SettingsPage.tsx`. `ALERTS_KEY =
'convexa.alerts.v1'` at `features/alerts/types.ts:47`; `AlertsPage.tsx` is 242 lines.

---

### 2. Component boundaries — where `FigureCell` may and may not go

**2.1 `FigureCell` promotes to `shared/ui/` this phase; `_kit` re-exports it.**
It lives at `pages/ticker/widgets/_kit/FigureCell.tsx` today. `pages/scanner` importing it is a page
importing a sibling page, forbidden by `README.md:4-6`; `features/trading/positions` importing it
inverts the binding downward-only direction. **This is not a new argument — it has been settled twice
already, in this exact form**: `shared/copy/notANumber.ts:18-23` records the union moving to
`shared/` because `features/` → `pages/` inverts the direction, and `shared/liveness/liveClaim.ts:9-13`
records the predicate moving for the same reason. The mechanism and the precedent are identical:
`_kit/index.ts:2-5,12-13` already promoted `TintChip` and `useFlashOnChange` when `/scanner` became
their second consumer and re-exported them so every ticker import path stayed byte-unchanged. Do the
same, once, and every `_kit` importer's diff is zero.
Barrel-exporting it is safe: `shared/ui/PanelContainer.tsx:8-9` states the rule — a component with no
importer-set pin may sit in the barrel; only pinned modules (`arc.ts`) must stay out.

**2.2 The scanner's 11-column table does NOT carry `FigureCell` per cell — and neither does its card
fallback.** This is the BRIEF's load-bearing question and the answer is structural, not a density
judgement:

- `FigureCell.tsx:303-329` renders a `<Card variant="outlined">` (`:72-106`) with a label row, a body
  and a caption row, plus a hover `translateY(-2px)` lift (`:94-101`).
- `ScanTable.tsx:257-265` renders each datum in `<Box component="td">` with `whiteSpace: 'nowrap'`
  (`:240`) and a `position: sticky` first column (`:79`). A card with `overflow: 'hidden'`
  (`FigureCell.tsx:77`) inside a sticky `<td>` clips the sticky column. The table also **already
  satisfies rule 13's anatomy by a different mechanism**: the column header *is* the label row
  (`ScanTable.tsx:107-145`), so a per-cell card would duplicate the label 11 times per row.
- `ScanCard.tsx:54-73` — **the whole card is one `<a>`** (`component={RouterLink}`), pinned by
  `no-overflow.spec.ts:938` (`scan-card` first has `href='/ticker/SPY'`) and motivated by
  `[no-real-order-path]` (`ScanCard.tsx:5-8`). `FigureCell.tsx:307` mounts `AccessibleHelp`, which is
  a **real focusable `button`** (`FigureCell.tsx:26-28`). A `<button>` inside an `<a>` is interactive
  content nested in a link — invalid, and a real keyboard/announcement defect. Putting `FigureCell`
  in the card means **deleting the single-anchor navigation contract** and re-writing the pinned e2e.

**Therefore: `FigureCell` never enters `/scanner`.** What enters is the **decision**, not the
component. Mechanism: extract the register-and-vocabulary branch that `FigureCell.tsx:250,284-300`
computes today into a **pure module** (input: `register` + `value`; output: mono-vs-sans, figure-vs-
literal, and the container-step declaration), which `FigureCell` calls and which the `ScanCells.tsx`
atoms call. This is the surface's own stated principle applied one level up — `ScanCells.tsx:1-8`
already says *"a datum is rendered exactly ONE way on this surface and the two layouts can never
drift"*; the extraction makes that true **across** surfaces instead of within one. Enforcement:
a `?raw` source scan asserting no file under `pages/scanner/` or `features/trading/positions/` names
a font family directly, with the mutation proof and the anti-vacuity assertion `liveClaim.spec.ts:118-129`
already models.

**2.3 Positions: the table keeps its atoms, for the same reason plus one more.** `PositionRow.tsx`
cells sit in a table. Converting `literal()` (`:145-153`) to `FigureCell` **destroys the tooltips that
make non-synonymy observable** — `NOT_RECORDED_TIP`, `ROW_UNAVAILABLE_TIP`,
`MAX_LOSS_WITHHELD_META[reason].tip` (`:499-514`) — because `FigureCell.tsx:302-329` exposes help only
on the **label** (`About {label}`, `:307`) and renders only a caption beside the value. A conversion
that removes the only affordance distinguishing `not recorded` from `unavailable` would ship an
AC that reads green while the distinction went invisible. Positions' figure conversion is therefore
scoped to its **panel-shaped** figures (the page header readout, the subtotal/summary blocks), never
its table cells. `[lane-check]` — whether `PositionCard.tsx` is an anchor like `ScanCard` is: I did
not read its root element; if it is not, the card layout is a valid `FigureCell` host.

**2.4 The eight quiet-band widgets convert IN PLACE.** Mechanism, not preference: all eight already
mount inside `Widget` (`iv-rank/IvRank.tsx:36`, `fresh-positioning/FreshPositioning.tsx:8`,
`dealer-flow-projection/DealerFlowProjection.tsx:22`, `setups/Setups.tsx:7`,
`market-context/MarketContext.tsx:31`, `term-structure/TermStructure.tsx:5`,
`off-exchange-blocks/OffExchangeBlocks.tsx:10`, `straddle-move/StraddleMove.tsx:12`), and
`shared/ui/Widget/Widget.tsx:180` already sets `{ containerType: 'inline-size', containerName: 'panel' }`.
The named container the steps query (`FigureCell.tsx:216-221`,
`theme.containerQueries('panel').down(360|280)`) **already surrounds them**. The step arrives with the
primitive; no `@container` is authored in any widget, which is what `MarketContext.tsx:439-442`
explicitly deferred to "a later phase's rebuild" — the rebuild turns out to be a swap.
Ruling 6's layout freeze ("the four widgets keep their current layout") **survives its own reason being
corrected**: OVERNIGHT_DECISIONS' D-5 correction overturned *why* they were excluded, not the freeze.

**The one hazard that makes the steps dead on arrival.** The container is the **panel**, not the
cell. `MarketContext.tsx:443` lays four cards across one `Widget` at
`repeat(auto-fit, minmax(210px, 1fr))`; a 900px panel holding four 210px figures never fires a 360px
step. `ReadStrip.tsx:7-13` names this hazard in shipped code and `:54` ships the fix: wrap each
figure in its **own nested `PanelContainer`** (`shared/ui/PanelContainer.tsx:24-30`) — same name,
nearest-ancestor wins, never a second container name. Any converted multi-figure widget takes the
same wrapper or its steps are declared and never fire.

---

### 3. Data-structure content (no new wire shape, no new durable shape)

| Structure | Content this phase relies on | Source |
|---|---|---|
| `NotANumber` | Nine string literals, closed by `as const`; `isNotANumber` is the only membership test. **The type enforces closure, the caller picks the member** (ruling 3). | `shared/copy/notANumber.ts:26-48` |
| `LiveClaim` | `boolean & { [unique symbol]: 'delivering-live' }`. Three producers, all in one module. | `shared/liveness/liveClaim.ts:17-62` |
| `FigureCellProps` | `register` required with **no default** (`:160-166`); `value: string \| NotANumber`; `live?: LiveClaim`; `offline?: { retained: boolean } \| null` — `retained` is the **only** thing licensing the last-known clause (`:171-174`, ruling 2); `replay?`, `caption?`, `assertedBy?`. Nine states F1–F9 with `data-figure-state` markers. | `FigureCell.tsx:158-185,250-300` |
| `AlertsState` | `{ schema_version: 1, rules: AlertRule[], events: AlertEvent[], notifyBrowser: boolean }`; `ALERTS_MAX_EVENTS = 100`. | `features/alerts/types.ts:39-48` |
| `LivePricesState` | `{ prices: Record<symbol, {price, ts}>, offline: boolean }` — **no `market_session`, no wire `live` flag**. This is §4's whole problem. | `pages/scanner/useLivePrices.ts:24-34` |
| Durable inventory (7 keys, none changing) | `convexa.positions.v3` (`positions/store.ts:60`) reading `…v2` (`:61`) + `…ghost-trade.v1` (`:62`) as sources; `convexa.orders.v1` (`orders/store.ts:19`); `convexa.personas.v1` (`personas/store.ts:9`); `convexa.uiprefs.v1` (`auth/localPrefs.ts:15`); `convexa.recent-tickers.v1` (`recentTickers/store.ts:9`); `convexa.alerts.v1` (`alerts/types.ts:47`). | as cited |

Radius content, since `[theme-token-discipline]` and ruling 4 both bear on it: `shape.borderRadius`
is now **12** (`shared/theme/tokens.ts:93`), and a numeric `borderRadius: n` inside `sx` resolves to
`n × 12` (mechanism recorded at `tokens.ts:86-91`). Two sites on this phase's surfaces are off the
declared ladder {panel 12 / dialog 16 / control 8 / pill 999}: `SettingsPage.tsx:67` `borderRadius:
2.5` → **30px**, and `ScanTable.tsx:290` / `ScanCard.tsx:70` `'10px'` string literals, which did
**not** scale with the phase-1 migration and now sit 2px below the declared panel role.

---

### 4. The ONE liveness predicate, on surfaces the fence does not currently reach

**4.1 The fence is real but its glob stops at the ticker widgets.** `liveClaim.spec.ts:68-75` globs
**only** `/src/app/pages/ticker/widgets/**`. Its `BANNED` list (`:78`) includes `/\bgenuineIsLive\b/`.
Three production files outside that glob call `genuineIsLive` today:
`pages/positions/PositionsPage.tsx:31,88`, `features/trading/orders/engine.ts:22,50`, and
`pages/ticker/liveTapeStore.ts:70`. `liveClaim.ts:41-43` names `genuineIsLive` as **exactly the wrong
answer** — *"that one does not check `market_session`, so it reads `true` while the venue is closed
and the wire's `live` flag is stale-but-true"*. So `/positions` currently answers "is this live?" with
the predicate the canon predicate exists to replace, and no test can see it.

**Required, or the phase certifies `[one-liveness-predicate]` on surfaces the scan never reads** —
the same failure shape ruling 6 caught ("certified as passing on a page where it demonstrably
fails"). Mechanism: widen the `liveClaim.spec.ts` glob to `pages/scanner/**`, `pages/positions/**`,
`pages/alerts/**`, `features/trading/positions/**`, `features/auth/**`; keep the existing
mutation guard (`:124-129`) and the live-checked `EXEMPT` idiom (`:131-135`) so a stale exemption
red-builds; seed exemptions only for what this phase does not fix, each naming the phase that does.

**4.2 Positions converts by DELETION, not addition.** `PositionsPage.tsx:114-128` already opens a real
`streamTicker` SSE and holds `live: LiveUpdate | null` (`:85`) and `streamOffline` (`:86`) — precisely
the two arguments `isDeliveringLive(live, streamOffline)` takes (`liveClaim.ts:47`). The conversion is:
replace `genuineIsLive` at `:88` with `isDeliveringLive`, thread the resulting `LiveClaim` down instead
of a raw boolean. One predicate leaves the tree; none arrives.

Second, smaller, in the same file: the header readout at `:181-194` dims on
`opacity: streamOffline ? 0.5 : 1` (`:190`) with **no pause marker and no basis clause**, and its sum
at `:147-154` skips rows whose `pl_dollar` is null. If a drop can null a contributor, the number
silently changes meaning while keeping its label — the same class as phase 2's `LiveTape.tsx:96,190`
defect. `[lane-check]` — `composeMark.ts:14` claims a drop resolves every leg to `last_known` (a
resolved basis), which would make the sum stable; I did not read the resolution path far enough to
assert it. **If** it holds, the readout needs the pause marker and nothing else; if it does not, it
needs retention. Either way the branch must be on the `LiveClaim`, never on `streamOffline` alone.

**4.3 The scanner: I take the under-claiming position, and I name what it costs.**
The scanner's price column is genuinely stream-derived, so rule 13 would license a per-figure dot.
But `isDeliveringLive` is typed to `LiveUpdate` and `useLivePrices.ts:69` parses the frame as
`{ prices?: Record<string, LivePrice> }` and nothing else — no `market_session`, no wire `live` flag,
no session-tape field. The predicate's true arm (`liveClaim.ts:52`, `live.market_session !== 'closed'
&& live.live === true`) is **not computable** from what the scanner receives.

Three options, priced:

| Option | Cost | Verdict |
|---|---|---|
| **A. Price column renders `NOT_LIVE`; no per-figure dot on `/scanner` this phase.** The existing two-speed prose basis (`Scanner.tsx:144`) stays as-is. | The surface **under-claims** — a real live price rendered as not-live. | **My position.** Under-claiming is the direction canon rule 22 and the Banned table both choose; over-claiming is the honesty failure the system exists to prevent. Zero new mints. |
| **B. Add a second mint in `liveClaim.ts` for the prices stream.** Keeps one module and one brand. | Produces **two answers** to "is this live?". The brand makes a claim unforgeable; it does not make two predicates one. `liveClaim.ts:4-7` records phase 1 FAILing GATE Q with a fully green suite for exactly this. | Reject. |
| **C. Normalise the prices frame into `isDeliveringLive`'s two arguments.** | Requires `market_session` and a wire `live` flag on `/api/stream/prices` — a **backend change**, which the BRIEF forbids and which would break the empty-`apps/api`-diff feasibility claim. | Reject this phase; it is the honest phase-4 or later option. |

**If PM or UX require a live mark on the scanner price, they are choosing option C and reopening
NO_BACKEND_CHANGE.** That is the trade, stated so R2 can attack it rather than discover it.

---

### 5. Isolation and error rules

1. **No durable key or shape changes this phase.** `[loss-free-durable-migration]` is satisfied by
   not creating the surface it governs. Any new persisted preference a converted surface wants is a
   GATE-Z bounce, not a lane decision.
2. **A named, verified hole in `convexa.alerts.v1` that the phase must decide about, not discover.**
   `alerts/store.ts:51-70` does **not** use `resolveDurable`; it hardcodes `schema_version: 1` on read
   (`:61`) regardless of the blob's own value; and — the actual loss path — a parse failure degrades
   to `empty()` at `:66-68` (correct so far: nothing is written), but the **next** `upsertRule` /
   `pushEvent` / `setNotifyBrowser` calls `persist` at `:41-49`, which `setItem`s the empty state
   over the **same key** the corrupt blob occupies. `resolveDurable.ts:12` guarantees "never delete
   old" only because it reads an old key and writes a new one; the alerts store reads and writes one
   key, so the guarantee does not apply. Positions avoids this structurally
   (`migrate.ts:58-65`: `aborted` forbids writing v3 while any source is unread).
   **Mechanism if it is in scope:** a read-fault latch — once `readAlerts()` takes the catch branch,
   `persist()` refuses to write to `ALERTS_KEY` for the session, mirroring the shipped `faulted`
   posture (`PositionRow.tsx:122-127`: nothing dims, every write affordance refuses, still focusable).
   Whether to fix it here is a **product call**: it is a real data-loss path on a surface the BRIEF
   calls "the least likely to need re-composition", and the loss is silent, total and irreversible —
   the exact severity that promoted the key at one instance.
3. **Best-effort isolation is already correct on the scanner and must not regress.**
   `useLivePrices.ts:79-82,88-91` never throws, never blanks, auto-reconnects, closes on unmount;
   `Scanner.tsx:119-126` overlays and never replaces. `[best-effort-isolated-or-null]`.
4. **Two shipped v2 violations on these surfaces that a figure-only framing would miss.**
   (a) `AlertsPage.tsx:217-222` gives each event row `borderLeft: 3` with
   `borderColor: e.read ? 'divider' : 'primary.main'` — read/unread carried by a **coloured edge and
   nothing else**, which is the Banned "accent-bar … state carried by a coloured edge" anatomy applied
   to a row, and it spends brand amber on a status. It is not a figure, so "every figure becomes a
   `FigureCell`" ships past it.
   (b) `ScanCells.tsx:51-61,193,224` render the em-dash in `MONO` (C4 above).
5. **e2e vacuity on the surfaces this phase claims.** `no-overflow.spec.ts:520-522` — `seed()` takes
   `{ scheme, positions }` **only**. `/alerts` is in `ROUTES` (`:419-423`) and walked at 393 both
   schemes plus 834/900/1280 dark (`:47-54`, `:1017-1039`), but with **no rules and no events seeded**
   it measures `AlertsPage.tsx:161,207`'s empty states. `/scanner`'s wide-band walk asserts only
   `scanner-page` attached (`:411-414`) — a zero-row scan passes; the phone case *does* guard
   (`:936` `toHaveCount(3)`). Mechanism: extend `seed()` with an alerts blob at `ALERTS_KEY` and a
   scan-row guarantee, plus pre-measure count assertions — the exact idiom `:948-957` already uses
   for positions. Without it the phase's headline overflow criterion is green on empty pages.
6. **Type floor and hex discipline already cover these surfaces.** `type-floor.spec.tsx:88-97` and
   `hex-discipline.spec.ts:20-24` both glob `pages/**` + `features/**`. Nothing new is needed; the
   claim "these surfaces were unguarded" would be false.

---

### 6. Explicit non-goals

1. **No backend change.** Empty three-dot `apps/api` diff; score/tier/fingerprint byte-identical.
2. **No new durable key and no shape change** to any of the seven `convexa.*` stores (§3).
3. **No second liveness predicate and no widening of `isDeliveringLive`'s domain** (§4.3, option B/C
   both rejected this phase).
4. **`FigureCell` does not enter `/scanner`** — neither the table nor the card (§2.2). The register
   and the vocabulary do.
5. **Positions' table cells keep `literal()`** and its tooltips (§2.3).
6. **No re-layout of the eight quiet-band widgets** — ruling 6's freeze stands; conversion is a swap
   plus a nested `PanelContainer` (§2.4).
7. **`features/trading/broker/` is untouched.** It already carries the non-synonymous literals
   (`broker/brokerView.ts:47,58,123-127`; `BrokerPositionRow.tsx:70,135-141`) and is outside the four
   named surfaces.
8. **No fork of `TradeEntryDialog`**; sim entry stays the one shared dialog as a variant.
9. **The Live tab's zero-import lock is untouched**; nothing here approaches a real order path.
10. **No new motion.** No new keyframe family, no fourth arc spend; the hero curve-draw remains the
    one orchestrated moment.
11. **Phase 4's work stays phase 4**: landing, site/blog, the responsive sweep, the curve
    text-equivalent (DELEGATED P1), the spacing-exemption remainder. **The ticker desk is not
    reopened.**
12. **The settings rail is not built** as stated in BRIEF (e) — see C2 and Risk 4.

---

## Risks I see

1. **The `FigureCell` promotion is the phase's single point of failure.** Every other conversion
   depends on it landing first and landing once. If two lanes each need it and neither owns the move,
   one of them will reach across the `pages/` boundary "just for now" and the dependency rule dies
   quietly — there is no lint rule at folder granularity, only the README convention
   (`README.md:4-6`) and reviewer attention. Mitigation: the promotion is task one, with a source scan
   asserting no file outside `pages/ticker/` imports from `pages/ticker/widgets/_kit/`.

2. **The container steps can ship declared and dead.** `FigureCell.tsx:216-221` declares them against
   the **named panel container**, which on a 4-across grid inside one `Widget` is the whole widget
   (`MarketContext.tsx:443`). A conversion that skips the per-figure `PanelContainer` wrap produces a
   green build, a green `type-floor.spec.tsx` (which only asserts the declaration exists,
   `:12`, `:60-84`), and figures that never step at any width. **No shipped test would catch it.**
   Mitigation: a rendered assertion at a narrowed container width, not a rule-presence assertion.

3. **The register extraction (§2.2) is the riskiest refactor in the phase.** Pulling the
   mono/sans + figure/literal decision out of `FigureCell` touches the primitive 16+ desk call sites
   depend on. If it is done as a copy rather than a move, the two copies drift and the phase has
   *created* the inconsistency it exists to close. Mitigation: `FigureCell` must call the extracted
   module — proven by a scan asserting `FigureCell.tsx` names no font family directly.

4. **BRIEF (e)'s settings clause is unbuildable as written and will surface late.** With no rail
   (C2), a lane handed "collapse the rail to tabs at 900" will either invent both layouts (a new
   user-facing surface, which the working agreement says needs a design canvas *before* the build) or
   silently ship nothing and mark the criterion passing. Both are worse than deciding now.

5. **Under-claiming on the scanner is a visible regression to a reviewer with a live market open.**
   Option A (§4.3) means a price that is demonstrably ticking carries no live mark while the page's
   prose says prices are live. A GATE-Q reviewer can reasonably read that as a defect. It must be
   written into the criterion as a **deliberate** state with its cause, or it will be bounced.

6. **The alerts loss path (§5.2) is out-of-scope-shaped but in-scope-severity.** Leaving it named and
   unfixed is defensible; leaving it *unnamed* is not, because the next phase to touch that store will
   inherit it without the citation. If the council rules it out of scope, it must land in carried debt
   with `store.ts:41-49,66-68` attached.

7. **Six surfaces' worth of criteria, one gate.** Phase 2 proved a multi-surface phase is reviewable
   **when the criteria are per-surface**. Scanner, positions, settings, alerts and eight widgets is
   larger than phase 2's four. If the criteria are written per-invariant instead of per-surface, GATE Q
   cannot tell which surface failed, and the recovery cost is a re-run of the whole gate.

8. **A conversion can silently delete an accessibility affordance.** Two verified instances:
   positions' per-literal tooltips (§2.3) and the scanner's `aria-describedby` score description
   (`ScanCard.tsx:57,108-110`) and its focusable score help (`ScanCells.tsx:115,132-140`). A
   `FigureCell` swap carries none of these forward. Mitigation: an a11y-tree assertion per converted
   site, not a render assertion.

---

## Assumptions I'm making about the other two lanes

Each is specific, falsifiable, and stated so R2 can attack it with one file read or one sentence.

1. **PM will not require a per-figure live dot on `/scanner`'s price column.** Falsified by any
   acceptance criterion asserting a live mark on a scanner row. If it appears, PM is choosing option
   C (§4.3) and reopening NO_BACKEND_CHANGE, and the feasibility line's empty-`apps/api`-diff claim
   fails with it.

2. **UX will not require `FigureCell`'s card chrome inside the scanner's 11-column table or inside
   `ScanCard`.** Falsified by any UX position that draws a scanner cell with a label row, a caption
   row, or a hover lift. If UX does require it, `ScanCard.tsx:54-73`'s single-anchor navigation model
   and the pinned `no-overflow.spec.ts:938` assertion both have to be re-argued, and that is a scope
   change, not a styling choice.

3. **PM will scope the eight quiet-band widgets as a property ("no untraced figure in mono; every
   figure steps"), not as eight equivalent conversions.** Falsified by a criterion of the form "all
   eight widgets render N figure cells" — `term-structure/TermStructure.tsx:18-58` has zero figures,
   so any count-based criterion is unsatisfiable without inventing figures.

4. **UX will not ask to re-compose the eight widgets' layouts.** Falsified by any UX layout for
   `market-context`, `iv-rank`, `straddle-move` or `dealer-flow-projection` that differs from what
   ships. Ruling 6 froze their layout; only the *reason* was corrected.

5. **PM's acceptance criteria will treat the settings "rail → tabs at 900" as either net-new
   construction or a non-goal, not as a responsive fix.** Falsified by a criterion asserting the rail
   collapses, which would be certifiable only against a rail that does not exist
   (`SettingsPage.tsx:156`).

6. **Neither lane will ask for a new persisted user preference on any of the four surfaces.**
   Falsified by any criterion requiring a saved setting, a dismissible banner that stays dismissed, or
   a per-surface density/column memory. Any of those creates a durable key and pulls
   `[loss-free-durable-migration]` from "satisfied by absence" to "the phase's sharpest risk", exactly
   as the BRIEF warns.

7. **UX will render the closed vocabulary as its own Sans literal, never interpolated into a
   sentence.** Falsified by any copy of the form "<label> · <member>" — which is what
   `TermStructure.tsx:26-27` ships today and what rule 24's "rendered as Sans text, never as a figure"
   does not currently reach.

8. **PM will price the e2e seeding work (§5.5) as required, not optional.** Falsified by acceptance
   rows that assert no-overflow at 393/834/900/1280 without also asserting a non-empty page at each.
   Without the seed, the phase's headline responsive criterion is green on an empty `/alerts` and a
   zero-row `/scanner`.

9. **UX will treat `AlertsPage.tsx:217-222`'s coloured left edge as in scope.** Falsified by a UX
   position that leaves unread state carried by hue alone. It is the alerts surface's largest v2
   violation and it is not a figure, so a figure-scoped phase misses it by default.

10. **PM will write per-surface acceptance criteria** (scanner / positions / settings / alerts / quiet
    band as separate blocks), as phase 2 did. Falsified by a criteria set organised by invariant. My
    boundaries in §2 are per-surface and different per surface; a per-invariant criteria set cannot
    express "the table keeps atoms, the card gets the primitive" without collapsing the distinction.
