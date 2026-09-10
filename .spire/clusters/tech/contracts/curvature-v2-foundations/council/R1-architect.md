# R1 — architect position: curvature-v2-foundations

> Every load-bearing claim below is marked **[verified]** (read at source this session, with the file
> named) or **[assumption]** (attackable in R2). `[cited-code-is-verified-not-assumed]` is a promoted
> invariant; an unmarked mechanism assertion in this document would be a defect.

---

## Position

### 0. Binding constraints I restate and build under

From the BRIEF's `Invariant watch`, in my lane:

- **`[theme-token-discipline]`** — the seven additions land in `tokens.ts` **first**; zero hardcoded
  hex; dark/light parity is part of done; mode-aware values resolve through `extrasFor(theme)` inside
  an `sx`/styled callback, never bare `extras`. Ruling #18 scope is unchanged by this phase: I add no
  `success`/`error` consumer, so the signed-P&L-vs-call-put split is untouched.
- **`[single-motion-moment]`** — the hero curve-draw stays the one orchestrated moment. This phase
  adds **no keyframe**. The `FigureCell` value flash reuses the existing dynamic `flash-*` family
  declared only in `shared/hooks/useFlashOnChange.ts` [verified: `single-motion-moment.spec.ts:36`
  pins `FLASH_HOME`]; the live dot reuses `liveDotPulse`, whose single declared home today is
  `pages/ticker/widgets/chrome/TickerHeader.tsx` [verified: same spec, `KEPT_KEYFRAMES`]. If
  `FigureCell` or a unified chip needs the dot, the **declaration must move, not be copied** — the
  spec asserts `inventory[name] === [home]`, so a second declaration site is a red build.
- **`[live-vs-static-isolation]`** — the connection chip may not fake live; a cold skeleton is not an
  offline state; a snapshot surface never wears a live chip. This is the isolation rule I make
  structural in §4.
- **`[structural-over-prose-enforcement]`** — every rule this phase lands ships as a spec with a
  proven-non-vacuous poison test. §8 is the ledger.
- **`[additive-keeps-score-byte-identical]`** — **`apps/api` must have an EMPTY diff.** Mechanism, not
  intention: a gate check that `git diff --name-only <merge-base>..HEAD -- apps/api` returns zero
  lines, run as a build step, the `outcome-ledger` precedent. Nothing here reaches
  `opportunity_score` / `opportunity_tier` / the entry gate / `state_fingerprint`. The palette
  consumes existing reads only; it computes no score and re-derives no label.
- **`[ai-asserted-numbers-are-traceable]` + `[digested-labels-not-raw-dump]`** — the type register is
  the render of the first: mono = traced to a Convexa computation; Plex Sans + dotted rule = asserted
  and untraced. `FigureCell` must not be able to *default* to mono: see §3's `register` typing.
- **`[operator-vs-trader-path-separation]`** — the four nav links and every palette result set expose
  trader surfaces only. `/_ops/metrics` and `/_ops/research` stay unlinked and unreachable from the
  palette's index. This is enforceable as a membership test over the palette's static command table
  plus a scan asserting no `/_ops` literal in shell or palette sources.
- **`[absent-is-not-none]`** — `FigureCell` renders the closed not-a-number vocabulary (canon rule 24,
  six members) as text, never as a figure, and never as `undefined`/`null`/`NaN`.

Additional constraint I am adopting for this phase and will defend: **no visual behaviour in this
phase is allowed to depend on a value read from `design/tokens/tokens.json` at runtime.** Canon says
so; the mechanism is that nothing under `apps/dashboard` may import from `design/`, which the
`@nx/enforce-module-boundaries` project graph already makes true (`design/` is not an Nx project and
sits outside every project's source root) [assumption — I did not run the lint rule against a poison
import this session].

---

### 1. The seven token additions: exactly where each binds, and why

`tokens.ts` today exposes three shapes that matter here [verified, `shared/theme/tokens.ts`]:
`palette` (per-scheme MUI palette values, consumed by `theme.ts` and emitted as `--mui-palette-*`
because `cssVariables: true`), `extras` / `extrasLight` (presentation-only, no CSS var, resolved by
`extrasFor(theme)`), and `elevation` / `elevationFor`.

| Addition  | Binds to | Why that slot and not another |
| --------- | -------- | ----------------------------- |
| `line`    | **`palette.{dark,light}.divider`** (a real MUI palette slot) | The app already binds `borderColor: 'divider'` / `theme.palette.divider` nearly everywhere — `Widget.tsx`, `StatTile.tsx`, `TopNav.tsx`, the `MuiSnackbarContent` override all do [verified]. Binding `line` to the `divider` slot lands the hairline **at every existing call site with zero diff there**, and gives it a `--mui-palette-divider` var that Canvas/WebGL code could later read. Any other home would require touching ~40 files to get the same result. |
| `line2`   | **`extrasFor(theme).lineStrong`** | There is no second MUI divider slot, and inventing `palette.divider2` would emit a non-standard `--mui-palette-*` var that MUI's own components would never consume. It is presentation-only, so it belongs in `extras`. |
| `ink2`    | **`extrasFor(theme).well`** | The "well" is a *surface role* MUI has no slot for. `Widget`'s `bodyVariant: 'inset'` currently fakes it with `theme.palette.background.default` [verified `Widget.tsx:135`], which is `ink`, not `ink2` — the mirror gives dark `#0D121B` vs `ink` `#0B0F17`. Binding `ink2` here is a **one-call-site** change that makes the recess a real token instead of a reuse of the canvas. |
| `raised2` | **`extrasFor(theme).panelRaised2`** | Sits directly beside the shipped `extras.panelRaised`; same class of value, same resolution path, so it inherits `panelRaised`'s parity guarantee for free. |
| `steel2`  | **`extrasFor(theme).textTertiary`** | **Explicitly NOT `palette.text.disabled`.** `text.disabled` is `rgba(138,155,180,0.5)` [verified `tokens.ts:67`] and *means* disabled; `steel2` is measured `>=4.8:1 on panel` and means tertiary body text. Collapsing them would let a legible tertiary label inherit disabled semantics for assistive tech and would silently lower the measured contrast of every tertiary string. Two names, two meanings. |
| `scrim`   | **`extrasFor(theme).scrim`, consumed once at the theme layer via `MuiBackdrop.styleOverrides.root`** | A scrim is only correct if *every* overlay gets it. Binding it as an extras key and then leaving each dialog to opt in reproduces exactly the drift the canon is closing — and `Widget.tsx:437` already hardcodes `rgba(0,0,0,0.6)` for its own backdrop [verified]. A single `MuiBackdrop` override in `theme.ts` `COMMON.components` makes it default-correct and deletes that literal. |
| `glass`   | **`extrasFor(theme).glass`, consumed by `TopNav`'s AppBar** | `TopNav` currently *computes* translucency with `alpha(t.palette.background.paper, scrolled ? 0.9 : 0.82)` [verified `TopNav.tsx:105`]. The mirror's dark `glass` is `rgba(19,26,36,0.82)` — the same thing as the un-scrolled arm, expressed as a value instead of a computation. Binding it kills the computation. **Named gap:** the mirror has no token for the *scrolled* 0.9 state; §"Risks" carries it. |

**How dark/light parity is guaranteed structurally, not by review.** It already is, and this phase
only has to not break it: `extrasLight` is declared `Record<keyof typeof extras, string>` [verified
`tokens.ts:140`]. Adding a key to `extras` without adding it to `extrasLight` is a missing-property
type error; adding it to `extrasLight` alone is an excess-property error. The guarantee is therefore
**bidirectional and compile-enforced**. Two caveats I will not paper over:

1. It bites under `nx typecheck` / `nx build`, **not** under `nx test` — Vitest transpiles without
   typechecking, which is a documented three-time failure in this repo (`CLAUDE.md` Traps). So I also
   want a cheap runtime twin in the theme spec: `Object.keys(extras).sort()` deep-equals
   `Object.keys(extrasLight).sort()`. It costs three lines and makes parity fail in the fast loop.
2. The `divider` half is **not** covered by that type, because `palette.dark` / `palette.light` are
   two independent object literals with no shared key type [verified `tokens.ts:59-80`]. So the same
   theme spec must assert set-equality of the two palette objects' key sets. Without it, `line` could
   land dark-only and nothing would fail.

**Why the seven additions do not break `hex-discipline` / `banned-hexes`:**
`hex-discipline.spec.ts` excludes `shared/theme/**` by construction and only matches
`/#[0-9a-fA-F]{3,8}\b/` [verified]. `banned-hexes.spec.ts` scans all of `src/app/**` including
`shared/theme` but only against a fixed retired list; none of the seven values appear on it
[verified — the list is `4f9cff 1d6fe0 7b5cff 0d1117 161b22 8b949e e6edf3 f4f1eb 0e1117 faf8f4
e7e2d8 f3e3d9 f6eedd`]. So both stay green **by construction** once the values live in `tokens.ts`.

**But there is a hole this feature opens, and it is mine to close.** Five of the seven dark values are
`rgba(...)` strings, not hex: `line`, `line2`, `steel2`, `scrim`, `glass`. `hex-discipline`'s regex
cannot see an `rgba()` literal. A component could hardcode `rgba(138,155,180,0.16)` tomorrow and the
suite would stay green — the exact failure class the spec exists to prevent, re-opened by this
feature's own value shapes. The fix is **not** a blanket `rgba(` ban: `StatTile.tsx`, `Widget.tsx`
and others legitimately use neutral black/white overlay alphas [verified]. The mechanism is a
**banned-literals scan seeded from `tokens.ts` itself**: import the token values, normalise
whitespace, and assert none of those exact strings appears in any component source outside
`shared/theme`. It is self-maintaining (change a token, the ban list follows) and mutation-testable
(poison a fixture with the literal, the checker must fire).

---

### 2. The declared scales: what actually lands

**Spacing (4-pt ladder 4·8·12·16·20·24·32·40).** No theme change is needed. MUI's default spacing
unit is 8, so the whole ladder is already expressible as `0.5 1 1.5 2 2.5 3 4 5` — the canon says as
much ("MUI theme spacing remains the mechanism; the ladder is what may be spent"). The work is
**enforcement, not migration**. Sizing it honestly: a scan for off-ladder `sx` spacing multipliers
(`0.25 0.75 1.25 1.75 2.25 2.75 3.5`) returns **86 occurrences across 35 files** today [verified by
scan]. An app-wide hard ladder is therefore an 86-site burn-down that this phase must not swallow. My
position: land the scan **now** with a live-checked, per-file exemption list seeded with today's 35
files (the `hex-discipline` EXEMPT idiom, including its stale-entry test), and require the new v2
primitives to be on-ladder from birth. That gives a red build for new violations and a visible,
countable debt for phases 2–4.

**Radius (panel 12 / dialog 16 / control 8 / pill 999).** `shape.borderRadius: 10` moves to 12
[verified `tokens.ts:83`]. What that actually touches, in order of how surprising it is:

1. **The numeric `sx` form re-scales by 1.2x, silently.** MUI's `borderRadius` sx transform is
   `createUnaryUnit(theme, 'shape.borderRadius', 4, 'borderRadius')` [verified
   `@mui/system/borders/borders.mjs:35`], i.e. `borderRadius: n` means `n * shape.borderRadius`px.
   So `borderRadius: 2` is 20px today and **24px** after — not 22. A scan finds roughly two dozen
   bare-number `borderRadius` sites (`AuthDialog`, `SettingsPage`, `AiKeySection`, `DecisionCard`,
   `reasoning`, `AiRecPanelBlocks`, `Setups`, `AlertsPage`, `ComingSoonBox`, `OrdersWidget`,
   `ValueCard`, `Refused`, `ErrorBoundary`, `FreshPositioning`, `OffExchangeBlocks`,
   `RiskInputsSection`, ...) [verified by scan]. Several of those are plain style objects rather than
   `sx`, where the number is raw px — so the migration **requires a per-site read**, not a global
   find-replace. Anyone who treats "10 to 12" as a two-pixel change is wrong by construction.
2. **One value cannot serve four roles.** `shape.borderRadius` feeds Card, Paper, Alert, Button,
   input outlines, Menu/Popover paper, Dialog paper and the repo's own `MuiSnackbarContent` override
   [verified `theme.ts:141`]. Setting it to 12 gives panels 12 *and* dialogs 12 *and* buttons 12 —
   which lands one of the four declared roles and breaks two. The mechanism for the other three is
   **theme component overrides in `COMMON.components`**: `MuiDialog.styleOverrides.paper` -> 16;
   `MuiButton` / `MuiOutlinedInput` / `MuiFilledInput` / `MuiInputBase` / `MuiToggleButton` -> 8;
   pills stay a local `999px` (already the idiom in `TintChip`, `QuickSymbols`, `TickerHeader`).
   Without those overrides the radius scale is declared but not landed.
3. **Components already at 12 are no-ops.** `Widget.tsx` and `StatTile.tsx` hardcode `'12px'`
   [verified]; `Widget`'s expand dialog already hardcodes `'16px'` [verified `Widget.tsx:444`].
   Those three literals should become theme-derived, not stay literal.

**Z-index ladder (nav 20 / sheetScrim 29 / sheet 30 / popover 35 / dialog 40 / toast 50).** Mechanism:
override `theme.zIndex` in `COMMON`. The mapping is not one-to-one and must be written down, because
MUI's ladder has **eight** rungs and the canon declares **six** [verified `@mui/material/styles/zIndex.js`
= `mobileStepper 1000, fab 1050, speedDial 1050, appBar 1100, drawer 1200, modal 1300, snackbar 1400,
tooltip 1500`]. My mapping: `appBar` -> 20, `drawer` -> 30, `modal` -> 40, `snackbar` -> 50, and
`tooltip` -> a value **above** 50 that the canon does not name. Only one app site reads
`theme.zIndex` at all — `AppShell.tsx:42`, `theme.zIndex.tooltip + 1` for the skip link [verified] —
so the blast radius is one file plus whatever MUI does internally. `mobileStepper`, `fab`,
`speedDial` have no consumers in this app [verified: zero matches] but must still be given values or
they keep their 1000-1050 defaults and would sit **above** every v2 rung.

**Breakpoints (1600 / 1300 / 1100 / 1000 / 768).** This is where I most want R2 to push back, because
the safe answer and the obvious answer diverge.

The obvious answer — redefine `breakpoints.values` — is **wrong**. 57 `sx` sites across 26 files use
`xs`/`sm`/`md`/`lg` keys, and four hooks call `breakpoints.down('sm'|'md')` / `up('lg')` [verified by
scan: `Scanner.tsx:87`, `TradeEntryDialogView.tsx:166`, `BrokerTabPanel.tsx:59`, `AuthDialog.tsx:67`,
`PositionsView.tsx:141,144`]. Redefining the values silently changes what every one of those means,
in a phase whose stated non-goal is that no screen is re-laid-out.

The mechanism I propose instead: **add the five v2 bands as named keys alongside the five defaults**.
`createBreakpoints` accepts an arbitrary `values` map and sorts it ascending, deriving `keys` from it
[verified `@mui/system/createBreakpoints/createBreakpoints.mjs:8-38`], so a ten-key map
(`xs 0, sm 600, tablet 768, md 900, smallLaptop 1000, laptop 1100, lg 1200, desktop 1300, xl 1536,
wide 1600`) is legal and leaves every existing key's value **byte-identical**. Two consequences I
checked rather than assumed: `breakpoints.only()` and `.not()` derive from adjacent keys and would
change meaning — **no app source calls either** [verified by scan], so this is safe today and needs a
spec pin so it stays safe. And `createEmptyBreakpointObject` allocates one entry per key per `sx`
call, so ten keys doubles that allocation; `removeUnusedBreakpoints` drops the empties before
serialisation [verified `styleFunctionSx.mjs:70`], so the output is unchanged and the cost is
render-time only [assumption: the cost is negligible — unmeasured].

The canon's e2e widths (393 / 834 / 900 / 1280) are **not** the same list as the six page bands, and
that is fine: the bands are authoring guidance, the four widths are the overflow probe.

---

### 3. `FigureCell` — the component boundary and the migration mechanism

**Recommendation: new component, in place of `StatTile`, with a bounded sweep and no deprecation
window.** Not "parallel with a deprecation", and not "rename `StatTile.tsx`".

The migration surface is far smaller than it looks. Real importers of the component are **two files**:
`pages/ticker/widgets/dealer-positioning/DealerPositioning.tsx` (12 render sites) and
`pages/ticker/widgets/live-tape/LiveTape.tsx` (4 render sites), plus `TickerDashboard.tsx` which
imports only `StatSkeleton` from the `_kit` barrel [verified by scan — every other match is a prose
comment]. Sixteen render sites in two files is a hand-edit, not a codemod. A parallel-with-deprecation
window would leave the accent bar in the tree, which is the exact outcome the BRIEF culled
("tokens-only patch without the primitives").

**Boundary and location.** `FigureCell` is a *figure* primitive, not a *ticker* primitive: canon rule
15 puts it in the read strip and rule 16 puts its register in the AI brief, and phase 3 puts it on
scanner/positions. Under the repo's "populate `shared/` on the 2nd consumer" rule it is still
one-consumer today. My position: build it at `pages/ticker/widgets/_kit/FigureCell.tsx` **now** and
promote to `shared/ui/` at its second consumer in phase 2 — resisting the temptation to pre-place it,
because `pages/` never imports a sibling page and `shared/` promotion is cheap.

**The prop contract, as data-structure content (not layout):**

- `register: 'traced' | 'asserted'` — **required, no default.** This is the `[ai-asserted-numbers-are-traceable]`
  enforcement: mono cannot be the fallback a careless caller gets. A cell that cannot say where its
  number came from must not compile.
- `value: string | NotANumber` where `NotANumber` is the **closed six-member union** from canon rule
  24, exported as a type. The cell branches on membership, not on a string match, so a seventh literal
  is a type error rather than a render bug. (`design/src/components/figure-cell.mjs:14` currently does
  this with a runtime `Set` — correct behaviour, weaker enforcement.)
- `live?: boolean` — drives the label-row dot **only**. It is the caller's assertion that the value
  came from the stream. See §4 for why that is not enough on its own.
- `offline?: boolean` — last-known at 50% with the pause marker. Preserved semantics; see the caption
  warning below.
- **No `accent`, no `accentColor`.** Deleting those two props is what makes canon rule 13 structural:
  a coloured edge becomes unexpressible, not discouraged. `DealerPositioning` passes `accentColor`
  today for non-directional tier emphasis [verified] — that emphasis must relocate to the label row or
  be dropped, and that is a UX call, not mine.

**What happens to `StatTile.spec.tsx`:** it is **rewritten as `FigureCell.spec.tsx`**, keeping its two
load-bearing assertions (the offline caption renders only when offline; the skeleton is the LOADING
look, distinct from EMPTY, keyed on `cold-skeleton`) and adding register, container-step and
not-a-number cases. The old file is deleted, not left as a shim.

**Three collateral touchpoints the BRIEF does not name, all verified:**

1. **`stage3-amber.spec.ts` red-builds on the rename.** Its `HOVER_CENSUS_FILES` list contains
   `/src/app/pages/ticker/widgets/_kit/StatTile.tsx` and asserts `expect(src, '... census list is
   live').toBeTruthy()` per entry [verified `stage3-amber.spec.ts:235, 296-300`]. The list must be
   re-pointed in the same change. This is the "re-point pins, do not delete them" precedent from
   `scanner`.
2. **The offline caption string is asserted in at least five other spec files.** `⏸ offline` /
   `cold-skeleton` appear in `ticker.risk.spec.tsx`, `LiveTape.spec.tsx`,
   `DealerPositioning.spec.tsx`, `day-replay-mock-adapter.spec.tsx`, and several positions specs
   [verified by scan, 48 occurrences across 18 files]. If UX changes that copy, those specs move with
   it in the same commit or the suite goes red for a cosmetic reason.
3. **`_kit/index.ts` re-exports `./StatTile`** [verified], and `shared/ui/index.ts` carries a prose
   note about `StatTile` staying ticker-local [verified]. Both are one-line edits, but the barrel is
   what keeps `TickerDashboard`'s `StatSkeleton` import path stable.

---

### 4. The connection chip: six states, no reachable seventh, and the isolation rule

**Where the input comes from — verified data flow.** `useTickerStreamConnection` opens the
page-scoped SSE and publishes `{ live, streamOffline, ticker }` into the external `liveTapeStore`;
`STREAM_OFFLINE_MS = 15_000` is the payload-gap watchdog [verified `pages/ticker/useTickerStream.ts`].
`TickerHeader.connectionChip(live, streamOffline, reduced, routeSymbol, lastPhase)` is the single
resolver; `sessionTapeStanding.ts` branches replay standing **before** `liveStatus` / live-offline
[verified]. So the chip already has exactly one derivation function and one input source. That is the
asset to build on.

**The problem with rule 18 as written.** Today's resolver can produce **twelve** distinct chip shapes,
not six [verified by reading both files]:

- S0 (no `session_tape`): `offline`, `closed`, `live` (four session sub-labels: pre-market / open /
  after-hours / overnight), `overnight` (no data), `no ticks` — and `null` (no chip) when `live == null`.
- S1 (`session_tape` present), from `sessionTapeChip`: `starting`, `playing`, `gap`, `ended`, `drop`,
  `fault`, `not-this-ticker` — **seven** distinct chips with distinct tones and distinct tooltips.

The five S0 states map cleanly onto five of the canon's six. The seven S1 standings all have to
become `replay`. **Collapsing them destroys a shipped honesty distinction** —
`[present-is-live-paid-only]` explicitly names "session-tape standing on replay" as a class that is
not `present`, and `day-replay-mock-adapter.spec.tsx` asserts that `drop` and `ended` do **not** say
"Live offline" [verified `day-replay-mock-adapter.spec.tsx:187,191`]. A literal six-label reading of
canon rule 18 would make the app say less than it truthfully knows.

**My resolution, and it is a design claim I will defend:** rule 18 constrains the chip's **state
vocabulary**, not its **detail**. Mechanism:

```
type ConnectionState =
  | { kind: 'live';      /* only reachable when the paid-live predicate holds */ }
  | { kind: 'closed' }
  | { kind: 'overnight' }
  | { kind: 'noTicks' }
  | { kind: 'offline' }
  | { kind: 'replay';    standing: ReplayStanding }   // closed 7-member union, today's standings
```

Six `kind`s, exhaustively switched with a `never` default arm so a seventh `kind` is a **compile
error**, not a review comment. `replay.standing` carries the detail, and — critically — **no
`standing` may change the chip's liveness claim**: `replay` never pulses, never carries the live dot.
The enforcement is (a) the exhaustive switch, (b) a state-enumeration test that walks a fixture per
`kind` x `standing` and asserts the produced set of `kind`s is exactly the six, and (c) an assertion
that the live-dot/pulse branch is reachable **only** from `kind: 'live'`.

**The isolation rule — a static surface must be structurally incapable of rendering `live`.** Prose
("a snapshot surface never wears a live chip") is what the promoted invariant forbids. Three
mechanisms, in increasing strength; I want all three:

1. **The `live` kind is not constructible from static data.** The resolver is the only exported way to
   build a `ConnectionState`, it takes the live-tape shape as input, and `kind: 'live'` is returned
   only when `genuineIsLive(live, streamOffline)` holds — which already returns `false` whenever
   `session_tape` is present, "poison `live:true` still false" [verified
   `sessionTapeStanding.ts:29-32`]. A snapshot surface has no live-tape value to pass, so it cannot
   reach the branch. Do **not** export a `ConnectionChip` that accepts a `state` prop from arbitrary
   callers; export the resolver and a renderer that only takes the resolver's output type.
2. **Importer set-equality on the resolver module**, the `arc.spec.ts` idiom [verified idiom]: the set
   of files importing the connection-chip module is pinned, so a snapshot page adding a liveness claim
   is a red build rather than a screenshot review.
3. **One rendered claim per page.** This one is *already violated today* and the fix is in scope:
   `TapePulseStrip` renders `⏸ Stream offline` / `Stream off` under `data-testid="tape-stream-state"`
   [verified `TapePulseStrip.tsx:211-214`], a second liveness claim on the ticker page beside the
   header chip — precisely what canon rule 18 says the rule exists to stop. Separately, `CommandDeck`
   keeps the sticky condensed bar **mounted-but-hidden**, so two chip nodes are in the DOM at once
   [verified `CommandDeck.tsx:193-197` comment plus the shared `connectionChip` call at line 96]. The
   spec must therefore count **visible** claims, not attached nodes, or the correct implementation
   fails. My rule: at most one *visible* liveness claim per page, enforced in the e2e layer where
   visibility is real, plus a unit-level assertion that the resolver has exactly one importer set.

**Cold skeleton is not offline** stays as it is: `StatSkeleton`'s `cold-skeleton` testid is the
LOADING class and the page-level three-degraded-states walk keys on it [verified
`StatTile.spec.tsx:32-38`]. `FigureCell`'s skeleton inherits that testid unchanged.

---

### 5. The Cmd-K palette: build on MUI, do not add `cmdk`

**Recommendation: build `CommandPalette` on the MUI `Dialog` + list already in the tree.** Compared on
the four axes the BRIEF names:

| Axis | `cmdk` (new dep) | MUI Dialog + list (in tree) |
| ---- | ---------------- | --------------------------- |
| **a11y / focus-trap correctness** | **This is the decider.** This repo owns a measured, hard-won patch that wraps `ModalManager.prototype.add/remove` so `aria-hidden` never lands on a focused subtree, paired with `MuiModal.defaultProps.disableRestoreFocus` at the theme layer; it is installed once in `main.tsx` and its spec asserts both halves [verified `shared/a11y/modalFocusHandoff.ts`, `theme.ts:129-131`, `main.tsx:10`]. A non-MUI modal routes around **both halves** and reintroduces the defect class in the newest, most-used surface in the app — with no spec covering it. Adopting `cmdk` means either porting that fix a second time or shipping a known regression. | Inherits the fix for free, and inherits the existing `axe` a11y gate (`dashboard-e2e/src/quality/accessibility.spec.ts`). |
| **Bundle cost** | `cmdk` pulls its own primitive/dialog tree. I have **not measured it in this tree** [assumption]. The seam that decides it is real: `tools/check-dashboard-bundle.mjs` caps `entry-index` at **22 KB brotli** and `vendor-misc` at **35 KB** [verified], and a shell-level palette lands in the entry graph unless it is lazily imported. | Zero new bytes; `@mui/material` is already a 110 KB-capped vendor chunk that every route loads. |
| **Keyboard handling** | Genuinely better out of the box (list filtering, arrow navigation, grouping). | Has to be written: a document-level `keydown` for the open shortcut, roving focus in the list, Enter/Shift-Enter. Non-trivial but bounded, and the app already has a document-level `keydown` precedent in `AuthDialog.tsx:97` [verified]. |
| **Maintenance / familiarity** | A new dependency on the supply-chain gates (`supply-chain:policy` / `:verify` exist as scripts [verified `package.json`]) and a second modal system to keep in sync with the theme. | One system. The design source itself names the target as `CommandPalette (new)` with no library [verified `design/src/screens/library-page.mjs:150`]. |

The keyboard-ergonomics advantage of `cmdk` is real and I am not dismissing it — it is simply
outweighed by the fact that this repo has already paid, in measurement and in spec, for exactly one
modal focus model.

**Data flow, and a boundary problem worth naming.** Canon rule 19 says the palette "shows tier and
score inline". Tier and score live on the scanner's rows, and `useScan` is documented and built as
"the `/scanner` page's ONE data owner and its ONLY fetcher" on a 30 s poll [verified
`pages/scanner/useScan.ts:1-4, 60`]. The palette lives in the **shell**, above every page. So one of
three things must be true, and the council should pick deliberately:

- (a) the palette does a **one-shot read on open** (not a poll) and caches for the dialog's lifetime —
  my recommendation: it keeps `useScan` untouched, adds no ambient traffic, and is honest because a
  palette result is a snapshot by nature;
- (b) the scan read is promoted from `pages/scanner/` to `features/` as a shared domain owner — the
  correct long-term shape under the "2nd consumer" rule, but it re-opens a shipped isolation
  boundary in a phase whose non-goal is "no screen is re-laid-out";
- (c) the palette shows no tier/score — which contradicts canon rule 19.

Under (a) or (b) the palette must **render the wire's tier/label via a closed lookup and never
re-derive it from the score** (`[digested-labels-not-raw-dump]`), and must render score as a static
figure with no live claim.

The palette's command table is a **static, closed list of trader routes** plus symbol results.
Operator routes are absent by construction, and the membership test in §8 is what keeps them absent.

---

### 6. Panels as container-query contexts

**Support is not the risk; a stale belief in the codebase is.** Two shipped comments assert the
opposite of the truth:

- `MarketContext.tsx:436-438`: *"NEVER a `@container` object key in sx (this Emotion version silently
  drops it; the dealer-flow post-QA catch pinned the `auto-fit`/`minmax` idiom)"*
- `DealerFlowProjection.tsx:173-174`: *"no container-query object key (this Emotion version doesn't
  pass `@container` through and warns on the kebab-case condition)"*

Both are **false for the dependency state in this tree**, verified three levels down:

1. `@emotion/serialize` emits an object key with an object value **verbatim** as `key{...}` —
   `string += key + "{" + interpolated + "}"` [verified
   `@emotion/serialize/dist/emotion-serialize.development.esm.js:227`]. The kebab-case `console.error`
   fires only in the *scalar-value* branch, for CSS **property** names, not for at-rule keys [verified
   same file, lines 66-71 vs 191-198]. So `'@container (max-width: 360px)': { ... }` neither warns nor
   drops.
2. `stylis@4.2.0` explicitly special-cases `@c…n` — `atrule === 99 && charat(characters, 3) === 110 ?
   100 : atrule` — routing `@container` into the same nested-at-rule branch as `@media` / `@supports`
   / `@layer` [verified `stylis/src/Parser.js:96-100`; version confirmed at
   `stylis/package.json:3`].
3. MUI v9 has **first-class** container-query support: `styleFunctionSx` calls `sortContainerQueries`
   on every result, and `cssContainerQueries` attaches `theme.containerQueries(name).up/down/between/only/not`
   plus an `@<number>` shorthand [verified `@mui/system/styleFunctionSx/styleFunctionSx.mjs:4,70` and
   `@mui/system/cssContainerQueries/cssContainerQueries.mjs`].

So the mechanism for the canon's container steps (figure 20 -> 17 under 360px -> 15 under 280px) is
`theme.containerQueries.down(360)` / `.down(280)` inside `FigureCell`'s `sx`, resolved against the
nearest named container. **The two stale comments must be corrected in this change**, or the next
implementer will re-derive the wrong constraint from them.

**How a container context is declared without every panel hand-rolling it.** It already is, for
widget bodies: `Widget.tsx` sets `{ containerType: 'inline-size' }` on the body Box [verified
`Widget.tsx:157`], and the file's own header documents it as "the seam for future resize". So canon
rule 21 is half-shipped. What is missing:

- the context is on the **body**, not the frame, so a figure in a widget *header* has no container;
- non-`Widget` panels (deck, masthead, strips, the future rails) have none at all;
- the containers are **unnamed**, so a nested container silently shadows an outer one and
  `theme.containerQueries('panel')` cannot target across a nesting level.

Mechanism: give `Widget`'s body a **named** container (`containerName: 'panel'` alongside
`containerType: 'inline-size'`) and export one small primitive — a `PanelContainer` wrapper (or a
single exported `sx` fragment) — that any non-`Widget` panel spreads. `FigureCell` then queries the
**named** container, so a rail nested inside a panel does not accidentally answer the query. The
structural rule: `FigureCell` must never query an unnamed container.

**jsdom caveat, stated as a limit not a workaround:** jsdom does not do container-query layout, so the
20/17/15 steps cannot be *rendered* in Vitest. They can be asserted at the **emitted-CSS** level (the
`type-floor.spec.tsx` idiom already reads the injected emotion rule text [verified lines 32-39]) and
at the **real-browser** level in the Playwright suite. Note that `type-floor`'s current helper does
`css.split('.'+cls+'{')[1].split('}')[0]`, which reads the *first* rule bearing the class — that
happens to still be the base rule when a nested at-rule follows [assumption: stylis emits the base
declarations before the hoisted at-rule; not verified by running it], so the helper may need
hardening rather than trusting.

---

### 7. Explicit non-goals for this phase

Stated so R4 can bind them, and so GATE Q can fail work that drifts:

1. **No screen is re-laid-out.** Ticker desk, scanner, positions, settings, alerts and landing keep
   their current composition. They consume new primitives; they do not get the v2 arrangement. The
   masthead / structure-field hero / read strip / wide AI brief / quiet context band are **phase 2-4**.
2. **No `apps/api` change of any kind** — empty diff, enforced (§0).
3. **No new keyframe and no new motion family.** The data-signal *class* replaces the enumerated
   exemption in `single-motion-moment.spec.ts`, but this phase adds **zero** new animations; drift,
   trail, beam and sheet motion arrive with the surfaces that need them, in later phases. Widening
   the exemption without spending it is deliberate.
4. **No `success`/`error` binding is added or moved.** Ruling #18's scope is untouched.
5. **No breakpoint *value* changes** for `xs`/`sm`/`md`/`lg`/`xl` (§2).
6. **No new durable client store and no change to any existing durable key or shape.** If the palette
   wants recent tickers, that is a new `convexa.*` key and therefore a `[loss-free-durable-migration]`
   surface — my position is **defer it**: ship the palette without recents in phase 1.
7. **No second token authority.** `design/tokens/tokens.json` stays a mirror; nothing in
   `apps/dashboard` imports from `design/`.
8. **No AI-brief work.** Canon rule 16's nine states are phase 2.
9. **No burn-down of the pre-existing spacing/radius debt** beyond making it visible and fenced (§2).

---

### 8. Structural enforcement — which spec, and what it actually catches

| Rule landed | Spec (added / amended) | The poison that must go red |
| ----------- | ---------------------- | --------------------------- |
| Seven tokens exist with dark/light parity | **amend** a theme spec (`stage1-tokens.spec.ts` or a new `v2-tokens.spec.ts`) | Delete one key from `extrasLight` -> typecheck red; delete it from the runtime key-set twin -> test red; add `divider` to `palette.dark` only -> palette key-set assertion red |
| No hardcoded token literal in components | **new** `banned-literals.spec.ts`, ban list derived from `tokens.ts` | Paste `rgba(138,155,180,0.16)` into any component -> red. Vacuity guard: the ban list must be non-empty and the glob non-empty |
| Zero hardcoded hex (unchanged) | `hex-discipline.spec.ts`, `banned-hexes.spec.ts` | Unchanged; both stay green by construction once values live in `tokens.ts` |
| Figure-cell anatomy | **rewrite** `StatTile.spec.tsx` -> `FigureCell.spec.tsx` | Re-add an accent-bar prop -> type error; render a not-a-number literal as a figure -> red; default `register` -> type error; offline caption without offline -> red |
| No accent bar survives anywhere | **new** source scan (arc.spec importer idiom) | Re-introduce a `StatTile` import or an `accentColor` prop -> red; the scan asserts `StatTile.tsx` no longer exists |
| Amber census stays live | **amend** `stage3-amber.spec.ts` `HOVER_CENSUS_FILES` | Leave the list pointing at the deleted `StatTile.tsx` -> red (the list is self-checking) |
| Type floor + container steps | **amend** `type-floor.spec.tsx` | Any sub-11px `fontSize` -> red (already); a container step below 15px -> red; the 20/17/15 ladder asserted on emitted CSS |
| Connection chip is exactly six kinds | **new** `connectionChip.spec.ts` | Add a seventh `kind` -> compile error via the `never` arm; make `replay` reachable with a pulse -> red; enumerate every fixture and assert the produced `kind` set is exactly six |
| One liveness claim per page | **new** importer set-equality on the chip module + **amend** e2e | Add a second visible liveness claim (e.g. keep `TapePulseStrip`'s stream-state text) -> red |
| Palette exposes trader surfaces only | **new** membership test over the palette's static command table + `/_ops` source scan | Add an `/_ops` route to the command table or a literal to the shell -> red |
| One orchestrated motion moment (class form) | **amend** `single-motion-moment.spec.ts` | Declare `liveDotPulse` in a second file -> red (set-equality is already bidirectional); add a keyframe outside the class -> red. **The class predicate must itself be tested**: a data-signal keyframe that runs without a live stream, or that ignores `prefers-reduced-motion`, must fail |
| Arc budget unchanged | `arc.spec.ts` (verify, do not amend) | A `FigureCell`/palette/chip importing `arc.ts` -> red. Expected result this phase: **no fourth importer** |
| Radius scale | **new** `radius-scale.spec.ts` with a live-checked exemption list | A new `borderRadius` outside {8, 12, 16, 999} in a non-exempt file -> red; a stale exemption -> red |
| Spacing ladder | **new** scan, same exemption idiom, seeded with today's 35 files | An off-ladder `sx` spacing multiplier in a non-exempt file -> red |
| Fonts self-hosted | `fonts.spec.ts` (unchanged) | A CDN font link in `apps/dashboard` -> red. `design/` is out of scope and stays so |
| Warnings carry an icon | `warning-icon.spec.ts` (unchanged) | `severity="warning" icon={false}` -> red |
| Brand assets match tokens | `brand-assets.spec.ts` (verify) | A mark colour drifting from `tokens.ts` -> red |
| No horizontal overflow | **amend** `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` | Add **834** to the existing 393 / 900 / 1280; 900 stays. Every added width needs a **vacuity guard** (a marker asserted attached before measuring) — the suite's own established idiom |
| `apps/api` untouched | **new** build-step diff check | Any file under `apps/api` in the change set -> red |

---

## Risks I see

1. **Canon rule 18 vs the shipped session-tape standings (HIGH).** Read literally, "exactly six states
   and no invented seventh" deletes seven distinct replay standings that carry real honesty content
   and are asserted in `day-replay-mock-adapter.spec.tsx`. My §4 resolution (six `kind`s, `replay`
   carries a closed `standing`) is a *reading* of the rule, not the rule. If the owner intends six
   **labels**, this phase loses information the app currently tells the truth with, and
   `[present-is-live-paid-only]` gets weaker. **This needs an explicit ruling.**

2. **Canon's radius declaration contradicts its own design source (MEDIUM).** The Tokens table says
   "Local overrides are for the declared roles only, not free-form", but the generated source under
   `design/src/` uses radii of **3, 4, 7, 8, 10, 12, 14, 999** in roughly thirty places (e.g.
   `lib.mjs:35` = 10px, `surfaces.mjs:47` toast = 10px, `lib.mjs:66` kbd = 4px, `dialogs.mjs` = 14px)
   [verified by scan]. Either the four declared roles govern and the design source is a non-binding
   sketch (canon says the catalog is "not a second rulebook", which supports this), or the declared
   set is incomplete. I am building to the four declared roles; if that is wrong, the radius spec is
   wrong from day one.

3. **The radius migration is not a two-pixel change (MEDIUM).** `borderRadius: 2` in `sx` means
   `2 * shape.borderRadius`, so ~two dozen sites move by 4-6px, and some of the matched numbers are
   plain-CSS px rather than `sx` multipliers. Anyone who scripts this will get it wrong. It needs a
   per-site read and a screenshot pass, and it will visibly change surfaces this phase claims not to
   touch (auth dialog, settings, decision card).

4. **Two shipped comments actively teach the wrong thing about container queries (MEDIUM).** See §6.
   Until they are corrected, a later implementer will read `MarketContext.tsx:436` and conclude
   container queries are unavailable — and will be wrong. Correcting them is cheap and in scope.

5. **`rgba()` token literals are invisible to `hex-discipline` (MEDIUM).** Five of the seven additions
   are `rgba(...)`. Without the §1 banned-literals scan, this feature ships a new, permanently
   unguarded way to violate `[theme-token-discipline]`.

6. **The z-index ladder is under-specified for MUI (MEDIUM).** Six declared rungs, eight MUI slots.
   `tooltip` has no home in the canon and defaults to 1500 — above every v2 rung. Left unmapped,
   tooltips render above dialogs, which is arguably correct and definitely undeclared.
   `mobileStepper`/`fab`/`speedDial` likewise. This is an Amendments-shaped gap, not a build decision.

7. **The palette's tier/score source crosses a shipped isolation boundary (MEDIUM).** §5 (a)/(b)/(c).
   Option (b) is architecturally right and phase-inappropriate; option (a) is my recommendation and is
   slightly less "live" than the design implies; option (c) violates canon rule 19. Someone has to
   choose.

8. **Two liveness claims exist on the ticker page today (MEDIUM).** `TapePulseStrip`'s stream-state
   text and the header chip. Fixing it is in scope for rule 18 but it changes a surface this phase
   says it will not re-lay-out, and it touches `TapePulseStrip.spec.tsx` and the compatibility gate
   (`compatibility.spec.ts:48` asserts `tape-stream-state` contains "Stream offline" [verified]).

9. **Enforcement debt could swallow the phase (MEDIUM).** 86 off-ladder spacing sites and ~97
   `borderRadius` occurrences. If the council reads "the scales are declared" as "the app is on the
   scales", this phase becomes a several-hundred-site refactor with no new capability. My exemption-list
   proposal is the containment; if it is rejected, the effort estimate (M) is wrong.

10. **Adding breakpoint keys has an unmeasured render cost (LOW).** Ten keys instead of five doubles
    the per-`sx` empty-breakpoint object allocation before `removeUnusedBreakpoints` strips it. I
    believe it is negligible; I did not measure it.

11. **`nx test` cannot see the parity guarantee (LOW, but this repo's signature failure).** The
    `extrasLight` type is a *typecheck* guard. Anyone claiming green from `nx test` alone will miss a
    parity break. The runtime key-set twin in §1 is the mitigation, and `npm run typecheck` before any
    green claim is mandatory.

---

## Assumptions I'm making about the other two lanes

**About PM (product / acceptance):**

1. **PM will price the `StatTile` -> `FigureCell` sweep as sixteen render sites in two files, not as an
   app-wide refactor** — and will accept that `DealerPositioning`'s twelve tiles and `LiveTape`'s four
   are re-authored in this phase while their *arrangement* is untouched. If PM writes an AC that says
   "no ticker widget changes", this phase cannot ship.
2. **PM will accept `replay` as one state with a closed seven-member `standing`**, rather than writing
   an AC that enumerates exactly six chip *labels*. If PM's AC counts labels, §4 is dead and the
   session-tape honesty distinctions are deleted.
3. **PM will not require the palette to show live prices.** I am assuming a snapshot read on open,
   with tier/score rendered from the wire's own label. If an AC says the palette's numbers must be
   live, the palette needs an SSE subscription in the shell and the isolation story changes completely.
4. **PM will accept "no recent-tickers memory" in phase 1.** A durable store triggers
   `[loss-free-durable-migration]` and is disproportionate here.
5. **PM will write at least one AC whose only possible evidence is a poison test** — for the six-state
   chip and for the accent-bar deletion. `[structural-over-prose-enforcement]` needs an AC that cannot
   be satisfied by a screenshot.
6. **PM will treat the radius migration's visible change to auth/settings/decision-card surfaces as
   in-scope collateral**, not as a defect, and will say so in an AC. Otherwise GATE Q fails the phase
   for doing exactly what the canon's "Costs ruled in knowingly" row authorises.
7. **PM will not add a scoring or ranking claim to the palette.** It orders by an existing wire field;
   it computes nothing.

**About UX (interface / copy / layout):**

8. **UX will not require a colour to carry any `FigureCell` state.** The register (mono vs Plex Sans +
   dotted rule) and the label row carry everything. If UX specifies a tint for "untraced" or a green/red
   figure outside signed direction, it collides with the Banned table and with ruling #18.
9. **UX owns the offline caption string and the six chip labels; I own neither.** But I am assuming UX
   accepts that changing the current `⏸ offline` string forces edits in ~5 spec files in the same
   commit, and will state the final string once rather than iterating.
10. **UX will specify the label row as: caps label, info affordance, live dot — and nothing else.**
    `DealerPositioning` passes `accentColor` today for non-directional tier emphasis; I am assuming UX
    relocates that emphasis into the label row or drops it. If UX wants tier emphasis to remain a
    coloured surface treatment, `FigureCell` needs a prop I have deliberately refused to give it.
11. **UX will not specify a hover-only affordance anywhere in the palette, the nav, or `FigureCell`**
    (canon rule 20). `Widget`'s expand button is hover/focus-revealed today via `:has(:focus-visible)`
    [verified `Widget.tsx:365`]; I am assuming UX treats that as already-compliant and does not ask me
    to change it in this phase.
12. **UX will accept MUI Dialog semantics for the palette** — a modal with a focus trap, Escape to
    close, focus returned to the opener — rather than a non-modal popover anchored to the nav. A
    non-modal popover is a different a11y contract and would not inherit the modal focus handoff.
13. **UX will not ask for the palette on the landing route.** `/` sits outside `AppShell` [verified
    `app.tsx` route shape via PROJECT_CONTEXT §2b], and canon rule 19 says "opens anywhere in the
    shell". If UX wants Cmd-K on the landing, the shortcut listener has to move above the shell and
    the "trader surfaces only" membership test gets a new edge.
14. **UX will specify the four nav links and the footer demotion of Lab and Blog as a link-set change
    only** — same `TopNav` component, same drawer, same `nav-*` testids for the four survivors. The
    e2e suite asserts the drawer carries `ticker, positions, scanner, blog` [verified
    `no-overflow.spec.ts:887`]; moving Blog to the footer breaks that assertion, and I am assuming UX
    expects that spec to be amended rather than expecting Blog to stay in the drawer.
15. **UX will not introduce a seventh not-a-number literal.** Canon rule 24 is a closed six; a seventh
    is an Amendments event, not a phase-1 decision.
