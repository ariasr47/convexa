# FRONTEND EXECUTION CONTRACT — AI Context Pack ("Market context")

> UI work ONLY. Binds to `INTERFACE_CONTRACT.md` (what to CONSUME) + `UX_BLUEPRINT.md` (design +
> copy). Contains NO server internals and NO math derivations. Self-contained against
> `.spire/clusters/tech/context/PROJECT_CONTEXT.md` + the interface contract. No chat history.

## Scope (what the frontend builds)
One new **static-read-family `Widget`** — "Market context" — on the Ticker bento board, directly
after `DealerFlowProjection`, consuming the additive `market_state.market_context` object. Four
StatTile-family sub-cards (Trend & momentum · Gamma profile shape · Flow vs positioning · Average
true range) with all headline labels visible without expanding, visible basis lines, per-label
threshold tooltips, one advisory footer, and **five levels** of honest null degradation. STATIC: no
live wiring, un-dimmed on an SSE drop, refreshed only by the bundle poll, sharing the page's stale
treatment. Renders for any visitor (no auth gate). Token-only, dark/light parity.

## 1. What it consumes (from INTERFACE_CONTRACT — authoritative for names/types/null rules)
- Reads ONLY `data.market_state.market_context ?? null` (`MarketContextPack | null`):
  `trend_momentum` (`as_of_session`; `direction`/`strength`/`momentum` each object|null with `label`
  + scalars) · `gex_profile_shape` (all-or-null: `concentration(_label)`, `balance(_label)`,
  `center_of_mass_distance` — a signed FRACTION the FE renders as a percent, `eligible_strikes`,
  `spot_basis`) · `flow_vs_positioning` (`flow_basis`; `location`/`composition` each object|null) ·
  `atr` (`as_of_session`, `close_basis`, `method`; `atr_5d`/`atr_14d`/`atr_30d` each object|null with
  `value`, `pct_of_close` — already percent points, `window_bars`).
- **Binding negatives:** the FE **never re-derives a label from a scalar** (the wire enum is
  authoritative; display via the §3 mapping only; unknown enum ⇒ that label's unavailable state). The
  FE does **not** parse or render the wire `window`/`thresholds`/`flow_basis`/`method` descriptor
  strings (it has its own pinned copy). The widget receives **no** `isLive`/`streamOffline`/`offline`
  prop and must not read the SSE stream or the payload-gap watchdog.
- **Typed-client obligation:** add the `MarketContextPack` family (interface contract §Typed client)
  to `libs/api/src/lib/convexa.ts`; `market_context?: MarketContextPack | null` on `MarketState`
  (optional key — pre-feature payloads must type-check and render L5).

## 2. Where it goes
- New component `apps/dashboard/src/app/ticker/widgets/MarketContext.tsx`, wrapped in the shared
  `Widget` shell: `id="market-context"`, `title="Market context"`, `span={2}`,
  `bodyVariant="inset"` — the `DealerFlowProjection` widget is the structural template (LimbCard-
  style sub-cards on the inset well, `repeat(auto-fit, minmax(210px, 1fr))` grid — no container-query
  object keys; the `auto-fit`/`minmax` idiom per the dealer-flow post-QA catch).
- Mounted in `TickerDashboard.tsx` **directly after `DealerFlowProjection`** (static region, NOT the
  LiveTape row). Give it the next contiguous `revealIndex` and shift the subsequent widgets +1 so the
  mount cascade stays contiguous. Pass it `m.market_context ?? null` ONLY.
- Widget-shell behavior inherited as-is: expand functional (same body, larger); grip/`⋮` stay
  affordance-only. No bespoke expanded content.

## 3. Component states + display mapping (render EXACTLY these — UX_BLUEPRINT §4/§5)
States (triggers verbatim from UX_BLUEPRINT §4): **Default** · **L1 TI-per-label null** · **L2 ATR
per-horizon null** · **L3 divergence sub-null** · **L4 per-read null (×4)** · **L5 whole-pack null**
· **Missing key ≡ L5** · **Static-on-SSE-drop (byte-identical, un-dimmed, no `⏸`)** ·
**Stale-bundle (page-level treatment only, no per-widget badge)** · **Cold-load / cold-start error
(widget not mounted — shared board behavior)**. LOADING ≠ EMPTY ≠ OFFLINE per the project
distinction; OFFLINE does not exist for this widget.

**The 1:1 enum→display mapping (pinned; implement as a closed lookup, specs assert every row):**
`uptrend`→`Uptrend` · `downtrend`→`Downtrend` · `mixed`→`Mixed` (direction) — `weak`→`Weak` ·
`moderate`→`Moderate` · `strong`→`Strong` — `overbought`→`Overbought` · `bullish`→`Bullish` ·
`neutral`→`Neutral` · `bearish`→`Bearish` · `oversold`→`Oversold` — `concentrated`→`Concentrated` ·
`mixed`→`Mixed` · `dispersed`→`Dispersed` (concentration) — `above_skewed`→`Skewed above spot` ·
`balanced`→`Balanced` · `below_skewed`→`Skewed below spot` — `aligned`→`Aligned` ·
`rotating`→`Rotating` · `divergent`→`Divergent` — `flow_put_tilted`→`Flow put-tilted` ·
`consistent`→`Consistent` · `flow_call_tilted`→`Flow call-tilted`. Unknown value ⇒ that label's
unavailable state (never raw-enum pass-through).

## 4. Copy (locked — UX_BLUEPRINT §5; render verbatim, the specs assert it)
Add to `apps/dashboard/src/app/ticker/widgets/copy.ts` (colocated with the other ticker copy):
- Chrome: `MC_TITLE` `Market context` · `MC_SUBTITLE`
  `Context the AI also reads · snapshot, never live — refreshes with the data load, not the stream.`
  · `MC_INFO` (whole-pack tooltip, §5.1) · `MC_ADVISORY`
  `Advisory context for you and the AI — not a scored signal, not a forecast, not a guarantee.` ·
  `MC_WHOLE_EMPTY` `Market context unavailable this cycle.`
- Sub-card titles: `Trend & momentum` / `Gamma profile shape` / `Flow vs positioning · today` /
  `Average true range`; row labels `Trend`/`Strength`/`Momentum`,
  `Concentration`/`Balance`/`Center of mass`, `Location`/`Composition`, `5-day`/`14-day`/`30-day`.
- Scalar lines (mono, secondary): `close {..} · EMA20 {..} · EMA50 {..}` · `ADX(14) {..}` ·
  `RSI(14) {..}` · `HHI {..}` · signed `{±balance}` · `{±x.x}% vs spot` · `shift {..}` ·
  `vol PCR {..} · OI PCR {..} · tilt {..}` · `${value} · {pct}%`.
- Basis lines (visible, no interaction — the AC-4 surface):
  TI `As of session {date} · daily bars · EMA 20/50 · ADX(14) · RSI(14)` ·
  shape `At spot ${spot_basis} · {eligible_strikes} strikes in the selected window` ·
  flow `Today's session cumulative option volume, unsigned (no buy/sell side) · vs standing open
  interest · full chain · captured at the last data load` ·
  ATR `As of session {date} · vs close ${close_basis} · 5/14/30 trading bars`.
- Null copy (exact, `text.disabled`): per-read `{Read name} unavailable this cycle.` (four strings);
  TI labels `Trend/Strength/Momentum unavailable this cycle.`; divergence
  `Location/Composition unavailable this cycle.`; ATR horizon value cell `unavailable this cycle`.
- Tooltips: the 12 tooltip texts of UX_BLUEPRINT §5.5 (8 row-level with windows + exact pinned v1
  thresholds, 4 card-level) — verbatim.
- Formatters: 2dp for close/EMA/HHI/balance/shift/PCR/tilt; 1dp for ADX/RSI display; explicit sign
  (`+`/U+2212) on balance + center-of-mass; center-of-mass = wire fraction × 100, 1dp, suffix
  `% vs spot`; ATR `$` 2dp locale-grouped + `pct_of_close` 1dp `%`; session dates humanized by
  reusing the existing ISO-date formatter (`humanOpex`) under a neutral alias (e.g.
  `humanSessionDate`). Display-only — never mutate values, never do threshold math.
- **Honesty (binding):** no rendered string contains buy/sell, aggressor-side, or "smart money"
  wording, stop/target, distance-to-level, or sizing figures; nothing implies the pack feeds
  score/gate/tier/setup. (`Bullish`/`Bearish` appear ONLY as the pinned momentum-enum display
  strings under the `Momentum` row label.)

## 5. Tests to write (the FE requirement set — a FLOOR; never drop a listed case)
> Colocated Vitest + Testing Library. Mock only the network boundary (bundle/SSE shapes), never a
> live backend. Each AC → ≥1 named passing test; QA traces every AC at GATE Q. The FE implements this
> whole set (may ADD unit tests) and never decides the requirement set.

**Suite A — `MarketContext.spec.tsx` (component states + copy):**
- **T-AC-1** Default: all four sub-cards render populated — TI 3 labels + their scalars; shape 2
  labels + 3 scalars + `eligible_strikes`; flow 2 labels + both PCRs + shift; ATR 3 horizons each
  `$`+`%`+window — with no auth/session wiring anywhere in the component. *(AC-1)*
- **T-AC-2** Mapping fidelity: for EVERY enum value in §3 (all 20), a payload carrying it renders
  exactly its mapped display string; no other label text can render. *(AC-2)*
- **T-AC-2b / E-4** Unknown enum (e.g. `label: "sideways"`): that label renders its unavailable
  state — no raw-enum pass-through, no invented text. *(AC-2, E-4)*
- **T-AC-3** Digested-only: no `<table>` of periods, no chart/series/OHLC elements in the body (and
  the expanded overlay shows the same body). *(AC-3)*
- **T-AC-4** All four basis lines are present WITHOUT interaction; the flow line contains the pinned
  phrase `Today's session cumulative option volume, unsigned (no buy/sell side)` verbatim. *(AC-4)*
- **T-AC-5** Each of the 8 row labels exposes a tooltip affordance whose content includes its window
  AND its exact pinned thresholds (assert marker substrings, e.g. `0.35`, `20–25`, `1.25`). *(AC-5)*
- **T-AC-6** The advisory footer renders verbatim in Default AND in L1–L4 states. *(AC-6)*
- **T-AC-7** Forbidden-language scan across Default + all null states: rendered text matches none of
  `/buy|sell|smart money|stop|target|sizing|distance to/i` (word-boundary tuned; the pinned copy set
  is the allowlist). *(AC-7)*
- **T-AC-12 (×4)** Exactly one read null (each of `trend_momentum`/`gex_profile_shape`/
  `flow_vs_positioning`/`atr` in turn): only that sub-card shows `{Read name} unavailable this
  cycle.`; the other three render values; no error banner. *(AC-12, E-1)*
- **T-AC-13 (×3)** One TI label null in turn: that row alone shows its unavailable string; sibling
  rows render values; basis line intact. *(AC-13, E-1)*
- **T-AC-15** `atr_14d: null` (and a two-null variant): the null row keeps its label with muted
  `unavailable this cycle`; siblings render; **no `$0` / `0%` anywhere in a null row**. *(AC-15, E-1)*
- **T-AC-16 (×2)** `location`-only and `composition`-only: the null sub-component shows its
  unavailable string; the other renders its values; flow-basis line stays. *(AC-16, E-1)*
- **T-AC-17** `market_context: null`: widget shell + single `Market context unavailable this cycle.`
  line; no sub-cards; no thrown error/error boundary. *(AC-17, E-1)*
- **T-AC-18** Payload with NO `market_context` key at all (pre-feature bundle): identical L5 render;
  console error/warn spies clean. *(AC-18)*
- **T-AC-24** Render Default + L5 under BOTH the dark and light theme: every element themed via
  tokens (no hardcoded hex in the component/copy — lint + snapshot-level assertion), text legible in
  both modes. *(AC-24)*
- **T-E2** LOADING ≠ EMPTY: the resolved-null muted text is a different element/style from the
  cold-load board skeleton; no `⏸`/offline caption exists in any state of this widget. *(E-2)*
- **T-E5** Labels never re-derived: a payload with a scalar/enum mismatch (e.g. `adx: 10`,
  `label: "strong"`) renders `Strong` — the enum wins; no FE threshold math. *(E-5)*

**Suite B — flow/integration (`ai-context-pack.flow.spec.tsx`, mock the bundle + SSE boundary):**
- **T-AC-8** With the widget rendered from bundle A, drive SSE ticks (mid/net-flow updates): the
  widget's rendered output is byte-identical; deliver bundle B with different pack values: the widget
  updates. *(AC-8)*
- **T-AC-9** Bundle flagged `stale`: the page's existing staleness presentation appears (freshness
  line / "Couldn't refresh…" path); the widget adds NO per-widget stale badge and NO freshness claim
  of its own. *(AC-9)*
- **T-AC-10** Simulate an SSE drop (drive `streamOffline` as the existing ticker specs do): all four
  reads stay visible + un-dimmed (opacity/style unchanged), NO `⏸ offline` on this widget, while — as
  the contrast control — the LiveTape tiles DO dim + the offline chip shows; reconnect: the pack is
  unchanged until the next bundle. *(AC-10, E-3)*
- **T-AC-11 (FE face)** Structural: the widget's props accept only the pack object (+ optional
  `revealIndex`); no live/offline prop exists; nothing in the component reads the SSE hook or
  watchdog. *(AC-11 — the wire face is BE-proven)*
- **T-AC-19** The `StateExportDrawer` ("View what's sent" path) contains `market_context` with the
  SAME values the page renders (spot-check labels + scalars). *(AC-19)*
- **T-AC-20** With a null read in the mocked bundle, the export drawer shows that read null/absent —
  never a fabricated value. *(AC-20)*
- **T-AC-21 (FE face)** The Default-persona hand-off assembly (HandoffDialog) renders byte-identical
  with vs without the pack in the bundle, and its text contains no mention of the pack/its fields.
  *(AC-21 — template zero-diff is BE-proven)*
- **T-AC-26 (FE face)** Trader routes render nothing pack-related from `meta` (no `context_pack`
  stage/timing text anywhere on the Ticker page, with `meta.timings` present in the mock). *(AC-26 —
  the metrics-readout face is BE-proven)*

**Not FE-verified (out of the FE lane — traced to BE proofs / docs at GATE Q):**
- **AC-11** (SSE payload byte-unchanged) → BE P-6. **AC-14** (warm-up floors emit null, never silent
  values) → BE P-4; the FE faces of under-warmed payloads are already covered by T-AC-12/13/15.
  **AC-22** (score/tier/fingerprint byte-identity incl. forced failure) → BE P-1/P-2 + conformance.
  **AC-23** (fetch extension changes no existing value) → BE P-3. **AC-25** (glossary) → BE §9 + a
  doc-presence check. **AC-26** (span in `/_ops/metrics`) → BE P-9.

## 6. Files (frontend lane)
- `apps/dashboard/src/app/ticker/widgets/MarketContext.tsx` — the new widget.
- `apps/dashboard/src/app/ticker/widgets/MarketContext.spec.tsx` — Suite A.
- `apps/dashboard/src/app/ticker/ai-context-pack.flow.spec.tsx` — Suite B.
- `apps/dashboard/src/app/ticker/widgets/copy.ts` — the §4 copy constants + formatters + the enum
  display maps (+ `copy.spec.ts` additions if the existing pattern asserts them there).
- `apps/dashboard/src/app/ticker/TickerDashboard.tsx` — mount after `DealerFlowProjection`; shift the
  `revealIndex` cascade; pass `m.market_context ?? null`.
- `libs/api/src/lib/convexa.ts` — the `MarketContextPack` type family + the optional `MarketState`
  field.
- **Untouched:** `LiveTape` + the live-degrade path; the scoring/tier readouts; the SSE subscription /
  payload-gap watchdog (the widget must not read them); `DealerFlowProjection` itself.

## 7. Binding constraints (restated)
- **`[additive-keeps-score-byte-identical]`** — display-only; no copy/color/placement implies it
  feeds score/gate/tier/setup.
- **`[best-effort-isolated-or-null]`** — five independent null levels, each honest muted copy; never
  a fabricated 0/label/date; never an error screen; the rest of the board always intact.
- **`[live-vs-static-isolation]`** — STATIC: no live props/wiring, no `⏸` chip, un-dimmed on SSE
  drop; values change only with a new bundle; stale = the page's existing treatment only.
- **`digested-labels-not-raw-dump`** — labels + declared scalars only; no series/OHLC/period tables.
- **`model-read-carries-its-assumptions`** — basis lines visible inline; thresholds one affordance
  away; the advisory line always with the read; never framed as a guarantee.
- **`theme-token-discipline`** — token-only via the MUI theme / `tokens.ts` (`extrasFor(theme)` for
  mode-aware values); zero hardcoded hex; dark/light parity part of done.
- **No auth gate** — the widget renders for anonymous visitors; no session/gate call anywhere in it.
