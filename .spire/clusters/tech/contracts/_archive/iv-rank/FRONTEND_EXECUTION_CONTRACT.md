# iv-rank — FRONTEND_EXECUTION_CONTRACT

> GATE U·X deliverable. **UI work + component states ONLY** (targets `apps/dashboard`). References the
> **INTERFACE_CONTRACT** for what it CONSUMES. NO server internals, NO math derivation. Independently
> buildable by a fresh executioner reading ONLY this file + the INTERFACE_CONTRACT + PROJECT_CONTEXT.
>
> Bound interface: **`.spire/clusters/tech/contracts/iv-rank/INTERFACE_CONTRACT.md`** — this lane CONSUMES
> `market_state.iv_rank` (`m.iv_rank ?? null`) exactly as that contract's §2–§3 specify.
>
> Component states, copy, tooltips, the AC→state map, and the placement decision are in
> **`.spire/clusters/tech/contracts/iv-rank/UX_BLUEPRINT.md`** — implement that blueprint; do not re-scope it.
>
> Closest shipped precedents to mirror: `apps/dashboard/src/app/ticker/widgets/DealerFlowProjection.tsx`
> (a small single-object static read — the structural template) and `.../MarketContext.tsx` (the
> null-family + advisory-footer + closed-enum-display + source-scan-test discipline). Copy constants
> live in `apps/dashboard/src/app/ticker/widgets/copy.ts` (extend it).

---

## 1. What to build

1. **One new static-family widget** — `apps/dashboard/src/app/ticker/widgets/IvRank.tsx`, structured
   like `DealerFlowProjection.tsx`: a `Widget` shell (id `iv-rank`) with the static-frame subtitle, an
   ⓘ info affordance, a body rendering the four component states, and ONE widget-level advisory footer.
   It consumes **exactly one prop** — `read: IvRankRead | null` — and takes an optional
   `revealIndex?: number` for the staggered mount reveal. **NO `offline`/`isLive`/`streamOffline`
   prop** (`live-vs-static-isolation`).
2. **Copy constants** in `copy.ts` (the pinned FE strings from UX_BLUEPRINT §4 — the widget renders
   these, NEVER the wire `*_descriptor` strings), plus closed display lookups for `band` and `iv_basis`
   (mirroring `mcDisplay` / `MC_*_DISPLAY`).
3. **Mount it in `TickerDashboard.tsx`** in the static context-read family, **directly after
   `MarketContext`** (UX_BLUEPRINT §1). Bind it to `m.iv_rank ?? null`. Take the next `revealIndex` in
   the cascade and shift the sections below it +1 — exactly as `MarketContext`/`DealerFlowProjection`
   were inserted.
4. **Consume the type** `IvRankRead` from `@org/api` (added to `libs/api/src/lib/convexa.ts` — see §2).

---

## 2. The type (consume from `@org/api`)

Add the `IvRankRead` interface + its enums (`IvRankState`, `IvRankBand`, `IvBasis`) to
`libs/api/src/lib/convexa.ts` **exactly** as the INTERFACE_CONTRACT §3 declares, and add
`iv_rank?: IvRankRead | null` to `MarketState` (OPTIONAL key so pre-feature payloads type-check —
mirror how `market_context?` is declared). Consumers read `m.iv_rank ?? null`. This mirrors the typing
discipline already used for `market_context` / `dealer_flow_projection`.

---

## 3. Component states (implement the UX_BLUEPRINT §2 model)

Four mutually-exclusive body states, selected purely from the wire — **never re-derive state, band, or
a rank from a scalar:**

- **Default / Computed** — `read != null` && `read.state === 'computed'` && `read.rank != null`:
  render the headline Rank + pinned descriptor, the secondary Percentile + descriptor, the ONE band
  token (via the closed `band` lookup), the basis/envelope line (window sessions · sample count ·
  basis, clean vs fallback wording keyed off `iv_basis`), and the advisory footer.
- **Computed · degenerate-flat** — `read.state === 'computed'` && `read.rank == null` (with
  `rank_unavailable_reason === 'flat_window'`): render the pinned flat note in the rank slot; still
  render Percentile + the basis line + the advisory footer; **render NO band token**.
- **Building history** — `read.state === 'building'`: render the "Building history — {N} of {N_min}
  sessions" message from `sample_count` + `min_samples`; render **NO rank, NO percentile, NO band**;
  render the advisory footer (and the basis descriptor when a basis is present).
- **Unavailable this cycle** — `read == null` (whole field null, or absent key → `?? null`): render the
  single muted `text.disabled` "IV rank unavailable this cycle." line; NO advisory footer, NO
  sub-content, NO error, NO blank.

An **unknown `state`** or **unknown `band`/`iv_basis` enum** degrades fail-honest: unknown `state` →
the Unavailable body; unknown `band` → render no band; unknown `iv_basis` → render the neutral/clean
basis wording without a fabricated DTE claim. Never a raw enum pass-through, never a thrown render.

**No widget-local loading/stale/offline state** — the page's skeleton-first load owns loading; the
page's soft "Couldn't refresh" owns stale; static-isolation means no offline branch (the widget stays
visible + un-dimmed on an SSE drop).

---

## 4. Display / rendering rules (binding)

- **Never a bare number** (`model-read-carries-its-assumptions`, AC-18): no state renders a rank number
  without the basis line + advisory framing in the same body.
- **Closed-enum display only:** `band` and `iv_basis` are displayed via closed lookup tables (like
  `mcDisplay`); the FE never re-derives the band from `rank`, never re-computes a state.
- **Never render the wire descriptors:** `window_descriptor` / `basis_descriptor` / `advisory_note` are
  wire-only (for the AI export). The FE renders its OWN pinned copy. Guard with a sentinel-value test
  (a fixture puts a `WIRE-DESCRIPTOR-NEVER-RENDERED` sentinel in those fields and asserts it never
  appears in the rendered output — mirror `MarketContext.spec.tsx`).
- **No raw series** (`digested-labels-not-raw-dump`, AC-9): no chart/series/list/table/sparkline of
  daily IV in any state or in the expanded/peek overlay. Only numbers + band token + envelope.
- **`theme-token-discipline`:** token-only via the MUI theme (`text.disabled` / `text.secondary` /
  `divider`, mono via `typographyTokens.monoFontFamily`); **zero hardcoded hex**; dark/light parity
  from the shared `Widget`/tile chrome.
- **No auth gate** (AC-3): no session/gate/`useGate` call anywhere in the widget; anonymous-visible.
- **Honesty-posture voice** (`additive-keeps-score-byte-identical`): no copy/color/placement implies
  the read feeds score/gate/tier/setup. The band's `premium rich`/`cheap` + their lean-framing tooltip
  are the ONLY permitted directional language; no "smart money"/stop/target/sizing/distance language.

---

## 5. Tests to write — THE REQUIRED CASE SET (do NOT choose the requirement set; implement this one)

Derived from UX_BLUEPRINT §5 (each AC × component state × edge/invariant). Two suites, mirroring the
`MarketContext`/`DealerFlowProjection` spec structure. Fixture anatomy: rank `82` / percentile `74` /
`window_cap 252` / `window_sessions 130` / `sample_count 130` / `iv_basis 'interpolated_30d'` /
`band 'premium_rich'` for the Default fixture; variants as noted per case.

**Suite A — component states (`IvRank.spec.tsx`, `render` under `ThemeProvider`):**

- **T-AC-1** — Default: the static-family shell (`widget-iv-rank`) + body (`iv-rank`) render with the
  headline Rank, secondary Percentile, band token, and basis line; NO `⏸` offline caption.
- **T-AC-3** — source-scan: the component source (`IvRank.tsx?raw`) contains no auth/gate/session
  reference (`useGate`/`simTradeGate`/session), and renders with no gate wiring.
- **T-AC-4** — Default: headline Rank `82` (0–100) + the pinned plain-language descriptor both render.
- **T-AC-5** — Default AND degenerate-flat: secondary Percentile `74` + its descriptor render in both.
- **T-AC-6** — band consistency: three fixtures — `rank 82`/`band premium_rich`, `rank 50`/`band
  neutral`, `rank 18`/`band premium_cheap` — each renders exactly ONE band token matching the wire
  enum (via the closed lookup). Assert the FE trusts the wire token (does not recompute).
- **T-AC-7** — Default: the basis line renders `window_sessions` + `sample_count` + the clean-CM30
  basis wording, all without interaction.
- **T-AC-8** — Default AND Building: the verbatim advisory footer renders in both.
- **T-AC-9** — Default (+ source-scan): no series/list/table/chart of daily IV renders; the source
  imports no chart/series component for the history.
- **T-AC-10** — Building (`sample_count 12`, `min_samples 20`): "Building history — 12 of 20 sessions…"
  renders with the actual count.
- **T-AC-11** — Building: NO rank number and NO percentile number render (query them absent — not even
  a placeholder value).
- **T-AC-12** — Building vs Unavailable contrast: render both bodies and assert their text differs
  (distinct copy constants).
- **T-AC-13** — degenerate-flat (`state 'computed'`, `rank null`, `rank_unavailable_reason
  'flat_window'`, `band null`): the flat note renders in the rank slot, NO "50"/any number in that
  slot, NO band token; Percentile + basis line still render.
- **T-AC-14** — Unavailable (`read == null`): the single muted "IV rank unavailable this cycle." line;
  no error text, no blank, no advisory footer.
- **T-AC-18** — Default + degenerate-flat: assert the basis line + advisory framing are present in the
  same body whenever a rank/number renders (no bare number).
- **T-AC-19** — fallback fixture (`iv_basis 'nearest_tenor'`, `basis_dte 23`): the basis line renders
  the fallback wording incl. `~23d`, distinct from the clean-CM30 wording.
- **T-descriptors** — sentinel test: with `window_descriptor`/`basis_descriptor`/`advisory_note` set to
  `WIRE-DESCRIPTOR-NEVER-RENDERED`, that sentinel never appears in the rendered output (the FE renders
  its own pinned copy).
- **T-theme** — Default + Unavailable render under BOTH `theme` and `lightTheme`; the component source
  (`IvRank.tsx?raw`) matches `not.toMatch(/#[0-9a-fA-F]{3,8}\b/)` (zero hardcoded hex,
  `theme-token-discipline`).
- **T-static-source** — source-scan: `IvRank.tsx?raw` matches `not.toMatch(/streamTicker|EventSource|
  streamOffline|isLive\b|payload-gap|watchdog/)` (static-isolation, AC-17 structural half).

**Suite B — integration flow (`iv-rank.flow.spec.tsx`, mounted in the ticker render tree):**

- **T-AC-1-flow** — the widget appears in the static context-read family region (after MarketContext).
- **T-AC-15** — a null `iv_rank` renders the muted line while sibling static widgets still render
  (a null never blanks/errors the board).
- **T-AC-17** — under a simulated stream drop (the page's `streamOffline` path), the iv-rank widget
  stays visible + un-dimmed and shows NO `⏸ offline` chip — contrast a LiveTape tile that dims (mirror
  the `dealer-flow-projection.flow.spec.tsx` static-vs-live contrast assertion).

**ACs verified in OTHER lanes (not FE tests, noted for the mapping):** AC-2 (AI export ride-along) and
AC-16 (score byte-identity) are backend/interface obligations — see the BACKEND contract + conformance.

Use `?raw` Vite imports for all source-scan tests (`import src from './IvRank.tsx?raw'`) — NOT
`readFileSync(fileURLToPath(...))` (RESUME gotcha).

---

## 6. Binding invariants (FE face)

- `live-vs-static-isolation` (AC-17), `model-read-carries-its-assumptions` (AC-7/8/18/19),
  `digested-labels-not-raw-dump` (AC-6/9), `additive-keeps-score-byte-identical` (honesty posture),
  `best-effort-isolated-or-null` (AC-12/14/15), `theme-token-discipline` (T-theme), no auth gate
  (AC-3). Each is restated in the widget's file header (mirror `DealerFlowProjection.tsx` /
  `MarketContext.tsx` headers).

---

## 7. Build & verification notes (so the executioner doesn't rediscover them)

- **Tests run via** `npx nx test dashboard` (baseline **658** — from ai-context-pack; your suites add
  to it).
- **App typecheck gate:** `tsc -b apps/dashboard/tsconfig.app.json --force` — NOT bare `tsc -p` (bare
  resolves `@org/api` through a possibly-stale `libs/api/dist`). Add the `IvRankRead` type to
  `libs/api/src/lib/convexa.ts` (consumed as source via `@org/api`).
- **Source-scan tests** read source via a Vite `?raw` import, NOT `readFileSync(fileURLToPath(...))`.
- **Node** is via nvm (not on PATH) — use the repo's `nx`/`npm` scripts.
- **`revealIndex` cascade:** inserting the widget after `MarketContext` shifts every section below it
  +1 — update those `revealIndex` props too (mirror the MarketContext insertion in `TickerDashboard.tsx`).
