# redesign-stage-0 — FRONTEND_EXECUTION_CONTRACT

> **Lane:** GATE V fast-path (UX → Frontend). **Backend lane: `NO_BACKEND_CHANGE`** — this feature
> consumes the existing endpoints unchanged; there is no INTERFACE_CONTRACT and no
> BACKEND_EXECUTION_CONTRACT for it. The **empty `apps/api` diff is itself an acceptance criterion**
> (see §7 / §9).
>
> **Rule-of-record:** `.claude/skills/convexa-design/SKILL.md` (the 10 "Binding now" rules + red
> flags) + `.claude/DESIGN_RULES.md`. **Stage 0 is correctness, not taste** — the Curvature Terminal
> palette/type (proposal §3) is Stage 1+; every fix in this contract binds to the **CURRENT**
> `tokens.ts`/theme values. Introducing any new identity value (a new hue, a new face, a new
> signature element) here is out of contract.
>
> Sources: `BRIEF.md` (the 6 scope items — scope law) · `docs/design/DESIGN_REVIEW_2026-07-22.md`
> (evidence) · `docs/design/verification-2026-07-22/VERIFICATION.md` (eyes-on measurements) ·
> `docs/design/BRAND_TOKENS_PROPOSAL_2026-07-22.md` §5 Stage 0 + §6a (owner rulings) ·
> `apps/dashboard/src/app/README.md` (authoritative structure map).

---

## 1. Design front-half (DESIGN_RULES §1.1–§1.4, folded in — "Design tokens + signature")

**Brief pinned.**
- **Subject:** the already-shipped Convexa dashboard's quality floor — mobile layout, keyboard
  access, semantics, type floors, honest copy.
- **Audience:** the same solo retail options traders — now including the one **on a phone** and the
  one **on a keyboard**; both currently locked out (scrollWidth 580 vs 393; UA-default-only focus).
- **Single job of this pass:** make every existing surface *usable and honest* at 393px, from the
  keyboard, and to a screen reader — **without changing what anything looks like at 1440px in the
  current identity.**

**Structure before style.** No new layout concepts. The structural moves are: (a) nav collapses to
hamburger+drawer below the width the text nav fits (the parked branch's structure); (b) the ticker
CommandDeck stacks vertically below `sm` instead of forcing a 580px row; (c) positions table↔card
already exists — mobile defaults to cards (branch behavior); (d) stat values leave the heading
outline and become styled body spans; (e) an app-level `<main>` landmark wraps routed page content.

**Token plan: ZERO new tokens.** This is the plan, stated deliberately: Stage 0 adds **no color, no
face, no scale value**. Every fix binds to existing theme slots (`primary.main`, `divider`,
`background.*`, `text.*`, `typographyTokens.monoFontFamily`, `extrasFor(theme)` where mode-aware).
The only *numeric* additions are floors already ruled by canon: **chip/label font-size ≥ 11px**,
**touch-target hit area ≥ 44px**, and an authored **`:focus-visible` ring** drawn from
`primary.main` (token-bound, both modes).

**Signature:** none added. The signature work (arc, amber, Archivo/Plex) is Stage 1–2 and is
explicitly deferred; the one shipped motion moment (staggered widget reveal) is **kept unchanged**.

**Self-critique (recorded):** the default failure mode for "fix the floor" is to sneak taste in —
a nicer focus ring color, a "better" hero look, restyled chips. Every such urge is rejected here:
the focus ring is the plainest token-bound outline; the hero change is copy-only; TintChip changes
only its font-size. Second default: fixing mobile by hiding things — rejected; nothing is removed
at 393px, only re-stacked (the degraded-state chrome especially must survive intact, §5).

---

## 2. Execution order (binding)

1. **Rebase `feat/responsive-layout` onto `main` FIRST** (commits `d2bac85` hamburger/drawer TopNav
   below `md`; `a7b92eb` positions cards on mobile + full-screen dialogs for `PositionsView`,
   `TradeEntryDialog`, `AuthDialog`). It is **31 commits behind**; known drift includes the
   risk-based **test-migration baseline** (Landing spec 15→4) — when a branch test conflicts with a
   migrated spec, **main's risk-based spec set wins** and the branch's test intent is re-expressed
   under the risk rule (qa-verify §4). The rebased branch behaviors become the **existing mobile
   baseline** this contract builds on.
2. Then land the Stage 0 items the branch does **NOT** cover (it never touches
   `pages/ticker/widgets/chrome/` or `_kit/`): the ticker deck/trade-button/widget-header overflow,
   focus-visible, semantics, floors, copy, theme-color.

---

## 3. The six scope items — per-item expectations + touchpoints

### Item 1 — Mobile: kill the 393px horizontal overflow + real mobile nav

**Acceptance:** at a 393×852 viewport, `document.documentElement.scrollWidth ≤ window.innerWidth`
on `/`, `/ticker/TSLA`, `/positions`, `/scanner`, `/settings` — dark AND light. No content is
removed to achieve it; everything re-stacks.

| Sub-item | Expectation | Touchpoint (file-level) |
|---|---|---|
| Mobile nav | Below `md`: wordmark + hamburger + `AccountControl` fit within the viewport; the drawer carries ALL four nav entries (Ticker / Positions / Scanner / Blog — "Blog" currently clips off-screen) with the same active-route highlight rules and `aria-current`; drawer closes on navigation; still **zero** `/_ops/metrics` link (`[operator-vs-trader-path-separation]`). | `shell/TopNav.tsx` (from the rebased branch; verify + extend, don't rebuild) |
| Header toolbar stack (measured offender, right=580) | The `TickerHeader` hero row (chips + `TICKER · $price` anchor + meta line + CTA) stacks vertically below `sm`; the anchor/levels sub-line may wrap; nothing carries a viewport-breaking `whiteSpace: nowrap` at xs. | `pages/ticker/widgets/chrome/TickerHeader.tsx` (outer `Stack direction="row"`), `CommandDeck.tsx` |
| "Open simulated trade" button row (measured offender) | The CTA (`data-testid="open-sim-trade"`, `flexShrink:0` + `nowrap`) moves under the anchor at xs (full-width or left-aligned row of its own); it stays THE entry point to the ONE shared `TradeEntryDialog` (`[single-shared-sim-entry-dialog]`). | `TickerHeader.tsx` |
| Control strip | `TickerToolbar` already wraps at xs (`flexWrap`); verify its fixed widths (`width:120`, `minWidth:190`) fit within 393 minus gutters after wrap; adjust to `maxWidth:'100%'`/`flex` mins if not. | `pages/ticker/widgets/chrome/TickerToolbar.tsx` |
| Widget headers (measured offender) | The `Widget` header row (grip + title + info + actions + hover toolbar) must shrink/wrap inside the widget frame at any bento width — `actions` may wrap to a second row below `sm`; the title keeps its ellipsis. Live-tape/dealer tile grids collapse to 2→1 columns rather than clipping mid-tile. | `shared/ui/Widget/Widget.tsx` (header), `pages/ticker/widgets/live-tape/`, `dealer-positioning/` (tile grid columns) |
| Sticky condensed bar | `deck-sticky` must itself fit at 393 (it already hides `expLabel` under `sm` — keep). | `CommandDeck.tsx` |
| Positions on mobile | Card layout as the mobile default + full-screen dialogs = the rebased branch baseline. The auto/mobile presentation choice must NOT rewrite the durable uiprefs/saved-view shape (`[loss-free-durable-migration]` — expected untouched; see §7). | `features/trading/positions/PositionsView.tsx`, `features/trading/TradeEntryDialog.tsx`, `features/auth/AuthDialog.tsx` (branch commits) |
| GEX chart | Scales to container width at 393 but remains the **vertical diverging** orientation — LOCKED (§6). | `pages/ticker/widgets/gex-profile-chart/` (no orientation change) |

### Item 2 — Authored `:focus-visible` rings app-wide

Today exactly one file styles focus (`shared/ui/Widget/Widget.tsx`; its `outline:'none'` is paired
with the `:has(:focus-visible)` chrome reveal and stays accounted). Everything else rides UA
defaults (buttons: nothing visible at all).

- **One authored, token-bound ring, defined ONCE at the theme layer** — a global `:focus-visible`
  rule (e.g. via `MuiCssBaseline` overrides in `shared/theme/theme.ts`): 2px `primary.main` outline
  + offset, visible in BOTH modes, plus a matching `.Mui-focusVisible` treatment for MUI
  `ButtonBase` descendants (buttons, icon buttons, menu items, toggle pills). No per-component
  bespoke rings; components inherit the one rule.
- The `Widget` frame itself (`tabIndex={0}`, currently `outline:'none'`) gains its own visible
  `&:focus-visible` treatment (ring or equivalent border emphasis) — keyboard focus on the frame
  must be visible, mouse-click focus may stay ringless (that is precisely what `:focus-visible`
  distinguishes).
- No NEW `outline:'none'` anywhere without an in-component replacement (skill rule 8).
- Touchpoints: `shared/theme/theme.ts` (the rule of record), `shared/ui/Widget/Widget.tsx`
  (frame ring). Everything else should need **no edits** — that is the design test of doing it at
  the theme layer.

### Item 3 — Semantic repair on `/ticker`

- **29 `<h6>` stat values → styled spans/paragraphs.** `StatTile.tsx` line ~136: keep
  `variant="h6"` styling, add `component="p"` (or `span`) so NO data value renders as a heading.
  Sweep every other ticker-page `Typography` with a heading variant whose content is a data value
  (e.g. tier/opportunity figures, AI-rec figures) — the guard test in §8 defines "value".
  Visual output byte-identical (same variant classes).
- **`<main>` landmark:** `shell/AppShell.tsx` wraps `<Outlet/>` in `component="main"` — covers
  `/ticker` (and every in-shell route) with one change. (Landing is outside the shell — deferred to
  its Stage 2 rework; recorded in §10.)
- **Heading order:** `/ticker` outline becomes `h1` (the `TICKER · $price` anchor) → `h2` widget
  titles. `Widget.tsx` title (`variant="h6"`) gains `component="h2"` (styling unchanged). This also
  fixes the Positions page's Orders widget outline (h1 → h2 — already consistent with its existing
  "Track record" h2). No skipped levels h1→h2 on `/ticker`.

### Item 4 — Floors: touch targets ≥44px · chip/label type ≥11px

- **Type floor (kills the measured 9px "vs spot" deltas):**
  - `pages/ticker/widgets/_kit/TintChip.tsx`: `fontSize: 9` → `11` (the only 9px site; it renders
    the off-exchange proximity "+x.x% vs spot" chips and setup conviction tags).
  - `pages/ticker/widgets/chrome/TickerToolbar.tsx` Segment micro-label: `10.5` → `11`.
  - `pages/ticker/widgets/ai-rec/AiRecPanel.tsx` (`fontSize: 10` ×3) and
    `StateExportDrawer.tsx` (`fontSize: 10` ×2): → `11`.
  - **Exempt (deliberate, recorded §10):** SVG chart axis/tick text at 10px
    (`gex-profile-chart/chart.tsx`, `term-structure/TermStructure.tsx`,
    `operator-metrics/LatencyTrend.tsx`) — chart annotation, not UI chips/labels; retinting the
    LOCKED chart's geometry is not Stage 0.
- **Touch targets ≥44px:** every interactive control on the trader surfaces (nav links, hamburger,
  CTA links like "Analyze a ticker →" measured at 21–31px, account pills, row action buttons,
  widget toolbar icon buttons) gets an **effective hit area ≥44×44px** — via `minHeight`/padding or
  a pseudo-element hit-area expansion where the visual must stay dense (visual size may stay; the
  target may not). Touchpoints: `shell/TopNav.tsx`, `shared/ui/ValueCard`/`ComingSoonCard` CTAs,
  `features/auth/AccountControl.tsx`, `features/trading/positions/*` row actions,
  `shared/ui/Widget/Widget.tsx` toolbar buttons.
- **Keyboard operability on clickable rows (verification finding):** audit the flagged sites in
  `features/trading/positions/PositionCard.tsx`, `PositionRow.tsx`, `PositionsView.tsx`. Source
  reading shows the click affordances are already `Box component="button"` (real buttons) — the FE
  must verify each flagged site **in the rendered DOM**: every click target is a native
  button/link or carries `role` + `tabIndex` + key handlers. If all prove native, the fix reduces
  to the shared focus ring + hit-area floor; any non-native click target found gets converted.
- **`autoFocus` ×2** (`CustomizationToolbar.tsx:399,431` — the rename / save-view dialog fields):
  **KEEP, justified** — moving focus into a just-opened modal's single field is the expected a11y
  behavior, which is the WIG "sparingly" carve-out. Add a one-line justification comment at each
  site so the next audit doesn't re-flag them.

### Item 5 — Copy fixes (exact strings — §4)

Touchpoints: `features/auth/copy.ts` + `features/auth/SettingsPage.tsx` (false save claim),
`pages/operator-metrics/operator-metrics.tsx:300` ("last last"), `pages/landing/Landing.tsx`
(hero). Strings in §4 are verbatim-binding.

### Item 6 — `<meta name="theme-color">` follows the active mode

- `index.html:15` keeps a static dark `content` for pre-React first paint (it may keep its current
  literal — it sits outside the `src/` hex-discipline scan and outside the theme; do NOT add a new
  hex anywhere in `src/`).
- `features/auth/ThemeProvider.tsx` gains an effect that, on every resolved mode change (incl. the
  `system` pref resolving), writes `theme.palette.background.default` (read from the live theme
  object — token-bound by construction, no literal) into `meta[name="theme-color"]`.

---

## 4. Exact user-facing copy (verbatim-binding; copy lives in its owning `copy.ts`/component)

1. **Settings subtitle — the false "Saved to your account." for anonymous users.**
   `AUTH_COPY.settings.subtitle` splits into two mode-aware strings; `SettingsPage.tsx` picks by
   `auth.authenticated`:
   - Signed in (unchanged): `Saved to your account.`
   - Anonymous (new): `Stored in this browser.`
   (The Account panel below already carries the sign-in CTA — `Sign in to sync your settings
   across devices.` stays; the subtitle must not duplicate the CTA.)
2. **The "last last" typo (operator page).** `operator-metrics.tsx:300` currently renders
   `Rolling window: last {size_desc}` where the payload `size_desc` is already `last ~500 req` —
   drop the hardcoded `last ` prefix so it renders:
   - `Rolling window: last ~500 req · uptime …`
   (This also un-garbles the degraded payloads `size_desc: "instrumentation disabled"` /
   `"unavailable"` → `Rolling window: instrumentation disabled`.) The wire field is consumed
   unchanged — copy fix only.
3. **Hero reframed honestly (Landing.tsx)** — it must sell only today-working value; no
   connect-your-positions / real-risk claim (`[no-real-order-path]`; skill rule 4). The hatched
   "Connect a real brokerage — Coming soon" card below stays the ONLY place the future capability
   appears, unchanged.
   - H1 (replaces `See the AI read on your real positioning.`):
     `See the dealer positioning behind the price.`
   - Body (replaces `Connect your positions and get an AI read on your real risk — grounded in
     live dealer gamma, not vibes.`); keep the `<Jargon term="dealer gamma">` gloss inline:
     `Gamma walls, the flip, and live order flow for any ticker — plus an AI read on the setup and
     a simulated portfolio to practice it. Grounded in live ` [dealer gamma] `, not vibes.`
   - CTAs, chip, value cards, coming-soon band: **unchanged**.

No other copy changes. (The "🔒 Live" emoji tab, the Positions disclosure stack, operator/Settings
heading gaps are review findings NOT in the BRIEF's six items — out of scope, §6.)

---

## 5. Component states — the honesty tri-state survives relayout (binding)

The three degraded states are distinct, styled, and **must render identically in semantics and
distinctness after every relayout in this feature** (393px stacking, drawer nav, card layouts,
full-screen dialogs):

| State | Definition (shipped) | Stage 0 requirement |
|---|---|---|
| **Cold-load skeleton** | Per-source shimmer placeholders (`data-testid="cold-skeleton"`, `last-trade-skeleton`); must NEVER appear post-load. | Same testids, same shimmer, at every viewport; skeleton tiles participate in the responsive grid exactly like real tiles (no skeleton-only overflow). |
| **Offline-degrade** (live-derived only) | SSE drop → value dimmed to 50% + `⏸ offline` caption (StatTile `offline`), `⚠ Live offline — reconnecting…` chip supersedes the session chip; last-trade `⏸` dimmed; never blanked. | Dimming + `⏸` captions + the single superseding connection chip survive the stacked hero and the sticky condensed bar at 393; static tiles/sections still never dim (`[live-vs-static-isolation]`). |
| **Unavailable this cycle** (static, per-datum) | Resolved-null muted text from the `_kit/copy.ts` "unavailable this cycle" family, per cell/row/widget. | Same strings, same muted styling, in 1-column widget layouts and in the expand overlay. |

Live-vs-static dimming semantics are **not renegotiated by layout**: a widget that was
static-family (dealer positioning, term structure, market context, iv-rank, dealer-flow) stays
un-dimmed on a drop at every width; live-derived (live tape, header price/flow, last-trade, sticky
bar price/chip) degrade together at every width.

Positions mobile cards: `PositionCard` pending/closed/offline (`⏸ last known`) affordances carry
the same testids and states as the table rows — the card layout is a re-projection, not a fork.

---

## 6. NON-GOALS (explicit — touching these is out of contract)

- **No palette / type / identity change.** No new hex, face, gradient, or signature element; the
  Curvature Terminal values (amber/phosphor/Archivo/Plex) do NOT land here (Stage 1+).
- **No chart-orientation change — the vertical diverging GEX chart is LOCKED** (owner call,
  proposal §6a-1). Responsive scaling only.
- **No motion additions** (and no motion removals) — the staggered reveal remains *the* moment;
  drawer/dialog transitions use stock MUI, reduced-motion-clean.
- **No "simplification" of the mid + last-trade two-price display** (locked owner call).
- **No backend / API / wire change** — `apps/api` diff is empty; `libs/api` untouched.
- **Sim dialog restyled, not forked** — the branch's full-screen-at-xs treatment is a responsive
  restyle of THE ONE `features/trading/TradeEntryDialog`; no second dialog, no new entry surface.
- Not in the six items and therefore untouched: the Positions disclosure stack, the "🔒 Live"
  emoji tab, Settings input labels/section headings, operator-page heading hierarchy, blog static
  template (Stage 1), landing H1→H6 card hierarchy (Stage 2), SVG chart tick sizes (§10).

---

## 7. Binding invariants (restated for this feature)

- **`[theme-token-discipline]`** — every fix lands token-only; mode-aware values via
  `extrasFor(theme)` inside sx callbacks; zero new hardcoded hex in `src/`;
  `hex-discipline.spec.ts` stays green. The theme-color meta is written from the theme object,
  never a literal.
- **`[additive-keeps-score-byte-identical]`** — FE-only: the **`apps/api` diff is empty**
  (`git diff main -- apps/api` → no output at GATE Q); score/tier/`state_fingerprint` cannot move
  by construction.
- **`[live-vs-static-isolation]`** — §5 verbatim: the three degraded states survive relayout;
  live-derived dims, static never does; the offline chip supersedes the session chip everywhere
  including the sticky bar.
- **`[no-real-order-path]`** — the hero stops selling the unbuilt brokerage connect (§4.3); the
  coming-soon card stays inert; `SIMULATED` framing everywhere unchanged.
- **`[single-shared-sim-entry-dialog]`** — responsive work restyles THE dialog (props/breakpoints),
  never forks it.
- **`[loss-free-durable-migration]`** — expected **NOT** exercised: no durable key or shape moves.
  If the rebase surfaces a branch change to `convexa.uiprefs.v1` / saved-view shapes, STOP and
  apply the `resolveDurable` chain rules (read-new-else-old, promote-forward, never-delete,
  idempotent, never-throw) — and flag it in the PR as an invariant touch.
- **`[operator-vs-trader-path-separation]`** — the drawer, like the text nav, links no operator
  route.

---

## 8. Tests to write (the requirement set — the FE implements these, never chooses them)

Risk rule (qa-verify §4): `test:` = invariants / negative space / silently-regressing behavior;
`review:` = visible/intentional (copy, presence, ordering) verified in the GATE Q render pass.
No per-AC test mirroring; the existing suite baseline (804/804) must stay green throughout.

| # | Kind | Case |
|---|---|---|
| 1 | `test:` | **393px no-overflow** (Playwright, the skill's Stage-0 enforcement row): on `/`, `/ticker/TSLA`, `/positions`, `/scanner`, `/settings` at 393×852, `documentElement.scrollWidth ≤ innerWidth`; run dark AND light. Silently-regressing — any future component can break it. |
| 2 | `test:` | **Focus-visible presence** (skill enforcement row "add at Stage 0"): assert the theme injects the global `:focus-visible` rule (rendered stylesheet contains the authored ring bound to the primary token), and a source-scan (`?raw`, mutation-tested) that no component adds `outline: 'none'` without an in-file replacement — the Widget case stays the accounted exemption, now with its own `&:focus-visible` style asserted. |
| 3 | `test:` | **Heading-semantics guard on `/ticker`**: rendered TickerDashboard has exactly one `h1`; NO heading element (`h1–h6`) whose text content is a data value (matches `/^[+−$-]?[\d,.]+/` or `%`/`$`-figure patterns); widget titles render as `h2`. Guards the StatTile `component` fix against silent regression by any new tile/widget. |
| 4 | `test:` | **Chip/type floor**: `TintChip` (`_kit`) renders computed `font-size: 11px` (assert via emotion-injected computed style or className innerHTML — never `getAttribute('style')`, per the skill's testing gotcha); plus a source-scan floor: no `fontSize` < 11 in non-SVG-chart component files under `pages/`, `features/`, `shared/ui/` (chart tick exemption list enumerated in the scan, vacuity-guarded). |
| 5 | `test:` | **theme-color follows mode**: unit test on ThemeProvider — after mode resolves dark, `meta[name="theme-color"].content === darkTheme.palette.background.default`; after switching light, it equals the light background. Covers the `system` pref path resolving. |
| 6 | `test:` | **Keyboard operability of position row/card actions**: for `PositionRow`, `PositionCard`, `PositionsView` (incl. empty-state CTAs), every click affordance is focusable and activates on Enter/Space (render → `tab` → `keyboard('{Enter}')` fires the handler). Negative space: a clickable non-button cannot silently reappear. |
| 7 | `test:` | **Degraded-state suite stays green** (existing LOADING≠EMPTY≠OFFLINE, offline-dim, offline-supersedes-live-chip, unavailable-this-cycle, last-trade 4-state specs) — zero deletions, zero weakenings; plus ONE added case: `PositionCard` (mobile card projection) preserves the pending/closed/offline testids and dim semantics the row projection has. |
| 8 | `test:` | **Nav drawer safety**: the drawer (below-`md` nav) contains exactly the 4 `NAV` entries + no `/_ops/metrics` link (the existing no-operator-link assertion extended to the drawer), `aria-current` on the active entry. Invariant-bearing (operator separation), not visual. |
| 9 | `test:` | **Hex discipline + reduced-motion suites stay green** (existing `hex-discipline.spec.ts`, `useReducedMotion` consumption tests) — Stage 0 adds no exemption. |
| 10 | `review:` | **Copy strings** (§4 verbatim): settings subtitle by auth state, `Rolling window: last ~500 req`, hero H1 + body. Update the exact-string specs that own them (`copy`/landing specs) to the new strings — copy tests exist as single-source guards, not per-AC mirrors. |
| 11 | `review:` | **Hamburger presence + drawer behavior** below `md`; wordmark + hamburger + AccountControl fit at 393; drawer closes on navigate. |
| 12 | `review:` | **Touch-target spot-check** at 393 (coarse-pointer): nav entries, hero CTAs, "Analyze a ticker →"-class links, row Close buttons, widget toolbar icons — ≥44px effective hit area (DevTools/Playwright bounding-box spot measurements, not a blanket unit test). |
| 13 | `review:` | **Sticky condensed bar + stacked hero at 393**: anchor readable, chip visible, CTA reachable; skeleton → live → offline walked visually at 393 (the §5 relayout guarantee, eyes-on). |
| 14 | `review:` | **`<main>` landmark present** on in-shell routes (one-shot DOM check in the render pass); heading outline read via the a11y tree on `/ticker` and `/positions`. |
| 15 | `review:` | **`autoFocus` justification comments** present at the two `CustomizationToolbar` sites. |

---

## 9. GATE Q battery (process riders, proposal §6a — all required)

1. `npx tsc -b` clean.
2. `nx build dashboard` green.
3. `nx test @org/dashboard` — full suite green (baseline 804 + the §8 additions), zero skipped/
   deleted degraded-state or motion guards.
4. Lint (module boundaries) green.
5. **Empty backend diff proof:** `git diff main -- apps/api` produces no output.
6. **Real-browser render pass (Playwright): 1440 AND 393, BOTH color schemes**, on `/`,
   `/ticker/TSLA`, `/positions`, `/settings` — screenshots captured and self-critiqued per
   DESIGN_RULES §1.6 (or the explicit "not visually verified by eye" fallback note — never
   silently skipped). The 393 pass explicitly walks: drawer nav open/close, stacked deck,
   tile grids, card positions view, full-screen entry dialog, offline degrade (kill the SSE
   source), cold-load skeletons.
7. Conformance specs: **n/a and correctly absent** — no FE↔BE surface changed.

---

## 10. Open questions (explicitly recorded — nothing silently decided)

1. **SVG chart tick text at 10px** (`chart.tsx`, `TermStructure.tsx`, `LatencyTrend.tsx`): treated
   here as chart annotation OUTSIDE the ≥11px chip/label floor (bumping it moves LOCKED-chart
   geometry). If the owner reads the floor as covering axis ticks, that is a one-line follow-up —
   flagged, not decided into scope.
2. **`<main>` on the Landing page** (outside the shell): the BRIEF's item 3 names `/ticker`; this
   contract lands `<main>` at the AppShell level (covers all in-shell routes) and leaves Landing to
   its Stage 2 rework. Overrule = add a one-line `component="main"` wrapper in `Landing.tsx`.
3. **The 393px test's route set excludes `/_ops/metrics`** (operator-only, deliberately off the
   trader path; desktop diagnostic surface). If the owner wants the operator page in the mobile
   floor, say so — it was not in the BRIEF's offender list.
4. **Verification's "clickable Box/div" finding vs source**: the flagged positions files use
   `component="button"` at every click site found in source — the FE must resolve the discrepancy
   in the rendered DOM (per §3 item 4) and record which sites were false positives; if a genuinely
   non-native click target exists that source reading missed, convert it (already in scope), no
   new decision needed.
5. **Rebase risk is the one named unknown** (BRIEF): if `feat/responsive-layout` conflicts exceed
   mechanical resolution (e.g. TopNav was restructured since, or the branch's dialog changes fight
   the sim-entry-unification shape), the FE reports the conflict shape back before hand-resolving
   anything that touches an invariant surface — it does not improvise a new mobile nav design.
