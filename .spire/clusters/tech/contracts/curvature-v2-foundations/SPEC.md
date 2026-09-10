# curvature-v2-foundations — spec

**Source brief:** .spire/clusters/tech/contracts/curvature-v2-foundations/BRIEF.md
**Council:** R1 positions · R2 critiques · R3 resolutions · decisions.md   (under council/)
**Status:** draft

## 1. Goal + scope

Phase 1 of 4 of Curvature Terminal v2. It lands the **primitives** the later three phases compose
against: the seven surface/line tokens, the four declared scales, the `FigureCell` figure primitive
that retires `StatTile`'s coloured accent edge, the one six-state connection chip, the v2 four-link
navigation with a ⌘K palette, and panels as named container-query contexts. **No screen is
re-laid-out.** The trader gains no new capability; what changes is what the trader can *tell* about
what they are already looking at — whose number a figure is (the type register) and whether the page
is alive (one page-scoped liveness authority).

Two scope facts settle most of the phase's shape and were verified independently by all three voices:
the accent-bar primitive has **exactly two importers** — `pages/ticker/widgets/live-tape/LiveTape.tsx:35`
and `pages/ticker/widgets/dealer-positioning/DealerPositioning.tsx:25` — with **16 render sites**
(`DealerPositioning` 12 at `:102, :109, :116, :136, :142, :148, :155, :161, :169, :179, :196, :208`;
`LiveTape` 4 at `:138, :146, :154, :163`). It is **not** re-exported from `shared/ui/index.ts`; the only
re-export is the ticker-local `pages/ticker/widgets/_kit/index.ts:11`. So the accent-edge deletion is a
hand-edit on **one page**, not a codemod across six screens. The app-wide visible change this phase is
the **radius migration plus the token rebind**, and that — not the tile count — is what earns the
six-screen, two-scheme review list.

**In scope:**
- The seven token additions (`ink2`, `raised2`, `line`, `line2`, `steel2`, `scrim`, `glass`) bound in
  `apps/dashboard/src/app/shared/theme/tokens.ts` with **both** schemes populated in the same change
  that binds them in components.
- The four declared scales: spacing (enforcement + fenced debt), **radius (migration IN — every one of
  the 38 numeric sites read and set deliberately)**, z-index, breakpoints (additive keys only).
- `FigureCell` replacing `StatTile` at all 16 render sites in one change, with no deprecation window
  and no coexistence. `StatTile.tsx` is deleted; `StatTile.spec.tsx` becomes `FigureCell.spec.tsx`.
- **One** page-scoped connection chip with six states and no reachable seventh, including folding
  `TapePulseStrip.tsx:211-214`'s `tape-stream-state` text into it (it is a second *page-scope* claim).
- The v2 navigation: four product links (Scanner · Ticker · Positions · Alerts), Lab and Blog demoted
  to the footer, the ⌘K palette, the session chip, burger under 900px, search→icon under 1100px.
- Panels as **named** container-query contexts (`containerName: 'panel'` is a required edit at
  `shared/ui/Widget/Widget.tsx:157`, which today declares `containerType: 'inline-size'` with no name).
- **Ruling 6 exception:** the six hover-only ⓘ sites on the four look-alike widgets — `IvRank.tsx:91`,
  `:120`, `:229`, `MarketContext.tsx:141`, `StraddleMove.tsx:93`, `DealerFlowProjection.tsx:77` — are
  converted to the already-shipping `ai-rec/AccessibleHelp.tsx:8-12` pattern. This is a **mechanical
  swap onto an existing component, not a re-layout**, and it converts a false acceptance criterion
  (AC-35) into a true one. Recorded as a deliberate exception so it is not read as precedent.
- `/alerts` joins the no-overflow route set (it becomes a top-four nav link this phase).
- Amending the structural specs named in the BRIEF's invariant watch in the same change.

**Out of scope:**
- Any re-composition of ticker, scanner, positions, settings, alerts or landing. The masthead,
  structure-field hero, level ladder, read strip, verdict-first AI brief, quiet context band and the 3D
  landing instrument are phases 2–4.
- **Adding value retention to `LiveTape`.** Ruling 2: `FigureCell` *supports* the retained-value state;
  the tape *adopts* it in phase 2, where the desk rebuild already touches that code.
- Converting the four hand-rolled "StatTile-family" widgets (`IvRank`, `MarketContext`, `StraddleMove`,
  `DealerFlowProjection`) to `FigureCell`. Ruling 6 keeps their composition and their mono figures
  exactly as they are; only the ⓘ affordance changes. Their remaining structural gaps — no register
  enforcement, no container steps — belong to the phase that rebuilds them.
- Any `apps/api` change of any kind. The backend diff is **empty**.
- Any change to `opportunity_score`, `opportunity_tier`, the entry gate or `state_fingerprint`.
- Any new durable client store, and any change to an existing durable key or shape.
- New keyframes or new motion families. This phase declares **zero** new animations; the
  data-signal *class* replaces the enumerated exemption without being spent.
- Any `success`/`error` binding added or moved (ruling #18's scope is untouched).
- Changing `xs`/`sm`/`md`/`lg`/`xl` breakpoint **values**.
- A visual-regression gate. None is claimed for this feature; appearance rows are `review`.
- Swapping the literal `⏸` glyph outside `FigureCell` and the connection chip. `PositionRow`,
  `OrderRow` and `BrokerPositionRow` keep the literal character until their own phase — a global
  find-and-replace would silently rewrite wording on three screens this phase promised not to touch.

**Future (deliberately deferred):**
- Phase 2 owes the `LiveTape` retention latch: a last-non-null `useRef` per live field, cleared on
  symbol change and on replay arm, plus a test that a latched value is **not** re-flashed by
  `useFlashOnChange` (it did not change — it stopped arriving). Nothing holds it today:
  `shared/hooks/useFlashOnChange.ts:44` writes `prev.current = value` *before* its null guard at `:46`,
  so a drop destroys the last non-null value.
- Palette scope beyond "jump to a symbol" + "reach the four surfaces": commands, **recent tickers**,
  actions, add-to-scan. Recents are out on scope future-dating, **not** on cost: `convexa.recent-tickers.v1`
  already ships (`pages/ticker/recentTickers/store.ts:9`, `listRecents()` at `:78`, `recordVisit()` at
  `:86`, fail-safe at `:61-64`), so `[loss-free-durable-migration]` never fires. The real cost of
  restoring them later is **module placement** — promoting that store out of `pages/ticker/` because the
  shell may not import a sibling page — the same move `TintChip` made. Record this so a later phase does
  not over-price it. When a palette **write** does arrive it arrives with a stated success confirmation
  and a stated signed-out refusal, and no helper row advertises a binding before both exist.
- Burning down the fenced spacing debt: a named later phase, which is the exemption list's expiry.
- The full responsive sweep of landing and the site pages (phase 4).

<!-- spire:council-resolution:v1 5a16f0ad6880a7763602a08a6355d800ffe20d882155e3245bcb7f008a486611 folded -->
<!-- spire:council-resolution:v1 df1fb1c9f3754ad714f51f331c4f17de5181b3d94f6cc7798f079c55804362dd folded -->
<!-- spire:council-resolution:v1 d69d370093d698c1a6f9b829ebe7f0126e8eef3334a9a9b36a413448470bab1c folded -->
<!-- spire:council-resolution:v1 e4de8e35ec86d68be1e867833f07dfe3b94e8a04e1478930150e336e5664d517 folded -->
<!-- spire:council-resolution:v1 eb31c384d9299c449a616d93424601254d734499b9bc7eaa1c9d1e6e31bcce2a folded -->
<!-- spire:council-resolution:v1 faafda397d27a3a2b46236e89f7e46863c6922cc52177c9cdbfc03d92fc9bbef folded -->

## 2. Architecture

Paths are relative to `apps/dashboard/src/app/` unless stated.

### 2.1 Tokens — where each of the seven binds

| Addition | Binds to | Why that slot |
|---|---|---|
| `line` | `palette.{dark,light}.divider` | A real MUI slot the app already binds everywhere (`Widget`, `StatTile`, `TopNav`, the `MuiSnackbarContent` override). Landing it here changes the hairline at every existing call site with **zero diff there**. |
| `line2` | `extrasFor(theme).lineStrong` | No second divider slot exists; a `palette.divider2` would emit a non-standard `--mui-palette-*` var no MUI component consumes. |
| `ink2` | `extrasFor(theme).well` | `Widget`'s `bodyVariant: 'inset'` fakes the well today with `background.default` (`Widget.tsx:135`), which is `ink`, not `ink2`. One call site. |
| `raised2` | `extrasFor(theme).panelRaised2` | Sits beside shipped `panelRaised`; inherits its parity guarantee. |
| `steel2` | `extrasFor(theme).textTertiary` | **Explicitly not `palette.text.disabled`**, which is `rgba(138,155,180,0.5)` and *means* disabled. Two names, two meanings; collapsing them would give a legible tertiary label disabled semantics for assistive tech. |
| `scrim` | `extrasFor(theme).scrim`, consumed once via `MuiBackdrop.styleOverrides.root` in `theme.ts` `COMMON.components` | A scrim is only correct if *every* overlay gets it. Deletes the hardcoded `rgba(0,0,0,0.6)` at `Widget.tsx:437`. |
| `glass` | `extrasFor(theme).glass`, consumed by `TopNav`'s AppBar | Replaces the computation `alpha(t.palette.background.paper, 0.82)` at `TopNav.tsx:105` with a value. **Named gap:** the mirror has no token for the *scrolled* 0.9 state; that one arm keeps its computed alpha (derived from a palette slot, so not a new hardcoded literal) until a token exists. |

**Parity is compile-enforced but not test-enforced.** `extrasLight` is declared
`Record<keyof typeof extras, string>` (`tokens.ts:140`), so a missing or excess key is a type error —
under `nx typecheck`/`nx build`, **not** under `nx test`. Three additions close that: a runtime key-set
twin (`Object.keys(extras).sort()` deep-equals `Object.keys(extrasLight).sort()`); a set-equality
assertion over `palette.dark` / `palette.light` key sets, because those are two independent object
literals with no shared key type (`tokens.ts:59-80`) and `line` could otherwise land dark-only; and a
**per-name value-distinctness** assertion, because a key-set twin is structurally blind to
`extrasLight.glass` holding the *same string* as `extras.glass` — identical keys, the dark value copied
into light, which is exactly the fallback AC-41's own words forbid. For each of the seven names
`extrasLight[name] !== extras[name]`, unless the name is on a short **same-in-both-schemes** list
declared in the test file itself (the `hex-discipline` EXEMPT idiom) carrying a one-line reason per
entry. **The list ships empty.** It was drafted seeding `scrim` as a plausible member on the reasoning
that an overlay dim is a neutral black alpha in both schemes — but the design mirror gives `scrim` two
distinct values (`rgba(0,0,0,0.55)` dark / `rgba(23,32,43,0.45)` light), so the seed was factually wrong
and is removed (conductor, 2026-09-03, verified against `design/tokens/tokens.json`; found at GATE PLAN
as U-1). All seven names differ across schemes today, so an empty list is both correct and strictly
stronger than AC-41 requires. Adding a name to that list is a reviewed act, not a way to quiet a red build.

**A hole this feature opens and must close.** Five of the seven dark values are `rgba(...)` strings, so
`hex-discipline.spec.ts`'s `/#[0-9a-fA-F]{3,8}\b/` cannot see them. The mechanism is **not** a blanket
`rgba(` ban (`StatTile`/`Widget` legitimately use neutral overlay alphas): it is a **banned-literals
scan seeded from `tokens.ts` itself** — import the values, normalise whitespace, assert none of those
exact strings appears in any component source outside `shared/theme`. Self-maintaining and
mutation-testable.

**Nothing in `apps/dashboard` imports from `design/`.** `design/tokens/tokens.json` stays a mirror.

### 2.2 The four declared scales

- **Spacing.** No theme change: MUI's 8px unit already expresses the ladder as `0.5 1 1.5 2 2.5 3 4 5`.
  The work is **enforcement, not migration**. Ruling 4 fences it: a scan for off-ladder `sx` multipliers
  ships with a **live-checked, stale-entry-tested exemption list** seeded with today's files; the
  occurrence count goes in the build report; a named later phase burns it down. The architect measured
  **86 occurrences across 35 files** — recorded as the architect's number, not independently verified.
  New v2 primitives are on-ladder from birth.
- **Radius — the migration is IN.** `shape.borderRadius` moves 10 → 12 (`tokens.ts:83`). The mechanism
  that makes this bigger than it looks was verified in the controller: MUI resolves `borderRadius`
  through `createUnaryUnit(theme, 'shape.borderRadius', 4, 'borderRadius')`, so a numeric
  `borderRadius: n` in `sx` means **n × shape.borderRadius**, not n pixels — the move scales every
  numeric site by **1.2×** whether or not anyone looks. Measured 2026-09-03: **38 numeric sites across
  31 files** (specs excluded). Ruling 4: every one is read and set deliberately, to a declared role or
  to an explicit px value chosen to survive the shape change; **silence is not an option at any of
  them**, and the build report names every site whose rendered radius changes so GATE Q reviews a list
  rather than re-deriving one. One value cannot serve four roles, so the other three need theme
  overrides: `MuiDialog.styleOverrides.paper` → 16; `MuiButton` / `MuiOutlinedInput` / `MuiFilledInput`
  / `MuiInputBase` / `MuiToggleButton` → 8; pills stay a local `999px`. `Widget`/`StatTile`'s hardcoded
  `'12px'` and `Widget.tsx:444`'s `'16px'` become theme-derived rather than staying literal. The four
  declared roles govern; the radii in `design/src/**` are a non-binding sketch (the canon's own layer
  table ranks the catalog as "not a second rulebook").
- **Z-index.** Override `theme.zIndex` in `COMMON`: `appBar` → 20, `drawer` → 30, `modal` → 40,
  `snackbar` → 50, and the declared sheet-scrim 29 / popover 35 rungs are named for later phases.
  `mobileStepper`/`fab`/`speedDial` have no consumers but **must be given values** or they keep their
  1000–1050 defaults and sit above every v2 rung. `tooltip`'s rung is undeclared in the canon — see §9.
  One app site reads `theme.zIndex` at all (`AppShell.tsx:42`, `theme.zIndex.tooltip + 1` for the skip
  link), so the blast radius is one file.
- **Breakpoints — additive keys, no value changes.** Redefining `breakpoints.values` is rejected: 57
  `sx` sites across 26 files use `xs`/`sm`/`md`/`lg`, and four hooks call `down('sm'|'md')` / `up('lg')`
  (`Scanner.tsx:87`, `TradeEntryDialogView.tsx:166`, `BrokerTabPanel.tsx:59`, `AuthDialog.tsx:67`,
  `PositionsView.tsx:141,144`). Instead the five v2 bands land as **named keys alongside** the five
  defaults: `xs 0, sm 600, tablet 768, md 900, smallLaptop 1000, laptop 1100, lg 1200, desktop 1300,
  xl 1536, wide 1600`. Every existing key's value stays byte-identical. `breakpoints.only()`/`.not()`
  derive from adjacent keys and would change meaning — **no app source calls either today**, so a spec
  pin keeps it that way.

### 2.3 `FigureCell`

**New component, in place of `StatTile`, bounded sweep, no deprecation window and no coexistence.** A
parallel window would leave the accent bar in the tree — the exact outcome the BRIEF culled — and two
figure anatomies on one screen would make the per-screen sign-off meaningless.

**Location:** `pages/ticker/widgets/_kit/FigureCell.tsx`, promoted to `shared/ui/` at its second
consumer in phase 2, per the repo's "populate `shared/` on the 2nd consumer" rule.

**Prop contract (data-structure content, not layout):**

- `register: 'traced' | 'asserted'` — **required, no default.** Mono cannot be the fallback a careless
  caller gets; a cell that cannot say where its number came from must not compile. It stays required
  when `value` is a `NotANumber` member but has **no effect on that render**: the literal branch is
  always Sans per AC-19, whatever `register` says, and the cell neither validates the prop there nor
  reports the mismatch. Required-and-ignored is deliberate — a call site that later swaps a literal for
  a real figure has already declared its register, so the branch that starts rendering a number can
  never start rendering it unregistered.
- `value: string | NotANumber`, where `NotANumber` is **one exported closed union seeded from the
  shipped declaration sites**, not from a count: the canon's six (`—`, `unavailable`, `not given`,
  `not set`, `size not suggested`, `unrecognized`) plus `not recorded` (`positions/view.ts`,
  rendered at `positions/PositionRow.tsx:166`), `no basis` (`positions/labels.ts:126`
  `NO_BASIS_LABEL`) and `not provided` (`broker/brokerView.ts` `NOT_PROVIDED`). `NO_BASIS_LABEL`,
  `NOT_PROVIDED` and `NOT_RECORDED` are re-pointed at that union so there is one source of truth
  instead of four. **The type enforces closure; the caller picks the member** — a flat vocabulary any
  surface may draw from would erase a shipped, deliberate distinction (`brokerView.ts:149` substitutes
  `NOT_RECORDED` → `NOT_PROVIDED` per surface *by design*, because a broker's non-disclosure must not
  be reported as our record being empty). `FigureCell` renders the literal it was handed, unchanged,
  and never swaps one member for another. A caller-declared `{ kind: 'literal', text }` flag is
  **rejected**: it lets a real figure be mislabelled a literal, which is the register inversion running
  the other way, and it returns `[absent-is-not-none]` to prose.
- `live?: boolean` — drives the label-row dot only, and is **derived from the value's own expression at
  the call site**, never from the widget-scoped `widgetLive` (`LiveTape.tsx:74`) or `numbersActive`
  (`:73`). The fact exists at render time today with no data-flow change: Net flow `netFlow != null`
  (`:78`); Spread `numbersActive && live?.spread != null` (`:148`); Gamma flip
  `numbersActive && live?.gamma_flip != null` — specifically **not** `flipValue != null`, because `:87`
  falls back to the bundle's `m.gamma_flip`, so a dot keyed on the rendered value would claim the
  stream for a static number; VWAP **always false** (`:165` reads the bundle's `m.vwap`); all 12
  `DealerPositioning` cells always false.
- The offline input carries **whether the displayed value is a retained pre-drop value**, so the
  `· last known` clause is data-driven and F4/F5 are distinguishable in the DOM, not only to the eye.
- **No `accent`, no `accentColor`.** Deleting both props is what makes canon rule 13 structural: a
  coloured edge becomes unexpressible, not discouraged.

**What the swap does not reach.** The four look-alikes hand-roll their own label/value markup, so the
state matrix does **not** reach them by a primitive swap. They are already register-correct and
liveness-correct by absence — all four are declared static (`IvRank.tsx:66-69`, `MarketContext.tsx:9-10`,
`StraddleMove.tsx:3`) and bind `typographyTokens.monoFontFamily` by hand — so the BRIEF's sentence
"every figure on the ticker page carries its register and its liveness" is **narrowed**: it is
*visually* true across the page today and *structurally enforced* only at the 16 converted sites. The
four are named in a **stale-entry-checked exemption list** (the `hex-discipline` EXEMPT idiom) recording
that they are not register-enforced and not container-stepped, so the enforcement scan is scoped to the
converted widgets and cannot pass vacuously. Do **not** "fix" their mono figures — a static figure's
correct render is no dot.

**Collateral touchpoints, all verified:** `stage3-amber.spec.ts`'s `HOVER_CENSUS_FILES` names
`_kit/StatTile.tsx` and self-checks each entry exists, so it red-builds on the rename and must be
re-pointed, not deleted (the `scanner` precedent). `⏸ offline` / `cold-skeleton` are asserted across
~18 spec files; the glyph swap stays inside `FigureCell` and the chip so those stay green.
`_kit/index.ts:11` re-exports `./StatTile` and must move to `./FigureCell`, which is what keeps
`TickerDashboard`'s `StatSkeleton` import path stable.

### 2.4 The connection chip

**One resolver, one module, one page-scoped claim.** `useTickerStreamConnection` opens the page-scoped
SSE and publishes `{ live, streamOffline, ticker }` into `liveTapeStore` with a 15s payload-gap
watchdog; `sessionTapeStanding.ts` branches replay standing *before* live status. The resolver moves
out of `TickerHeader.tsx` into its own ticker-local module with a **pinned importer set of exactly
`TickerHeader.tsx` and `CommandDeck.tsx`**. The new module is the **definition site**; both of those
files are importers and neither hosts the resolver. `R3-ux.md` §3's `TickerHeader.tsx (definition)`
parenthetical names the file the resolver moved *out of* and is **superseded here**. It is **not**
re-exported from `shared/ui/index.ts` — that barrel records at `:10-13` that `arc.ts`/`ArcDivider.tsx`
are deliberately excluded because "a barrel re-export would blind the scan", and the same reasoning
binds here.

```
type ConnectionState =
  | { kind: 'live' }        // reachable only when the delivering-stream predicate holds
  | { kind: 'closed' }
  | { kind: 'overnight' }
  | { kind: 'noTicks' }
  | { kind: 'offline' }
  | { kind: 'replay'; standing: ReplayStanding }
```

Six `kind`s, exhaustively switched with a `never` default arm so a seventh is a **compile error**.
`ReplayStanding` is **derived, not retyped**: `type ReplayStanding = Exclude<ConsumeStanding, { kind: 's0' }>`
over the shipped 8-member `ConsumeStanding` at `sessionTapeStanding.ts:46-54` (`s0` is the
no-session-tape arm), so an added standing is a compile error at the switch without duplicating the
list anywhere. The standing varies the **sentence and the warning tone** — replay is *not* one tone:
`gap` (`:159`) and `ended` (`:168`) are `tone: 'warning'` with `warnIcon: true`, and `drop` (`:177`)
and `fault` (`:185`) are warning-toned too. The invariant that actually holds, and that makes the
detail free, is the one the type system already enforces: **`SessionTapeChip.pulse` is the literal type
`false` (`:112`)** and every arm's dot is `'○'` or absent, never `●`. So no standing can pulse or wear
the live dot, whatever its tone. ("Outlined, one tone" is false and must not be written.)

**Pre-first-fact (ruling 1).** The chip **slot** renders the existing **wordless** cold-skeleton
placeholder until the first stream fact is observed. The latch is **monotonic and structural** — the
union makes re-entry into the placeholder after a payload **unrepresentable**, not merely unlikely. A
re-derivation that could re-enter it is a defect, not a state. The union carries that as far as a type
can and no further: `ConnectionState` has **no placeholder member**, so re-entry means *discarding* a
held `ConnectionState`, which no arm of the exhaustive switch can express. But the boundary — whether a
`ConnectionState` exists yet at all — sits in the wrapper around the resolver (a `hasLatched` flag or
equivalent), and that is runtime logic a `never` default arm cannot see. Ruling 1's structural
requirement stands unchanged and is not narrowed here; what this records is where the *proof* lives.
The wrapper's obedience is evidenced by **AC-7b** — a latched chip re-fed each re-entry candidate — and
is **not** a corollary of AC-7, whose compile-time enumeration cannot reach it. Because the placeholder
is the visible *absence of a claim* and is declared as the LOADING class under canon rule 3, canon
rule 18 stands unamended at **six** states.

**Isolation, structurally.** The `live` kind is not constructible from static data: the resolver is the
only exported way to build a `ConnectionState`, it takes the live-tape shape as input, and the
delivering-stream predicate already returns `false` whenever `session_tape` is present
(`sessionTapeStanding.ts:29-32`, "poison `live:true` still false"). No `ConnectionChip` accepting a
free `state` prop is exported; only the resolver and a renderer over the resolver's output type.

**Second page-scope claim removed.** `TapePulseStrip.tsx:211-214` renders `⏸ Stream offline` / `Stream
off` under `data-testid="tape-stream-state"` — a second page-scope liveness authority beside the header
chip, exactly what canon rule 18 exists to stop. Its text folds into the chip; `compatibility.spec.ts:48`
pins that string and moves with it in the same commit.

**Announcer.** The `aria-live="polite"` region is **hoisted out of the chip** to one page-scoped
announcer, mounted **once and always** in the ticker page shell above both chip renderers and fed by
the single resolver's output. Neither chip renderer carries `role="status"` and neither owns a region.
Two reasons, both structural: while `condensed` is true, `StickyCondensed` (`CommandDeck.tsx:227`,
resolver call at `:96`) and the hero `TickerHeader` (`:261`) are both mounted and neither is
`aria-hidden`, so a chip-owned region announces twice; and a region inserted *together with* its
content does not reliably announce at all, so a chip-owned region is silent on first mount and doubled
while condensed. The announcer fires only when the resolved **class** changes — one of the six — never
when the text changes, because the resolver's `text` contains the mid (`TickerHeader.tsx:328-341`) and
a text-keyed region would announce on every tick.

**Observability of "one chip" (ruling 1).** One chip **in the viewport** (`toBeInViewport`) at both
scroll positions, hero-visible and hero-scrolled-past. Not an attached-node count and not a
visible-node count: `CommandDeck.tsx:226` renders the condensed bar as `{condensed && (<StickyCondensed …/>)}`,
and when `condensed` is true the hero header is still mounted and not `aria-hidden`, merely scrolled
out — and an out-of-viewport node passes `toBeVisible()` in both harnesses. Both of the rejected counts
red-build a correct implementation.

### 2.5 Panels as container-query contexts

Container-query support is **not** the risk; two shipped comments that assert the opposite are.
`MarketContext.tsx:436-438` and `DealerFlowProjection.tsx:173-174` both claim this Emotion version
drops or warns on `@container`; both are **false for the dependency state in this tree**, verified three
levels down (Emotion emits an object key with an object value verbatim, its kebab-case warning fires
only in the scalar-value branch for CSS *property* names; stylis 4.2.0 special-cases `@c…n` into the
nested-at-rule branch; MUI attaches `theme.containerQueries` and sorts container queries on every `sx`
result). **Both comments are corrected in this change**, or the next implementer re-derives the wrong
constraint from them.

`Widget.tsx:157` sets `containerType: 'inline-size'` with **no `containerName`** — the only container
declaration in the app. Adding `containerName: 'panel'` is a **required edit, not an assumption**: an
unnamed `@container` resolves against the *nearest* container ancestor, so phase 2's rails would answer
the panel's question. One small `PanelContainer` wrapper (or one exported `sx` fragment) is exported so
non-`Widget` panels declare the same named context. `FigureCell` queries the **named** container via
`theme.containerQueries('panel').down(360)` / `.down(280)` and **must never query an unnamed container**.

**Harness limit, stated as a limit.** jsdom performs no layout and evaluates no container query — every
element has zero dimensions, so no `@container` condition can match and `getComputedStyle(figure).fontSize`
returns the base declaration whatever the panel width. jsdom can honestly assert the **declaration**
only. The shipped reader is not yet fit for that: `_kit/type-floor.spec.tsx:35-39` joins every `<style>`
element's text, strips whitespace, then does ``css.split(`.${cls}{`)[1]?.split('}')[0]`` — it returns
the **first** rule bearing the class and stops at the first `}`, so it is structurally blind to a hoisted
`@container` block and **would pass with those blocks deleted**. Hardening is a global regex over the
joined CSS capturing every block bearing the class. Until that lands, the declaration criterion is
**UNVERIFIABLE** and must be recorded as such, never marked green (see AC-20a).

### 2.6 The ⌘K command palette

**Built on the MUI `Dialog` + list already in the tree. No new dependency.** The decider is
accessibility, not bundle size: this repo owns a measured patch wrapping `ModalManager.prototype.add/remove`
so `aria-hidden` never lands on a focused subtree (`shared/a11y/modalFocusHandoff.ts`), paired with
theme-level `MuiModal.defaultProps.disableRestoreFocus` (`theme.ts:129-131`), installed once at
`main.tsx:10`, with a spec asserting **both** halves. A non-MUI modal routes around both halves and
reintroduces the defect class in the newest, most-used surface in the app, with no spec covering it.
The keyboard ergonomics a dedicated library gives for free are real and are simply outweighed: the
shortcut listener, roving focus and `aria-activedescendant` are written here (the document-level
`keydown` precedent is `AuthDialog.tsx:97`).

**Mounted once in the shell**, so "one keystroke anywhere" holds on settings and alerts too. Not on `/`
— landing sits outside `AppShell`, and canon rule 19 scopes the palette to the shell.

**Data flow.** A **one-shot `getScan()` read on open**, cached for the dialog's lifetime. `useScan`
stays the `/scanner` page's one data owner and only fetcher; the palette adds no poll and no ambient
traffic, and a palette result is a snapshot by nature. Promoting the scan read to a shared domain owner
is architecturally right and phase-inappropriate; omitting tier and score contradicts canon rule 19.
The freshness fact the ranked figures need **exists on the wire and is consumed unchanged**:
`GET /api/scan` returns `sweep.sweep_last_completed` plus each row's own `as_of`, so a score is never
rendered bare. The wire's `status` is authoritative and rendered through a closed lookup, never
re-derived from the score.

**The open→resolved window is a named state, not a gap.** That one-shot read is a real network
round-trip, so between *dialog open* and *the read resolves* there is a window with no ranked rows to
render. It is the **LOADING class** under canon rule 3 — the cold skeleton, and specifically **not**
offline and **not** unavailable, the two states it would otherwise be confused with. It resolves
**once**, either to rows or to AC-30's unavailable arm, and is **never re-entered**: a later failed
read degrades, it does not re-skeleton. This is not invented here — the shipped precedent for the
identical call is already this exact shape and is followed rather than re-derived:
`pages/scanner/useScan.ts:76-78` declares `phase: 'loading' | 'ready'` where `loading` means "the FIRST
read is still in flight" and is "Never re-entered after the first resolution." Throughout the window
the dialog stays **usable** — the input takes text, the four surface commands navigate, a typed symbol
opens — because none of that depends on the ranked read. Drawn as **P2a** (§4.4); verified by
**AC-29c** (§3.C).

**Command table** is a static closed list of trader routes plus symbol results. `/_ops/metrics` and
`/_ops/research` are absent by construction, enforced by a membership test over the table plus a source
scan asserting no `/_ops` literal in shell or palette sources.

**Read-only in phase 1.** No write binding, no recents.

### Failure modes + isolation

- **SSE drop.** Live-derived figures degrade (dim + pause marker); the GEX chart and every static tile
  keep rendering the last bundle; the page is never blanked. The chip latches `offline`; every
  subordinate signal (widget bar, figure dot, tick flash) is gated on the same delivering-stream
  predicate the resolver uses, so none can outlive the stream.
- **Cold start, no fact yet.** The chip slot shows the wordless placeholder; figure cells show the
  `cold-skeleton` skeleton. Neither is an offline state.
- **Cold-start failure.** The only blank desk: names what failed, offers Retry, leaves the toolbar
  usable. Unchanged from today.
- **Post-success poll failure.** Last bundle stays behind a soft "couldn't refresh" warning stating its
  age. Distinct from offline. Unchanged from today.
- **Scan read unavailable on palette open.** The palette still opens, still navigates to the four
  surfaces and to a typed symbol, and shows an honest unavailable state for the ranked results only.
  `getScan()` rejects only on a transport fault; the server is best-effort always-200.
- **Never partially applied:** the seven tokens land in both schemes in the same change that binds them
  in components — no dark-first stage, and no interim where a component reads the design mirror.
  Likewise the 16-site swap lands in one change; two figure anatomies on one screen is not a valid
  intermediate state.

### Not buildable / rejected approaches

`cmdk` or any second modal system (routes around both halves of the shipped focus fix) · redefining
`xs`/`sm`/`md`/`lg`/`xl` values · a parallel `StatTile`+`FigureCell` deprecation window · a six-member
`NotANumber` union (a seventh literal is not a type error, it is a plain `string` that falls into the
**mono** figure register — the exact inversion the register prevents) · a caller-declared literal flag ·
any colour/`accent`/`accentColor` prop on `FigureCell` · a replacement mark for the deleted wall accents
(a new pattern is an Amendments event) · a worded "connecting…" chip · a nav clock or bell · counting
attached nodes or `toBeVisible()` nodes for the one-chip assertion · a blanket `rgba(` ban · reading
`design/tokens/tokens.json` at runtime · adding retention to `LiveTape` this phase · promoting
`recentTickers/store.ts` this phase.

<!-- spire:council-resolution:v1 5fad9c5a72e561db6a8757d4c4733698ea25d5c00b2f3b3ece0a01c3295ddde6 folded -->
<!-- spire:council-resolution:v1 cf2fcc72f0f00cf5cd07181059f3fcc48c86240bd8f4b616fdf9064fb03f4bdd folded -->
<!-- spire:council-resolution:v1 ec706307dee7e23e4219a428bc7d8d1d82b2f6366214df7dc7bba396853d13cf folded -->
<!-- spire:council-resolution:v1 f71300e9f2ae8c5600901c0bed38407cd0675682bb4b72e3de92b63a61c243ca folded -->
<!-- spire:council-resolution:v1 318d520712341d609e8049077737f980018280731669aa46feb0d36126662e87 folded -->
<!-- spire:council-resolution:v1 41e15b9946205a268b77882f33b7532fc8eafbae53b54e7e322c2257284cd664 folded -->
<!-- spire:council-resolution:v1 9511b567ca3c9d2c9049414b38098eb6590ba821b4a7e073ca4f6996826942f6 folded -->
<!-- spire:council-resolution:v1 7bd2d4f7cb3613ba9b6f280e89abc826b65088fa717d6c4faa3ad04c577b428f folded -->

## 3. Acceptance criteria (with user stories)

Every row is observable without reading source. `test` = automated; `review` = verified by inspection.
Rows marked **(SB)** are ship-blocking; the rest close the feature but may be carried to a same-session
fix-forward if the evidence is recorded.

**Harness note.** Component/state rows use the shipped Vitest + jsdom + Testing Library harness. Width,
scheme, coarse-pointer, viewport and container-*rendered* rows use the shipped Playwright e2e project.
**jsdom evaluates no container query and does no layout**, so no jsdom row may claim a rendered size.
Greyscale and per-screen appearance rows are `review` because **no visual-diff gate is claimed for this
feature**. Baseline to beat: **127 tests across 17 files green, typecheck clean, 2026-09-03**
(`_baseline-2026-09-03.md`). Check exit codes, not printed summaries.

**Stories.** US-1 the trader reading a figure · US-2 the trader who needs to know if this is live ·
US-3 the trader on a phone or a keyboard · US-4 the trader who lives across four surfaces · US-5 the
light-mode trader · DS-1…DS-4 developer stories (no user observes a token; judged on correctness,
throughput and cost).

### A. The one connection chip (US-2)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-1a **(SB)** | US-2 | On the ticker page with a delivering stream, exactly **one connection chip is in the viewport** at each of two scroll positions (hero visible, hero scrolled past), and no other page-level statement of stream state appears anywhere on the page; the chip reads live and names the mid it is showing. | test (browser) | Named Playwright test using `toBeInViewport` at both scroll positions; exit code recorded. A `tape-stream-state` node asserting stream state must be absent. |
| AC-1b **(SB)** | US-2 | A figure carries a live marker only when that figure's displayed value arrived from the delivering stream; in each of the five non-live chip states, no figure on the page carries one. | test | Component/state matrix, five non-live arms; exit 0 |
| AC-1c **(SB)** | US-2 | With the stream delivering, exactly **three** cells on the ticker page carry a live marker — Net flow, Spread and Gamma flip — and **VWAP carries none**, even though it sits inside a widget that is itself marked live. | test | Named test enumerating the four live-tape cells and the twelve dealer-positioning cells; VWAP asserted dotless |
| AC-2 | US-2 | With the market closed, the chip reads closed, is neutral-toned, carries **no** warning icon, and names the mid. | test | Six-state matrix, closed arm |
| AC-3 | US-2 | In the overnight session the chip reads overnight, carries the warning icon, states that no live data exists for this window, and names the mid. | test | Six-state matrix, overnight arm |
| AC-4 | US-2 | In a covered session with no ticks arriving the chip reads no-ticks, carries the warning icon, and names the mid. | test | Six-state matrix, no-ticks arm |
| AC-5 **(SB)** | US-2 | When the stream drops past the watchdog the chip reads offline with the warning icon and says it is reconnecting; **the page is not blanked** and structure content is still present. | test | Stream-drop flow test asserting chip state + structure content still rendered |
| AC-6 **(SB)** | US-2 | While a captured session is replaying, the chip is the outline/provenance form, names the session, and carries **no live dot and no pulse in any standing**. | test | Replay arm walked over every standing; a no-pulse and no-filled-dot assertion per standing |
| AC-7 **(SB)** | US-2 | Driving the resolver with every input combination the app can produce — every session, every replay standing, stream up and down — yields one of exactly **six** `kind`s and never a seventh. | test | Exhaustive-input enumeration asserting the produced `kind` set equals the six; recorded mutation proof that a planted seventh `kind` fails to compile / red-builds |
| AC-7b **(SB)** | US-2 | Once the chip has latched to one of the six states it **never returns to the placeholder**: after the first stream fact, a payload gap, an undefined payload and an expired watchdog each leave a chip state on screen, never the wordless placeholder. | test | Latch-retention test with its own inputs: latch a chip on a first fact, then feed each of the three re-entry candidates in turn, asserting per candidate that the placeholder is **absent** and a chip state is **present**. Exercised against the resolver's wrapper, not the union — the has-latched boundary is runtime logic a `never` default arm cannot see (§2.4), so AC-7's enumeration is not evidence for this row |
| AC-8 **(SB)** | US-2 | A replay that has **ended**, **faulted**, **dropped** or is running for a **different symbol** is distinguishable from a playing replay in the chip's own words: the seven standings' sentences are pairwise distinct and none contains "Live offline"; `drop` and `fault` carry no literal `⚠` in the string and render the stroke warn icon instead. | test | Standing-sentence test (pairwise distinct + negative "Live offline" assertion + icon assertion) |
| AC-9 **(SB)** | US-2 | Before the first stream fact the chip slot renders the **wordless** cold-skeleton placeholder — present in the slot, carrying no text, no tone, no dot and no connection vocabulary. | test | Cold-load test asserting the placeholder is **present** (a positive observable) and that no live claim and no connection word is rendered |
| AC-10 | US-2 | On a surface not fed by a stream — scanner, positions, settings, alerts, landing — each surface first renders its **own named content anchor** (the scanner table, the positions list, the settings form, the alerts list, the landing hero), and only then carries no connection chip, live dot or pulse anywhere. | test | Per-surface test, **positive assertion first**: the named anchor is present on each of the five, so a page that crashed or rendered blank fails there instead of passing the negative space by construction (ruling 1's shape, as landed on AC-9); then the negative-space assertion + importer set-equality on the resolver module |
| AC-11 | US-2 | Every liveness motion — dot pulse, widget bar, tick flash — stops when the stream drops, in every one of the five non-live states. | test | Motion-gating test across the state matrix |
| AC-12 | US-2 | With reduced motion enabled no liveness motion runs in any state; the live dot renders **static and fully opaque** and the chip still states the state **in words**. | test | Reduced-motion arm of the same test |
| AC-12b | US-2 | Exactly **one** `aria-live="polite"` node exists in the chip path on the ticker page; it announces on a chip-class change and is **silent on a mid-only change**; neither chip renderer carries `role="status"`. | test | Announcer test: node count 1, transition announces once, mid update announces zero times |
| AC-12c | US-2 | The six announcement sentences read correctly standing alone out of context. | review | Reviewer note quoting the six sentences as rendered |

### B. Figure cell and the type register (US-1)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-13a **(SB)** | US-1 | After this phase no figure anywhere in the app renders a coloured accent edge: neither an `accent` nor an `accentColor` prop survives anywhere, `StatTile.tsx` no longer exists, and the anatomy cannot be reintroduced by copy-paste. | test | Source scan (arc.spec importer idiom) with a recorded mutation proof: re-adding either prop or a `StatTile` import red-builds; anti-vacuity assertion that the scan glob is non-empty |
| AC-13b | US-1 | Opportunity-tier emphasis survives the deletion in the **tier word carried inside the value string** (`Actionable`, in `77 · Actionable`), in **type only** — the value renders in one register at `text.primary`, identical in both schemes — no replacement colour, and never a directional one. *(Amended by owner ruling 8, 2026-09-03. The superseded text required "type and the single amber word already inside the value string"; there has never been an amber word — pre-phase the tier's amber lived only in the `accentColor` bar AC-13a deletes.)* | review | Reviewer note naming the Opportunity cell in both schemes: the tier word present inside the value string, and the value's computed colour identical to the other figures' in the same strip — no colour in the cell varying by tier or by direction |
| AC-13c | US-1 | After this phase a trader can still tell Call wall from Put wall **in a greyscale screenshot** of the dealer-positioning strip without opening a tooltip: the side is carried by the label words, which stay exactly `Call wall` and `Put wall` and are **not** re-hedged into `(resistance)` / `(support)`. | test + review | Test asserting the two labels render verbatim and neither cell carries a colour-only side encoding; a greyscale capture of the strip attached |
| AC-14 | US-1 | A figure Convexa computed renders in the mono register and lines up column-wise with its neighbours. | review | Reviewer note naming the screen and strip inspected |
| AC-15 **(SB)** | US-1 | A figure the app asserts but could not trace renders in the Sans register with the dotted rule and is visibly different from a traced figure in the same strip — the **untraced arm fires**, not merely that mono renders. | test | Component test driving the `asserted` arm; a mono-only assertion is not sufficient evidence |
| AC-15b | US-1 | **No phase-1 call site emits the untraced register.** All 16 converted sites pass `traced`. | test | Negative-space test over the converted widgets |
| AC-16 | US-1 | A live-derived figure shows its live marker in the label row, and only while the stream is genuinely delivering. | test | Component test, live and dropped arms |
| AC-17a **(SB)** | US-1 | A figure that **did** receive a value before the drop shows that value dimmed with the pause marker and a caption that says it is the last known value. | test | `FigureCell` component test, retained arm |
| AC-17b **(SB)** | US-1 | A figure that had **no** value at the drop shows the bare closed-vocabulary literal with the pause marker and a caption that says only that it is offline — **never** "last known". F4 and F5 are distinguishable in the DOM, not only to the eye. | test | `FigureCell` component test, no-retained arm, asserting distinct DOM markers |
| AC-17c | US-1 | On the ticker page as shipped by this phase, Net flow and Spread take the **no-retained** arm on a drop, and no caption on either asserts a last known value beside an absence literal. | test | Stream-drop flow test on `LiveTape` asserting the AC-17b shape for both cells |
| AC-18 | US-1 | On the same drop a static bundle-derived figure in the same strip keeps rendering at full strength with **no** offline marker. | test | Same test, isolation arm |
| AC-19 **(SB)** | US-1 | Every member of the closed not-a-number vocabulary renders as small Sans text, never in the mono figure register, never carrying a unit, and the cell **never substitutes one member for another** — it renders the member it was handed. A string that is not a member cannot reach the literal branch. **No count is asserted.** | test | Vocabulary test over the exported union asserting closure, register and non-synonymy; mutation proof that a non-member string does not classify as a literal |
| AC-19b | US-1 | No rendered figure value contains a closed-vocabulary member together with any other character: `$—` is a red build, and a null max-pain renders the bare `—`. | test | Render test over the `DealerPositioning` max-pain cell plus a scan for `` `$${…}` `` templates at converted call sites |
| AC-20a | US-1 | The compiled styles for a figure value declare a size step against the **named** panel container at `(max-width: 360px)` → 17px and `(max-width: 280px)` → 15px off a 20px base, and no rule inside either block declares a font size below the 11px floor. | test **only after the reader is hardened** — otherwise `review` | Emitted-CSS assertion using a hardened `type-floor.spec.tsx` reader (global capture of every block bearing the class). **On today's `type-floor.spec.tsx:39` helper this row cannot fail honestly: it must be recorded UNVERIFIABLE and dropped to `review`, never marked green.** |
| AC-20b | US-1 | At **one fixed viewport width**, the same figure rendered in a wide panel and in a narrow panel **on the same screen** shows two different sizes, the narrower panel showing the smaller step — so the step follows the panel, not the window. | test (browser) | Playwright measurement of computed font size in two panels at one viewport. Honest fallback if two differently-sized panels cannot be produced without re-laying out a surface: drop to `review` with both measured sizes written into the build report — never to a jsdom row asserting style text. |
| AC-21 | US-1 | No figure value is a heading element **on ticker or positions** — the two screens the page-outline test actually walks. The app-wide form of the claim is a **carried-forward** pre-v2 invariant (`DESIGN_SYSTEM.md:224`, the Banned row "Stat values as heading elements"), recorded here as carried debt: this phase neither widens it nor certifies it on the other four screens. | test | Page-outline test on ticker and positions; criterion and evidence now name the same two screens |
| AC-22a | US-1 | On the ticker page, every card that showed a stat figure before this phase shows the same label and the same value after it, in both schemes. | review | Per-screen review note, ticker × two schemes |
| AC-22b | US-1 | On landing, positions, scanner, settings and alerts the **only** visible before/after difference is the corner radius and the rebound surface/line colours — no figure's label, value, wording or position changes on any of the five. | review | Five screens × two schemes review notes, each naming the screen and scheme |
| AC-22c | US-1 | `IvRank`, `MarketContext`, `StraddleMove` and `DealerFlowProjection` still render their figures in mono with no live dot after this phase, and are named in a **live-checked exemption list** recording that they are not register-enforced and not container-stepped. | test | Exemption-list test with a stale-entry assertion (a listed path that no longer exists red-builds) + a render assertion that the four are mono and dotless |

### C. Navigation and the ⌘K palette (US-4)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-23 | US-4 | The shell nav shows exactly the four product links; Lab and Blog are absent from the bar **and the drawer** and are reachable from the footer. | test | Nav test asserting four present, two absent, footer reachable; the drawer assertion in `no-overflow.spec.ts` is amended in the same change |
| AC-23b | US-4 | No `/_ops` route appears in the nav, the drawer, the footer or the palette's command table, and no `/_ops` literal appears in shell or palette sources. | test | Membership test over the static command table + source scan |
| AC-23c | US-4 | The shell nav carries **no clock and no bell**, and no live-toned chip or pulsing dot anywhere. | test | Negative-space test on the shell in both signed-in and signed-out states |
| AC-24 **(SB)** | US-4 | Pressing ⌘K/Ctrl-K anywhere in the shell opens the palette, and from it a trader reaches **each** of the four product surfaces without a mouse. | test | One keyboard flow test covering all four destinations |
| AC-25 **(SB)** | US-4 | Escape closes the palette and returns focus to the element that held it before opening; nothing behind the palette changed. | test | Focus-return assertion in the same flow test |
| AC-26 | US-4 | Clicking the scrim closes the palette, discards the query and returns focus to the invoker — the same end state Escape produces. | test | Its **own** scrim-click arm in the palette flow test, not a reuse of AC-25's. AC-25 covers the **Escape** path only: §2.6 hand-assembles this palette on the MUI `Dialog` with a document-level `keydown` listener written for this feature, so Escape and backdrop dismissal share no guaranteed implementation path and one passing is no evidence for the other |
| AC-27 | US-4 | Adding the palette does not change the shell's first tab stop: the skip link is still the first thing Tab reaches on every route. | test | Existing keyboard-floor test extended to the palette-bearing shell |
| AC-28 **(SB)** | US-4 | Signed out, choosing a gated surface from the palette lands on the **same visible sign-in wall** the nav link produces, with the same onward free path — never a blank page and never a silent redirect. | test | Signed-out flow test asserting the wall and its onward path |
| AC-29 | US-4 | Tier and score render from the wire's own closed status vocabulary and are never fabricated: `ok` renders the score, `stale` renders the score with its sweep age beside it, `building` renders `—`, `error` renders `unavailable`. Never a blank where a score goes, never a `0`. | test | Palette state test, one arm per status value |
| AC-29b | US-4 | A score is never rendered bare: every rendered score carries the sweep's freshness beside it. | test | Palette test asserting a freshness string accompanies every rendered score |
| AC-29c | US-4 | While the ranked read is still in flight the tracked-universe rows render as **skeleton rows — present in the list** (a positive observable), carrying no tier, no score, no status word and no `0`; the dialog stays usable throughout, with a surface command still navigating; and once the read resolves the loading form is **absent** and does not reappear on a later failure. | test | Palette pending-window test: skeleton rows asserted present before resolution and absent after, with the negative assertion for tier / score / status / `0` inside the window; a navigation arm exercised mid-flight; a post-resolution failure arm asserting the loading form does not return (§2.6, `pages/scanner/useScan.ts:76-78`) |
| AC-30 | US-4 | When the ranked read is unavailable the palette still opens, still navigates to the four surfaces and to a typed symbol, and shows an honest unavailable state for the ranked results only. | test | Degraded-dependency test |
| AC-31 | US-4 | A query that matches nothing shows an empty-result line that says what to do next and is **visibly distinct** from the unavailable state in AC-30. | test | Empty-vs-unavailable test asserting different copy |
| AC-31b | US-4 | The palette renders **symbols only** — no company name appears anywhere in it. | test | Negative-space test (no name field exists on the wire or in the universe file) |
| AC-32 | US-4 | At 900px and below, all four product links stay reachable within one tap from the collapsed nav. | test | Collapsed-nav e2e at 900 and 393 |
| AC-33 | US-4 | Opening and dismissing the palette while a form field holds unsaved text leaves that text intact. | test | Flow test on a settings or entry field |
| AC-33b | US-4 | The footer helper row advertises exactly move / open-ticker / close, and **no shortcut is advertised that the palette does not perform**. | test + review | Test for the negative (every advertised binding resolves to a performed action); reviewer note for the words |

### D. Touch, focus and type floors (US-3)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-34 **(SB)** | US-3 | On a coarse pointer at 393px, every control **this phase creates or touches** — the palette dialog and its rows, the burger drawer, the four nav links, the connection chip if it becomes interactive, and `FigureCell`'s ⓘ button — has an effective hit area of at least 44px **in both dimensions**, measured not asserted. | test | Coarse-pointer e2e measuring both dimensions per control, listing every measured selector. Any control this phase creates that is not a `button`, `[role="button"]` or `a` falls outside the theme's `@media (pointer: coarse)` selector floor (`shared/theme/theme.ts:80-102`) and must carry its own explicit sizing. |
| AC-34b | US-3 | Every interactive control **outside** that set that fails the floor is itemized in the build report **with file:line** as accepted, carried debt with a phase attached — not silently passing and not silently blocking. | review | Itemized list in the build report; a sentence acknowledging debt exists is not sufficient |
| AC-35 **(SB)** | US-3 | Every hover-revealed control on the ticker page has an equivalent reachable by **tap** and by **keyboard focus** at 393, 834, 900 and 1280 — including `FigureCell`'s ⓘ and all six previously hover-only info sites (`IvRank.tsx:91`, `:120`, `:229`, `MarketContext.tsx:141`, `StraddleMove.tsx:93`, `DealerFlowProjection.tsx:77`), which now use the shipped `AccessibleHelp` pattern. | test | Hover-fallback e2e enumerating hover-revealed controls per surface; a second focusable-help pattern anywhere is a defect |
| AC-36 | US-3 | No chip or label renders below the 11px floor in either scheme at any of the four widths, **including at the 280px container step** where the caption must not scale down with the figure. | test | Type-floor check extended to the new chip and label roles and to the container blocks |
| AC-37 | US-3 | Every focusable control shows the one **authored theme** focus ring; no new component defines a bespoke ring and none suppresses its outline without a replacement. | test | Focus-ring check across the new nav, palette and figure controls |

### E. Responsive integrity (US-3)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-38 **(SB)** | US-3 | Landing, ticker, positions, scanner, settings and **alerts** each fit the viewport with no horizontal page scroll at **393, 834, 900 and 1280**, in **both** schemes. | test | Extended `no-overflow.spec.ts` naming every width × scheme × route it covered; **every added width carries a vacuity guard** (a marker asserted attached before measuring — the suite's own idiom). Runtime is unpriced; if it exceeds budget the binding cut rule is **fewer routes at the added width, never fewer schemes at the narrow width**. |
| AC-39 | US-3 | Where a rail scrolls sideways by design, the rail is the only thing that scrolls — the page itself does not. | test | Same suite, rail arm |
| AC-40 | US-3 | At 393px the sign-in wall, the cold-start failure banner and the **open palette** each fit without overflow. | test | Same suite, degraded-surface arm |

### F. Tokens and scheme parity (US-5 / DS-1)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-41 **(SB)** | US-5 | Each of the seven new token names resolves to a defined value in **both** schemes; none falls back to its dark value in light mode. | test | Runtime key-set twin over `extras`/`extrasLight` **plus** a set-equality assertion over the two palette objects' key sets (the `divider` half is not covered by the type) **plus a per-name value assertion** — `extrasLight[name] !== extras[name]` for each of the seven, exempted only by the declared same-in-both-schemes list (§2.1). The value assertion is not redundant: a key-set twin proves both maps declare the same seven keys and is structurally blind to `extrasLight.glass` being handed `extras.glass`, which is exactly the fallback this row's own words forbid. `npm run typecheck` exit 0 recorded — `nx test` alone cannot see the parity guarantee. |
| AC-42 | US-5 | The tertiary-text token's measured contrast is **recorded for both schemes** and **asserted in both**: the dark floor the canon states, and the light floor set by owner ruling 7 — WCAG AA 4.5:1 on every light surface where `textTertiary` can actually render (`panelRaised`, `well`, `paper`, white). `raised2` is excluded on zero-consumer evidence, and the exclusion is guarded live rather than assumed. **See §9 D-1 for the ruling that closed the light floor.** | test | Measured numbers for both schemes in the build report — dark `ink` 5.18 / `panel` 4.83 / `well` 5.10; light `steel2` = `#5D6B84` at `panelRaised` 4.54 / `well` 4.75 / `paper` 4.97 / white 5.38 — with `steel2-contrast.spec.ts` asserting **both** floors plus a liveness guard that red-builds the day `raised2` gains a consumer |
| AC-43 | US-5 | Switching scheme on any of the six screens changes colour only: nothing moves and no text reflows to a different line count at the same width. | review | Side-by-side review note per screen |
| AC-44 **(SB)** | DS-1 | This phase introduces zero new hardcoded colour literals — **hex or `rgba()`** — and nothing in the app reads the design-side mirror at runtime. | test | `hex-discipline` + `banned-hexes` green **plus** the new banned-literals scan seeded from `tokens.ts`; recorded mutation proof that a planted token literal red-builds, and an anti-vacuity assertion that the ban list and glob are non-empty |
| AC-45 | US-5 | The browser theme colour follows the active scheme after this phase. | review | Reviewer note in both schemes |
| AC-45b **(SB)** | DS-2 | The four declared radius roles are landed — panels, dialogs, controls, pills — and **every one of the 38 numeric `borderRadius` sites across 31 files is set deliberately**, with the build report naming every site whose *rendered* radius changes. | test + review | Test for the four role values and for the live-checked radius exemption list (a stale entry red-builds); **review** of the per-site list, because no test can catch a wrong per-site judgement |
| AC-45c | DS-2 | The spacing exemption list is live-checked (a listed path that no longer matches red-builds), its occurrence count is recorded in the build report, and it names the later phase that burns it down. | test | Exemption-list test with a stale-entry assertion; count in the build report |

### G. Degraded and honest states — first class, not appendices (US-2)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-46 **(SB)** | US-2 | Cold load shows skeletons in the final shape, and the skeleton form **never appears after the first successful load**. | test | Loading-class test asserting absence post-load, keyed on the preserved `cold-skeleton` testid |
| AC-47 **(SB)** | US-2 | Cold-start failure is the **only** blank desk: it names what failed, offers a retry, and leaves the toolbar usable. | test | Cold-failure flow test |
| AC-48 | US-2 | A refresh failure **after** a first success keeps the last content behind a soft warning that states its age; it does not blank and it does not read as offline. | test | Post-success poll-failure flow test asserting the state is distinct from AC-5 |
| AC-49 | US-2 | An empty-by-choice state is informational, not a warning, and carries the corrective action beside it. | review | Reviewer note naming the empty state inspected |
| AC-50 | US-2 | Loading, empty, offline, failed and closed are five visually distinct states on the same surface; no two are confusable in a greyscale screenshot. | review | Five greyscale captures on one surface attached to the build report |
| AC-50b | US-2 | In `FigureCell`, loading ≠ offline-no-value ≠ empty/not-applicable ≠ unavailable are distinguishable **in the DOM**, not only to the eye. | test | State-exclusivity test asserting four distinct DOM markers |

### H. Non-regression — the foundations guard (DS-1 … DS-4)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-51 **(SB)** | DS-1 | The `apps/api` diff for this feature is **empty**. | test | Build-step check that `git diff --name-only <merge-base>..HEAD -- apps/api` returns zero lines; the observed file count reported |
| AC-52 **(SB)** | DS-1 | `opportunity_score`, `opportunity_tier` and `state_fingerprint` are byte-identical before and after, on a fixed fixture. | test | Before/after comparison recorded |
| AC-53 | DS-4 | The convex arc still has exactly three importers; this phase adds no fourth. | test | `arc.spec.ts` importer set-equality green, unamended |
| AC-54 **(SB)** | DS-4 | The keyframe inventory equals the data-signal class plus the one orchestrated moment; **this phase declares zero new keyframes**; a planted new animation family red-builds; and the class predicate itself is tested — a data-signal keyframe that runs without a live stream, or that ignores `prefers-reduced-motion`, must fail. | test | Inventory set-equality + recorded mutation proofs (second declaration site of `liveDotPulse`; keyframe outside the class; predicate violation) |
| AC-55 | DS-4 | Every durable client store opens with its existing contents after this phase — no durable key or shape changes here. | test | Durable-store test loading a pre-phase fixture |
| AC-56 **(SB)** | DS-4 | Every structural spec named in the invariant watch is green after the change, at or above the measured 2026-09-03 baseline of 127 tests across 17 files, with **exit codes** recorded — not printed summaries. | test | Per-suite exit codes and test counts recorded; `npm run typecheck` exit 0 recorded separately, because Vitest transpiles without typechecking |
| AC-57 | DS-4 | Pins that point at renamed or folded surfaces are **re-pointed, not deleted**, and each re-pointed path is proved to still exist: `stage3-amber.spec.ts`'s `HOVER_CENSUS_FILES`, `compatibility.spec.ts:48`'s `tape-stream-state` assertion, and the drawer link assertion in `no-overflow.spec.ts`. | test | Each list self-checks its entries; a stale entry red-builds |

<!-- spire:council-resolution:v1 452fab6ba560ca7ed0e5541f565a8387ff460f4aa8401be28f2ad8216cd1a811 folded -->
<!-- spire:council-resolution:v1 503c14efbf5a2800a96a4343be6691903fa65f455f2b99c4b8d3529fe5433b83 folded -->
<!-- spire:council-resolution:v1 90015cd5e81cd7c6ee92287cd7fba21b7ff764b59c8429d47ef3dcd03c4c876a folded -->
<!-- spire:council-resolution:v1 3918eecaf1aae62c3a49188054ba7d839d41d58bf83a16aa84ea4cb9a548ba0f folded -->
<!-- spire:council-resolution:v1 a0c40ded79e91c1229875564d4aa825c7c1e917489e4773a153e4e8bb49dbbb7 folded -->
<!-- spire:council-resolution:v1 5954bcc2c763536003ab18175a7d3ec37c298f1c87624d2abc246b6625bbfd93 folded -->
<!-- spire:council-resolution:v1 4a559879193fef82d458c3280342982beea72bf13c640f71c2c8713145437281 folded -->
<!-- spire:council-resolution:v1 b3faafb19c0e908b01f7fe49263d4e3fb846f4e96078c17fd78e60eae290c828 folded -->
<!-- spire:council-resolution:v1 d2fec026316bb33192e8206cb83fa8b0573499f5ceb99075725c818d3349170f folded -->

## 4. UI + interaction

**Flows.** (1) Read a figure: label row answers *is this live?*, the glyphs answer *is this ours?*.
(2) Read the page's liveness: one chip, one sentence, one announcer. (3) Move between surfaces: ⌘K →
type or arrow → Enter → the destination, or the sign-in wall the nav link would have produced.

### 4.1 `FigureCell` — nine states

"Value" = the figure slot; "Label row" = caps label · ⓘ · liveness slot; "Caption" = the line beneath.

| # | State | Label row | Value | Caption | Must not happen |
|---|---|---|---|---|---|
| F1 | Default (static figure) | caps label · ⓘ · **no dot** | Plex **Mono**, primary text | the cell's own basis line, or none | No dot. No "snapshot" badge — absence is the answer, and a badge on every static cell would make the dot the odd one out. |
| F2 | Loading (cold skeleton) | shimmer at label height | shimmer at figure height | shimmer at caption height | Never after the first successful load; carries **no text at all** — no "Loading…", no `—`. |
| F3 | Live-updating | caps label · ⓘ · **live dot** | Mono, flash-on-tick decaying to primary | basis line | The dot may not render unless **this figure's** value came from a delivering stream. |
| F4 | Offline — value retained | caps label · ⓘ · no dot | last received value, Mono, 50% opacity, pause icon before it | `offline · last known` | The `last known` clause renders **only** when the cell is showing a value that actually arrived before the drop. |
| F5 | Offline — no value retained | caps label · ⓘ · no dot | the absence literal, **Sans**, 50% opacity, pause icon | `offline` (bare) | Must **not** say `last known` beside an absence literal. This is the binding offline state for Net flow and Spread in phase 1. |
| F6 | Replay / not-current | caps label · ⓘ · no dot | Mono, **full strength** | `session replay` (the armed symbol and date live at panel level) | No live dot, no pause mark, no `offline` caption. |
| F7 | Empty / not applicable | caps label · ⓘ | `—`, **Sans**, secondary tone | optional one-liner naming why it does not apply | `—` must never be prefixed or suffixed by a unit. |
| F8 | Unavailable (attempted, failed this cycle) | caps label · ⓘ | `unavailable`, **Sans**, secondary tone | the widget's existing "unavailable this cycle" line | Distinguishable from F7 **in the DOM**. Never `0`, never blank, never `null`/`NaN`. |
| F9 | Untraced (asserted, not traced) | caps label · ⓘ | **Plex Sans** at figure size, dotted rule beneath | names the asserter | **No phase-1 call site emits this.** The prop exists so phases 2–4 compose. |

**Container steps** (independent of viewport): ≥360px panel → 20px figure; <360px → 17px; <280px →
15px. The caption stays at 11px at every step — **the floor, not below**. An absence literal is Sans at
the literal size and does **not** step further at 280px; it is not a figure.

**Where register and liveness are answered.** *Is this ours?* — in the **glyphs of the value itself**:
Mono, tabular, aligned in its column for yes; Plex Sans at the same size with a dotted rule and a
caption naming the asserter for no. The misalignment that produces is a **second honest signal**, ruled
in knowingly. *Is this live?* — in the **label row, immediately right of the ⓘ**, one slot at the same
x-position on every cell on every screen; yes is the dot, **no is nothing in the slot**. Three scopes
never merge: the **chip** is the page claim, the `Widget` **livebar** is the widget claim, the **dot**
is the figure claim.

**The ⓘ is a real focusable control** — a button with an accessible name of the form `About {label}` —
opening the same copy on tap and on Enter/Space and closing on Escape. Hover may stay as the
enhancement; it may not be the only path. Today the whole tile is a hover `Tooltip`
(`StatTile.tsx:180-183`) with a decorative icon, so every glossary string in `_kit/copy.ts` is
unreachable on touch. The same pattern — the shipped `ai-rec/AccessibleHelp.tsx:8-12` — closes the six
sites on the four look-alike widgets. **Do not invent a second focusable-help pattern.**

**The live dot is decorative to the eye and carries the single visually-hidden word `live`**, so the
cell reads "Net flow, live" to a screen reader. It is never inside an `aria-live` region, so a tick
never announces.

**Walls and signs — no replacement mark.** The accent bar goes at all 16 sites with **no replacement
mark and no replacement colour**. The two wall cells' side is in the label words (`Call wall` /
`Put wall`) and the signed figures' sign is in the value glyphs, pinned by `_kit/copy.spec.ts:54`
(`−$` prefix, U+2212) and by the explicit `+`/`−` on net flow. So **no datum is lost at any of the 16
sites**; what is lost is scan speed, which is exactly the cost the canon's Banned row ruled in
knowingly. The labels stay ungossed — the shipped ⓘ copy already hedges with "*Tends* to act as
resistance" / "as support", and promoting that hedge into the label would drop the hedge. Adding a new
side mark would be a new pattern, i.e. an Amendments event, and is out.

### 4.2 The connection chip — six states

| State | Label | Tone | Leading mark | Dot pulse |
|---|---|---|---|---|
| live | `live · {open\|pre-market\|after-hours\|overnight} · mid ${mid}` | signal tint | filled dot | **yes**, only while genuinely live **and** reduced motion is off |
| closed | `market closed · mid ${mid}` | **neutral**, never warning | hollow ring | no |
| overnight | `overnight — no live data · mid ${mid}` | warning **+ icon** | warn icon | no |
| no ticks | `no live ticks · mid ${mid}` | warning **+ icon** | warn icon | no |
| offline | `Live offline — reconnecting…` | warning **+ icon** | warn icon | no |
| replay | the **shipped** `sessionTapeStanding.ts` sentence for the current standing, verbatim | outline; tone varies by standing — `gap`, `ended`, `drop` and `fault` are warning-toned with the stroke warn icon | hollow ring, never filled | **never, in any standing** |

**The shipped string wins over the preview.** Where `design/src/components/chip.mjs` and the app
disagree on a string, the app's string binds: keep the `$` on the mid, and keep the mid on the
overnight chip — naming the number the page is showing is what stops the chip being a bare scold. The
seven replay sentences are the shipped ones, not a rewrite, with exactly one change required by the
canon's Icons row: `drop` and `fault` drop the literal `⚠` from the string and set the stroke warn icon
instead. The `⏸` / `○` / `⚠` characters become stroke icons **only inside `FigureCell` and the
connection chip** this phase.

**Before the first stream fact** the chip slot shows the wordless cold-skeleton placeholder — no tone,
no dot, no connection vocabulary, no "connecting…". It is the visible **absence of a claim**, declared
as the LOADING class, not a seventh state; once a fact arrives the chip latches to one of the six and
can never return.

**Why no seventh is needed.** The six close over three questions: *is a stream connected to us?*
(`offline` vs the rest) · *is the venue producing ticks?* (`live` / `closed` / `overnight` / `no ticks`)
· *is the source the venue at all?* (`replay`). "Stale" is a freshness claim about the structure
snapshot and already lives at the panel head — a second freshness authority on the chip is out.
"Degraded"/"partial" is unfalsifiable. "Delayed feed" is a property of the feed already named in the
live tip.

**Screen-reader announcements** (one page-scoped announcer, `polite`, on class change only, never on a
tick or a mid change): live → `Live stream connected. Market open. Mid 573.12 dollars.` · offline →
`Live stream offline. Reconnecting. Structure levels are still current.` · closed → `Market closed.
Showing the last completed session. Mid 573.12 dollars.` · overnight → `Overnight session. No live data
from the provider. Mid 573.12 dollars.` · no ticks → `No live ticks arriving. The feed may be lagging.
Mid 573.12 dollars.` · replay → `Session replay. SPY, Wednesday September 2. Not a live feed.`

### 4.3 Navigation

| # | State | What the user sees |
|---|---|---|
| N1 | Default link | secondary label, 600 weight, no underline |
| N2 | **Active link** | primary label + a 2px amber underline, **and `aria-current="page"`** — colour alone is not the state |
| N3 | Hover / focus | hover → primary; focus → the one authored theme ring, never a bespoke one |
| N4 | **< 900px** | links collapse behind a labelled burger (`aria-label="Open navigation menu"`) opening a drawer whose links unmount when closed; wordmark, search affordance and session control stay in the bar |
| N5 | **< 1100px** | the `Jump to a ticker…` field becomes a search **icon button** with an accessible name; the ⌘K hint drops with the field and the shortcut still works |
| N6 | Signed out | `Log in` (ghost) + `Sign up` (primary pill). No avatar, no claim about saved state |
| N7 | Session chip | amber avatar with the account initial, `aria-label="Account settings"`. It is a *link to settings*, not a status |
| N8 | Session loading | the shipped non-blocking read; the bar renders regardless, never a blocking spinner |

**Removed from the drawing on purpose:** the nav clock (`design/src/lib.mjs:211` draws a `live`-toned
chip with a pulsing dot reading `Open 10:42:07 ET`) and the bell. On the ticker page that is a **second
pulsing liveness claim**; on Scanner and Positions it wears a live tone over no stream at all; and it
would need a keyframe in a phase that declares zero. If the owner wants the clock later it returns as a
**neutral** chip with **no dot**, labelled as a *venue* clock.

Lab and Blog move to the footer. No `/_ops` entry in the bar, the burger, the footer or the palette.

### 4.4 The ⌘K palette

| # | State | What the user sees / can do |
|---|---|---|
| P1 | Closed | the nav affordance only: `Jump to a ticker…` + a `⌘K` kbd pill; under 1100px a search icon button |
| P2 | Open — empty query | dialog over the `scrim` token at the dialog rung; input focused; body shows the **tracked-universe default view** (never an empty box); footer helper row `↑↓ move` · `↵ open ticker` · `esc close` |
| P2a | Open — ranked read in flight | the dialog is **fully usable**: input focused and taking text, the four surface commands navigate, a typed symbol opens. The tracked-universe rows are **skeleton rows in their final shape** — no tier, no score, no status word, never a `0` and never a blank where a score goes. This is the LOADING class (canon rule 3), visibly distinct from AC-30's unavailable copy and from an empty list; it resolves **once** and is never re-entered (§2.6) |
| P3 | Typing | results filter as a prefix-then-substring match **on the symbol**; the first row is pre-selected and `aria-activedescendant` points at it |
| P4 | No results | one line, not a blank list: **`No tracked symbol matches "{query}".`** plus a single action **`Open {QUERY} anyway →`** when the query is a plausible ticker. It says *tracked* because "no results" means "not in the scanner universe", **not** "this ticker does not exist" |
| P5 | Keyboard-only | ⌘K / Ctrl-K opens from anywhere in the shell; ↑↓ move, ↵ opens the ticker, Esc closes. Focus is trapped while open and **returns to the invoker** on close. Every result is reachable without a pointer |
| P6 | Dismissed | Esc, scrim click or route change closes it; the query is discarded; focus restored; no toast |

**Copy that will not be written, and why.** No company names: `apps/api/config/universe.json` is a bare
symbol array and no name field exists on the ranked row, so `NVIDIA` beside `NVDA` would be a label
with no vouched source. `not in universe` stays a caption meaning exactly *"not in the scanner's
tracked universe"* — never "not tradeable", never "no data" — and renders in the secondary tone, never
in warning. Tier and score carry their status and their freshness (§2.6); a bare score, a blank, or a
`0` on the pre-decision surface is a fabricated claim.

**Reduced motion.** Motion stops; **the claim does not.** Live dot → static and fully opaque. Widget
live bar → static at resting opacity. Flash-on-tick → no colour transition at all (not a colour hold,
because green/red are reserved for direction). Skeleton shimmer → static block at the mid tone, still
visually distinct from empty. Bottom sheet → snaps. The gate is the shipped `useReducedMotion`, never a
global `animation: none` sweep.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` — **Status: SET — Curvature
Terminal v2**.

**Design direction.** This phase implements canon rules **13** (figure cell replaces `StatTile`), **17**
(six breakpoints + container queries + the checked widths, 834 added, 900 kept), **18** (one connection
chip, six states), **19** (four product links + ⌘K palette + session chip; Lab and Blog to the footer),
**20** (hover-revealed controls always have a tap/focus path), **21** (panels are container-query
contexts), **22** (liveness is gated), **23** (type register) and **24** (closed not-a-number
vocabulary), plus the Tokens table's declared spacing / radius / z-index / breakpoint axes and the
seven additive surface/line names. Values live only in `tokens.ts`; no token table is restated here.
Rules **14** (level ladder), **15** (read strip) and **16** (AI read brief) are phases 2–4 and are not
touched. Three canon follow-ups this phase's rulings create are listed in §9.

<!-- spire:council-resolution:v1 b857b263c8e99a746e269ad78493fbb221fa6c399c01ef5f8367aebd21385bd7 folded -->
<!-- spire:council-resolution:v1 db7e425e308bdb8a83ba07abc618789010f2e67d014f096ffd3840b440856f7c folded -->
<!-- spire:council-resolution:v1 525f1a43adcfdb1c0cc66ae9084b504631c929e1e74a8854bec267be2e9707ad folded -->
<!-- spire:council-resolution:v1 450285a7ae8203799b39710dfe7aa5bda0e654a9f282615b2f92c00863f05471 folded -->
<!-- spire:council-resolution:v1 aa432be6d12ad36fee5aea86d4479818406ebd4479e3e568e804e43d185222ce folded -->
<!-- spire:council-resolution:v1 dd0cb65b00e140ef0f52850ea8c49e5c78c908be885618d369c9159d0a52425f folded -->
<!-- spire:council-resolution:v1 995f0a853e8d38360ef659a54d54c0f92abbad510fff3ba191480961635c6343 folded -->
<!-- spire:council-resolution:v1 6220020c9519f37ab2f2f29785a070d9b1f51132feda21f4a4f860861a59808c folded -->
<!-- spire:council-resolution:v1 ec06153aae34152f80c21317c4eae78b149ce492fbaa23bd65ea94e8b280161d folded -->

## 5. Error handling

- **Stream drop past the 15s watchdog.** Chip → `offline` with the warn icon and "reconnecting…". Every
  live-derived figure takes F4 (retained) or F5 (no retained value); in phase 1 Net flow and Spread
  take **F5** — the bare absence literal with the pause marker and the caption `offline`, with **no**
  `last known` clause. Static figures in the same strip keep rendering at full strength with no offline
  marker. The chart and every static section keep the last bundle. Nothing is blanked. Logged: nothing
  new.
- **Cold start with no stream fact.** Chip slot → wordless placeholder; figures → `cold-skeleton`. This
  is the LOADING class, never an offline state and never a connection claim.
- **Cold-start bundle failure.** The only blank desk: an error naming what failed, a Retry, and a usable
  toolbar. Unchanged.
- **Poll failure after a first success.** Last bundle retained behind a soft "couldn't refresh" warning
  that states its age. Visually and in the DOM distinct from `offline`.
- **Replay armed.** Chip → `replay` with the shipped standing sentence; figures render Mono at full
  strength with no dot, no pause mark and no `offline` caption. A faulted, ended, dropped or
  wrong-symbol replay is distinguishable **in words**, and none of them says "Live offline".
- **Scan read fails on palette open.** The palette opens; the four surface commands and the typed-symbol
  path still work; the ranked section shows an honest unavailable state. No retry storm — the read is
  one-shot per open.
- **A symbol's ranked row is incomplete.** `building` → `—`; `error` → `unavailable`; `stale` → the
  score with its sweep age. Never `0`, never blank.
- **Signed-out navigation to a gated surface from the palette.** The same visible sign-in wall the nav
  link produces, with the same onward free path. Never a blank page, never a silent bounce to landing.
- **A not-a-number value reaches a figure slot.** It renders as a Sans literal at the literal size,
  never in the mono figure register and never carrying a unit. A composed string such as `$—` is a
  defect, not a state.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/curvature-v2-foundations/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** this phase is **`NO_BACKEND_CHANGE`** — the `apps/api` diff must
be empty (`[additive-keeps-score-byte-identical]`). No endpoint, field, query parameter, persistence
shape, route, score input or streaming behaviour is added or altered. Two existing anonymous-open reads
are consumed **unchanged** — the ticker bundle and the ranked scan read the palette calls once on open
— and the interface file pins the fields this phase depends on **and states the limits of each pin**:
which criteria the block turns into checked ones, which it checks only asymmetrically, and what a pin
cannot see at all. Read those limits there before relying on a pin at GATE Q; do not infer from this
summary that every wire change is caught. The authoritative field list, and the stated reach of the
conformance block, live in that file, never here.

## 7. Testing strategy

**Risk-based, not one-test-per-AC.** `test` where a silent regression under an unrelated change is
plausible or where the observable is negative space; `review` where a human on a normal pass would
always notice the break (copy, per-screen appearance, greyscale legibility). Several rows are covered
by one matrix or one flow.

**Tiers.** Unit — the resolver's enumeration over `kind` × `standing`, the token key-set twins, the
banned-literals and radius/spacing exemption scans, the `NotANumber` closure. Component — the nine
`FigureCell` states, the ⓘ keyboard path, the four-way DOM exclusivity of F2/F5/F7/F8. Flow-integration
— the stream-drop walk, the cold-start walk, the palette keyboard walk including the signed-out wall;
these mock **only the network boundary**, never a live backend. Browser (Playwright) — one-chip-in-
viewport at two scroll positions, the container **rendered** step at one fixed viewport, the
coarse-pointer 44px measurements, and the four-width two-scheme overflow sweep.

**Specs added or amended in the same change that lands the behaviour** (a spec encoding the superseded
direction red-builds correct code): `StatTile.spec.tsx` → `FigureCell.spec.tsx` (rewritten, old file
deleted) · new `connectionChip.spec.ts` (six-kind enumeration + importer set-equality, resolver not
barrel-exported) · new banned-literals scan seeded from `tokens.ts` · new radius-scale and spacing-ladder
scans with live-checked exemption lists · `type-floor.spec.tsx` (**reader hardened first**, then the
container-step assertions) · `single-motion-moment.spec.ts` (enumerated exemption → the data-signal
class, with the predicate itself tested) · `stage3-amber.spec.ts` `HOVER_CENSUS_FILES` re-pointed ·
`compatibility.spec.ts` `tape-stream-state` re-pointed · `no-overflow.spec.ts` (add 834, keep 900, add
`/alerts`, amend the drawer link assertion, vacuity guard per added width) · `arc.spec.ts` **verified,
not amended** (expected result: no fourth importer).

**Mutation proofs are part of done**, per `[structural-over-prose-enforcement]`: poison the thing the
rule forbids and the build must go red, and each poison test must itself be proven non-vacuous. The
required proofs are named in the completion-evidence column of AC-7, AC-13a, AC-19, AC-44 and AC-54.

**Invariants that must never silently regress:** the register (mono vs Sans) · the per-figure dot's
gating · the one page-scope liveness authority · the closed absence vocabulary's non-synonymy · the arc
budget of three · the keyframe inventory · dark/light parity · zero hardcoded colour literals · the
empty `apps/api` diff.

**Honest limits, recorded rather than papered over.** jsdom cannot observe a container-query render, so
AC-20b is browser-only and AC-20a is **UNVERIFIABLE until `type-floor.spec.tsx:39`'s reader is
hardened**. `nx test` cannot see the `extrasLight` parity guarantee — `npm run typecheck` is mandatory
before any green claim. The extended overflow matrix's runtime is **unpriced**; the cut rule in AC-38
binds if it exceeds budget.

## 8. Guardrails this feature must not break

- **`[theme-token-discipline]`** — token-only, dark/light parity, zero hardcoded hex **and** zero
  hardcoded `rgba()` token literals; mode-aware values through `extrasFor(theme)` inside `sx` callbacks,
  never bare `extras`. Ruling #18's scope is untouched: this phase adds no `success`/`error` consumer.
- **`[single-motion-moment]`** — the hero curve-draw stays the one orchestrated moment. **Zero new
  keyframes this phase.** The value flash reuses the existing dynamic flash family; the live dot reuses
  `liveDotPulse`, whose single declared home is pinned — if the dot moves into `FigureCell` or the chip,
  the **declaration must move, not be copied**, or set-equality red-builds.
- **`[live-vs-static-isolation]`** — the chip may never fake live; a cold skeleton is not an offline
  state; a snapshot surface never wears a live chip, dot or pulse.
- **`[structural-over-prose-enforcement]`** — every rule this phase lands ships as a spec with a
  proven-non-vacuous poison test, not a paragraph.
- **`[additive-keeps-score-byte-identical]`** — empty `apps/api` diff, enforced as a build step. Nothing
  here reaches `opportunity_score`, `opportunity_tier`, the entry gate or `state_fingerprint`.
- **`[ai-asserted-numbers-are-traceable]` + `[digested-labels-not-raw-dump]`** — the register is the
  render of the first: `FigureCell` cannot default to mono. The palette renders the wire's status and
  tier through a closed lookup and **never re-derives a label from the score**.
- **`[absent-is-not-none]`** — the closed vocabulary is a type, not prose; members never substitute for
  one another; never `undefined`/`null`/`NaN`.
- **`[operator-vs-trader-path-separation]`** — the four nav links and every palette result set expose
  trader surfaces only; `/_ops/*` stays unlinked and unreachable, enforced by membership test and source
  scan.
- **`[loss-free-durable-migration]`** — no new durable client store and no change to any existing key or
  shape; the rule does not fire this phase.
- **`[cited-code-is-verified-not-assumed]`** — every mechanism claim above was read at source during the
  council. Two records were struck as false and must not be re-derived from: "consumed by seven files"
  and "re-exported from the shared UI barrel". A third is stale prose in the tree: `LiveTape.tsx:2` says
  five live-derived tiles; **the JSX renders four — count from the JSX.**

## 9. Open questions

1. **D-1 — the light-mode contrast floor for `steel2`: RULED AND CLOSED** (owner ruling 7, 2026-09-03,
   post-build). *The question as it stood:* the canon recorded a measured dark floor and only "a solid
   light-mode value" for light, so AC-42 recorded the measurement for both schemes but could assert only
   the dark one — no one invented a number and none should have. *How it was settled:* the build measured
   both schemes and the conductor recomputed every figure independently from the raw hexes; the then-current
   light value `#61708A` scored **4.23:1 on `panelRaised` `#ECECE7`**, the widget-card surface a real
   tertiary label sits on, under WCAG AA's 4.5:1 for normal text. The owner ruled **darken it** and declare
   the floor. *The outcome:* light `steel2` is now **`#5D6B84`** in `tokens.ts` and in the
   `design/tokens/tokens.json` mirror (`node design/src/verify-tokens.mjs` exit 0), measuring **4.54:1 on
   `panelRaised`, 4.75 on `well`, 4.97 on `paper`, 5.38 on white** — every light surface where
   `textTertiary` has a real consumer clears 4.5:1. `raised2` (`#E3E3DD`, 4.18:1) is **excluded** because it
   has zero consumers anywhere in the app, and the exclusion is guarded by a test that red-builds the day
   one appears rather than left as a standing assumption. AC-42 is therefore no longer dark-only: both
   floors are asserted by `steel2-contrast.spec.ts`. **Still owed at close:** the canon Amendment stating
   the light floor, so it is enforceable there rather than rediscovered — the conductor's action, not the
   lane's.
2. **The `tooltip` z-index rung is undeclared.** The canon declares six rungs; MUI has eight slots.
   `tooltip` defaults to 1500 — above every v2 rung, which is arguably correct and definitely
   undeclared. §2.2 gives the build a working mapping (`tooltip` above toast; `mobileStepper`/`fab`/
   `speedDial` given values so they do not float above the ladder), but the rung itself is an
   **Amendments-shaped gap** for the owner, not a build decision.
3. **Three canon Amendments this phase's rulings owe, to be filed at close** — none blocks the build:
   (a) rule 24 amended to the shipped **nine** members with each meaning and their non-synonymy
   (ruling 3); (b) a one-line clarification on rule 13 that the `· last known` clause is **conditional**
   on a retained value actually existing (ruling 2); (c) the recorded reading that rule 18 is
   **chip-scoped**, so a conforming figure cell's per-figure dot under rule 13 is not "a second liveness
   claim". Read literally, rules 13 and 18 contradict each other; the council resolved it in favour of
   the chip-scoped reading and the owner was flagged at close.
4. **Accepted cost of one absence vocabulary rather than two** (ruling 3, recorded so it is not
   rediscovered as a defect): nothing structurally prevents a ticker surface from rendering `no basis`,
   which would be meaningless there. No code path produces it today. If one appears, the fix is a
   per-surface **subset**, not a second vocabulary.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"5fad9c5a72e561db6a8757d4c4733698ea25d5c00b2f3b3ece0a01c3295ddde6","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"cf2fcc72f0f00cf5cd07181059f3fcc48c86240bd8f4b616fdf9064fb03f4bdd","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"452fab6ba560ca7ed0e5541f565a8387ff460f4aa8401be28f2ad8216cd1a811","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":3,"conflict_id":"b857b263c8e99a746e269ad78493fbb221fa6c399c01ef5f8367aebd21385bd7","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":4,"conflict_id":"db7e425e308bdb8a83ba07abc618789010f2e67d014f096ffd3840b440856f7c","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":5,"conflict_id":"503c14efbf5a2800a96a4343be6691903fa65f455f2b99c4b8d3529fe5433b83","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":6,"conflict_id":"90015cd5e81cd7c6ee92287cd7fba21b7ff764b59c8429d47ef3dcd03c4c876a","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":7,"conflict_id":"ec706307dee7e23e4219a428bc7d8d1d82b2f6366214df7dc7bba396853d13cf","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":8,"conflict_id":"525f1a43adcfdb1c0cc66ae9084b504631c929e1e74a8854bec267be2e9707ad","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":9,"conflict_id":"3918eecaf1aae62c3a49188054ba7d839d41d58bf83a16aa84ea4cb9a548ba0f","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":10,"conflict_id":"f71300e9f2ae8c5600901c0bed38407cd0675682bb4b72e3de92b63a61c243ca","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":11,"conflict_id":"5a16f0ad6880a7763602a08a6355d800ffe20d882155e3245bcb7f008a486611","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":0,"conflict_id":"450285a7ae8203799b39710dfe7aa5bda0e654a9f282615b2f92c00863f05471","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":1,"conflict_id":"a0c40ded79e91c1229875564d4aa825c7c1e917489e4773a153e4e8bb49dbbb7","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":2,"conflict_id":"5954bcc2c763536003ab18175a7d3ec37c298f1c87624d2abc246b6625bbfd93","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":3,"conflict_id":"eb31c384d9299c449a616d93424601254d734499b9bc7eaa1c9d1e6e31bcce2a","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":4,"conflict_id":"faafda397d27a3a2b46236e89f7e46863c6922cc52177c9cdbfc03d92fc9bbef","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":5,"conflict_id":"aa432be6d12ad36fee5aea86d4479818406ebd4479e3e568e804e43d185222ce","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":6,"conflict_id":"e4de8e35ec86d68be1e867833f07dfe3b94e8a04e1478930150e336e5664d517","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":7,"conflict_id":"4a559879193fef82d458c3280342982beea72bf13c640f71c2c8713145437281","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":0,"conflict_id":"dd0cb65b00e140ef0f52850ea8c49e5c78c908be885618d369c9159d0a52425f","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"995f0a853e8d38360ef659a54d54c0f92abbad510fff3ba191480961635c6343","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":2,"conflict_id":"318d520712341d609e8049077737f980018280731669aa46feb0d36126662e87","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":3,"conflict_id":"b3faafb19c0e908b01f7fe49263d4e3fb846f4e96078c17fd78e60eae290c828","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":4,"conflict_id":"d2fec026316bb33192e8206cb83fa8b0573499f5ceb99075725c818d3349170f","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":5,"conflict_id":"6220020c9519f37ab2f2f29785a070d9b1f51132feda21f4a4f860861a59808c","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":6,"conflict_id":"41e15b9946205a268b77882f33b7532fc8eafbae53b54e7e322c2257284cd664","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":7,"conflict_id":"df1fb1c9f3754ad714f51f331c4f17de5181b3d94f6cc7798f079c55804362dd","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":8,"conflict_id":"9511b567ca3c9d2c9049414b38098eb6590ba821b4a7e073ca4f6996826942f6","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":9,"conflict_id":"ec06153aae34152f80c21317c4eae78b149ce492fbaa23bd65ea94e8b280161d","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":10,"conflict_id":"7bd2d4f7cb3613ba9b6f280e89abc826b65088fa717d6c4faa3ad04c577b428f","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":11,"conflict_id":"d69d370093d698c1a6f9b829ebe7f0126e8eef3334a9a9b36a413448470bab1c","disposition":"folded","section":"§1"}]}
-->
