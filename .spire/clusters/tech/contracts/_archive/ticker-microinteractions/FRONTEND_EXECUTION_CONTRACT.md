# ticker-microinteractions — FRONTEND_EXECUTION_CONTRACT (GATE V, 2026-06-30)

> **Scope:** polish the **Ticker page** with modern **micro/mini-interactions** — "add the juice." FE-only,
> **NO_BACKEND_CHANGE / NO_INTERFACE_CHANGE**, motion/presentation only (no data/logic/scoring change).
> Bound to `PROJECT_CONTEXT.md`. Owner-directed. Files under `apps/dashboard/src/app/ticker/` +
> `gex-profile-chart.tsx` (+ a small shared motion hook/util).
>
> **Aesthetic target:** lively-but-tasteful, "modern trading terminal." Motion must feel purposeful (it
> signals live data + guides the eye), never decorative-for-its-own-sake, never janky.

## HARD invariants (do not violate — these govern every interaction)
- **`[live-vs-static-isolation]` (the big one):** live-signalling motion (value flashes, the connection
  pulse, the chart live-line glide) runs **ONLY when actually live** (`isLive === true && !streamOffline`).
  On an SSE drop it must **stop/freeze**; the existing offline **dim + `⏸ offline`** stays. **Never animate
  a stale/frozen value** — that would falsely imply liveness. Static (Dealer-positioning) tiles never flash
  on a poll refresh.
- **Performance:** the page ticks ~every 1.5s over charts. Animate **only `transform` / `opacity` /
  `color` / `background-color`** (GPU-cheap); **no layout-thrashing** animations (no width/height/top on the
  hot path). Chart animation is **mount-only** (guard so 60s polls / SSE ticks don't re-trigger it). Flashes
  self-limit to the tick cadence (a value that doesn't change doesn't flash).
- **`prefers-reduced-motion`:** every animation has a calm fallback — no flashes, pulses, reveals, or chart
  grow; values update instantly. Implement one shared guard (a `useReducedMotion` check or a CSS
  `@media (prefers-reduced-motion: reduce)` block) and honor it everywhere.
- **Theme/token discipline:** flash/accent colors come from the theme (`success.main` / `error.main` /
  `info.main`), no hardcoded hex.
- **No data/logic change:** `NO_BACKEND_CHANGE`; `opportunity_score`/`tier`/`state_fingerprint` untouched;
  the SSE/poll/watchdog/skeleton lifecycle + component states are preserved. Motion is additive skin.
- Keep `npx nx test dashboard` green; add tests for the new motion hook + the live-gating.

## Interactions to implement

### 1. Live value flash-on-update (the signature interaction)
Add a shared hook `useFlashOnChange(value, { tone })` (in e.g. `ticker/sections/useFlashOnChange.ts`) —
a `usePrevious`-style hook that, when `value` changes, briefly applies a **tint flash** (background or text
color → fades out over ~500–700ms) to the element. Tone:
- **signed/directional** values → green flash on increase (`success.main`), red on decrease (`error.main`):
  Net flow (5m), Gamma flip (live), the headline **price**, Last trade.
- **neutral** values → a subtle `info.main`/neutral flash: Spread, VWAP.
Apply in `LiveTape.tsx` (its tiles) + `TickerHeader.tsx` (price + `LastTradeReadout`). **Gate on
`isLive && !streamOffline`** — pass that in so the hook is inert when not live (no flash on the initial
render, on a poll refresh, or while offline). Debounce/skip if the value is unchanged. Reduced-motion →
no flash (optionally a one-frame static tint, but prefer nothing).

### 2. Connection "live" dot pulse
The `●` live dot in the header connection chip (`TickerHeader`, the `info` live state) gently **breathes**
(a `@keyframes` scale 1→1.15 + opacity pulse, ~1.6s ease-in-out infinite) **only in the live state**. In
the offline/stale/closed states the dot is static (no animation). Reduced-motion → static.

### 3. Section reveal on load (one-time)
When the cold-load skeleton resolves to real content, the major sections (Header, Live tape, Dealer
positioning, GEX chart, Term/AI row, Fresh/Off-exchange row, Setups) **fade + rise in** (~8–12px translateY,
~250ms) with a small **stagger** (~40–60ms per section). Use MUI `Fade`/`Grow` or a CSS keyframe with
per-section `animation-delay`. **One-time on first content mount** — do NOT replay on every 60s poll
(guard with a ref/flag). Reduced-motion → instant, no transform.

### 4. Stat tile hover polish
`StatTile.tsx`: on hover, a subtle **lift** (`transform: translateY(-2px)`) + brighten the left accent /
border + a soft shadow, ~150ms ease. Applies to all tiles (static + live). Keep the offline-dimmed tiles'
hover minimal (don't "undim" on hover). Reduced-motion → color/border change only, no transform.

### 5. GEX chart mount + live-line glide
`gex-profile-chart.tsx`: enable a **gentle one-time bar grow** on mount (recharts `isAnimationActive` is
currently `false` → turn on for the initial render only; guard against re-animating on poll/SSE re-renders,
e.g. an `animatedOnce` ref or `isUpdateAnimationActive={false}`). The **live reference line** transitions
its x-position smoothly when it moves (CSS transition on the line, or recharts animation) — but only while
live. Bars/labels must not re-animate on every refresh (jarring). Reduced-motion → no animation.

### 6. Offline-degrade transition
The dim-to-offline change on live tiles should **transition smoothly** (`transition: opacity 200ms`) rather
than snap. The `⏸ offline` affordance can fade in. (Still instant under reduced-motion.)

### 7. Skeleton → content crossfade
Soften the cold-load handoff — the real content `Fade`s in when the bundle arrives (short, ≤200ms), so it
doesn't hard-swap from skeleton. Reduced-motion → instant.

## Implementation notes
- **No new dependency** — use CSS transitions/`@keyframes` + MUI's built-in `Fade`/`Grow`/`useTheme` +
  a small `usePrevious`/`useFlashOnChange` hook. Do NOT add Framer Motion (keep it lean + perf-safe) unless
  a reveal genuinely needs it (prefer not).
- Centralize the reduced-motion check and the flash timing so behavior is consistent.
- Keep all changes inside the ticker components + the shared hook; do not alter the data hooks
  (`useGhostTrade`/`useAiRecommendation`/the SSE effects) or `theme.ts` globally (a global button
  press-feedback is out of scope for this ticker pass).

## Verification (the lane runs this)
- `npx nx test dashboard` green. Add tests: `useFlashOnChange` flashes on a change **when live**, does **not**
  flash when `!isLive`/`streamOffline` or on an unchanged value, and is inert under reduced-motion (mock
  `matchMedia`). A section-reveal-once test is nice-to-have.
- Grep the touched components for hardcoded color hex → zero (flash colors via theme).
- **Render-verify via preview MCP** (`preview_start dashboard` → :4300, TSLA): confirm no console errors;
  hover a tile (lift), confirm the live dot pulses while live; confirm reduced-motion (`preview_resize`
  can't set it — use `preview_eval` to check the media-query guard / that animations are gated). The
  flash-on-tick is hard to catch headlessly — verify the hook wiring + its tests instead, and report. The
  conductor will do the live render pass.

## Definition of done
- The 7 interactions implemented, all gated on the invariants (live-only motion, reduced-motion fallback,
  GPU-cheap, theme colors, mount-only chart anim). No data/logic change.
- `npx nx test dashboard` green (+ the flash-hook tests); lint clean; `git diff --stat -- apps/api` empty;
  zero hardcoded color hex in touched components.
- Hand back: files changed, test count, the new hook's test coverage, and a note on what you could/couldn't
  render-verify headlessly.
- **Do not commit** — the conductor render-verifies and commits.
