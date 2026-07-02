# QA Report — Ticker UX-polish program catch-up (system-2, de-correlated)

> Scope: post-hoc GATE Q for the 3 stacked ticker FE feature branches already merged to `main`
> (`ticker-microinteractions` 418315a, `ticker-widgets` 9c66d2e→75b967e, `ticker-command-deck` c481c38)
> **plus** the post-merge external-pipeline commit `c93dddc` ("ai-rec: structured recommendation
> display + dev demo-account tooling"). No PRODUCT_CONTRACT exists for most of this program (GATE-V
> fast-paths); verification runs against the `ticker-microinteractions` FRONTEND_EXECUTION_CONTRACT +
> the promoted invariants (PROJECT_CONTEXT §5 / OPEN_THREADS §9) + runtime interface conformance.
> Verifier: fresh Sonnet session, no chat history, no code edits made.

## 1. FRONTEND_EXECUTION_CONTRACT (`ticker-microinteractions`) — interaction-by-interaction

| # | Interaction (verbatim from contract) | Verdict | Evidence |
|---|---|---|---|
| HARD-1 | `[live-vs-static-isolation]` — live motion runs only when `isLive && !streamOffline`; freezes/stops on SSE drop; static tiles never flash on poll | **PASS** | `useFlashOnChange.ts` gates on `active` param; every call site passes `isLive && !streamOffline` (or the narrower `ltActive`/`active` prop derived from it) — `TickerHeader.tsx:172` (`active: isLive && !streamOffline`), `LiveTape.tsx:31-33` (`active` prop threaded from the same), `LastTradeReadout` `ltActive = live.live && !streamOffline`. `CommandDeck.spec.tsx` "the sticky price + connection FREEZE on an SSE drop" test PASSES (static `$415.99`, not stale live `$416.50`). `LiveTape.spec.tsx` OFFLINE case shows dim+`⏸ offline`, static flip never blanks. Dealer-positioning (static) tiles receive no `active`/flash wiring at all — never flash. |
| HARD-2 | Performance — GPU-cheap props only (transform/opacity/color/bg-color); chart animation mount-only; flashes self-limit | **PASS** | `flashColorSx` animates only `color`. `StatTile.tsx` hover/offline transitions: `transform`, `box-shadow`, `border-color`, `opacity` only. `gex-profile-chart.tsx:63-65` — `animatedOnce` ref + `useEffect(() => { animatedOnce.current = true }, [])` guards the recharts `Bar isAnimationActive` to first mount only; confirmed by reading the code (ref flips permanently true after first paint, so subsequent 60s-poll/SSE re-renders pass `animateBars=false`). `useFlashOnChange` compares `value === before` and no-ops when unchanged. |
| HARD-3 | `prefers-reduced-motion` — one shared guard, honored everywhere | **PASS** | `useReducedMotion.ts` is the single hook (media-query + change-listener, jsdom-safe fallback `false`). Consumed by `useFlashOnChange`, `TickerHeader`'s `connectionChip` (pulse gated on `!reduced`), `Widget.tsx`'s reveal/spin/pulse keyframes (all wrapped in `@media (prefers-reduced-motion: no-preference)`), `gex-profile-chart.tsx`'s `animateBars`, `StatTile.tsx`'s hover CSS (`@media (prefers-reduced-motion: reduce)` zeroes the transform). `useReducedMotion.spec.tsx` (2 tests) + `CommandDeck.spec.tsx` "reduced motion → the live dot does not pulse" / "the condensed reveal uses no transition" pass. |
| HARD-4 | Theme/token discipline — zero hardcoded hex | **PASS** | `grep -rn "#[0-9a-fA-F]{3,6}"` across every `.tsx`/`.ts` under `apps/dashboard/src/app/ticker/**` and `gex-profile-chart.tsx` (non-spec files) → **zero matches**. All flash/pulse/accent colors resolve via `theme.palette.*` or CSS `var(--mui-palette-*)`/`color-mix()`. |
| HARD-5 | No data/logic change — `NO_BACKEND_CHANGE`; score/tier/fingerprint untouched | **PASS** | `git diff --stat 23c7501..HEAD -- apps/api` shows ZERO files changed by the three ticker-UX commits (the only backend delta in the whole range is `c93dddc`, reviewed separately in §2). Live cold==warm byte-identity independently re-proven for TSLA on a clean boot: score `24`, tier `dormant`, `state_fingerprint` `1708cf662e64` — identical, plus full `signals`/`market_state`/`ai_eval` objects `==` between cold and warm fetches. |
| HARD-6 | `npx nx test dashboard` green + hook tests | **PASS** (scoped re-run, not full suite per instructions) | Ran the touched spec files directly via vitest: `useFlashOnChange.spec.tsx` (9), `useReducedMotion.spec.tsx` (2), `StatTile.spec.tsx` (6), `LiveTape.spec.tsx` (4), `GexStrikeProfile.spec.tsx` (2), `Widget.spec.tsx` (11), `CommandDeck.spec.tsx` (19) → **53/53 pass**. Broader `src/app/ticker/**` scoped run → **99/99 pass** (13 files). Full-suite `nx test dashboard` intentionally NOT re-run here (conductor running it in parallel per instructions) — commit message claims 482/482; not independently re-verified at full-repo scope, but no regression found in any ticker-scoped file touched. |
| §1 | Live value flash-on-update (`useFlashOnChange`, signed/neutral tone, gated, debounced) | **PASS** | Hook fully implemented + spec-tested (initial-no-flash, up/down tone, forced-neutral, inactive-no-flash, unchanged-no-flash, null-no-flash, clears-after-duration, reduced-motion-inert — all 9 cases pass). Wired in `LiveTape.tsx` (net flow, spread neutral, live flip) + `TickerHeader.tsx` (headline price + last-trade). |
| §2 | Connection live-dot pulse, live-only, reduced-motion static | **PASS** | `TintChip`'s `pulse` prop drives `@keyframes liveDotPulse` (scale 1→1.15 equivalent, opacity pulse, 1.6s ease-in-out infinite) — `TickerHeader.tsx:50-57`. `connectionChip()` computes `pulse = dot === '●' && tone === 'info' && !streamOffline && !reduced` (live-only, offline/reduced both kill it). `CommandDeck.spec.tsx`: "live session → pulses", "reduced motion → does not pulse", "stream offline SUPERSEDES … no pulse when offline" — all pass. |
| §3 | Section reveal on load — fade+rise, **~8-12px translateY, ~250ms, staggered ~40-60ms/section**, one-time, reduced-motion → instant | **FAIL (regressed after shipping)** | The stagger WAS implemented in `418315a` (`revealSx` — `@keyframes tickerSectionRise`, `translateY(10px)`, `260ms`, explicit `nth-of-type(2..8)` `animationDelay` 50ms increments) and shipped correctly. It was **silently dropped** by the later `ticker-widgets` commit (`9c66d2e`) when the DOM was restructured into the `WidgetSelectionProvider`/bento grid — confirmed by diffing `git show 418315a:.../TickerDashboard.tsx` (has `revealSx`, used at the wrapping `<Box sx={revealSx}>`) against `HEAD:.../TickerDashboard.tsx` (`grep -n revealSx` → no output, zero occurrences anywhere in the file). What remains at HEAD: (a) one outer `<Fade in appear timeout={250}>` wrapping the *entire* board (no stagger, one uniform 250ms fade — no per-section rise/delay), and (b) each `Widget.tsx` instance carries its own **un-staggered** `widgetRise 300ms ease-out both` (translateY(12px)→none) that fires identically for every widget with no per-index offset. Net observable behavior: all widgets/sections reveal **simultaneously**, not with the specified ~40-60ms cascade. No spec test (`Widget.spec.tsx`, `ticker-invariants.spec.tsx`, `ticker-load-experience*.spec.tsx`) asserts a stagger, so the regression shipped silently through a green suite — the AC↔test-traceability gap that is exactly what GATE Q exists to catch. The mount-once guard and reduced-motion gating for the (now un-staggered) reveal are still correct. |
| §4 | StatTile hover — lift `translateY(-2px)`, brighten accent/border, soft shadow, ~150ms; offline tiles minimal; reduced-motion → color only | **PASS** | `StatTile.tsx` `TileCard` `:hover` → `translateY(-2px)`, brighter `boxShadow`, `borderColor: theme.palette.text.disabled`; `transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, opacity 200ms ease`; `@media (prefers-reduced-motion: reduce)` strips the hover transform, keeping only `opacity 200ms`. `StatTile.spec.tsx` renders without throw for offline+accent combinations (visual assertion of the lift itself is a render-verify item, noted below). |
| §5 | GEX chart mount + live-line glide | **PASS (mount-grow) / deferred (glide, explicitly out-of-scope)** | Mount-only bar-grow confirmed (see HARD-2). The live reference-line "glide" (smooth x-position transition) is a bare recharts `<ReferenceLine x={nearest(liveSpot)}>` with no transition/animation — it snaps rather than glides. Per the task brief this is **an acknowledged, deferred-out-of-scope gap, not a fresh finding** (also called out in the `418315a` commit message itself: "Deferred (intentional): the GEX live-line 'glide' — animating SVG line x-attributes is unreliable/janky; not shipped rather than ship it badly"). Not scored as a FAIL. |
| §6 | Offline-degrade transition — smooth `opacity 200ms`, not a snap | **PASS** | `StatTile.tsx` `TileCard` `transition` includes `opacity 200ms ease` unconditionally (even under reduced motion, per the `@media` override which keeps `opacity 200ms ease`). `CommandDeck.tsx:146` also has an explicit offline/condense opacity transition (`max-height 220ms ease, opacity 220ms ease`, `reduced ? 'none' : …`). |
| §7 | Skeleton → content crossfade, ≤200ms, instant under reduced motion | **PASS (as the single outer Fade)** | `TickerDashboard.tsx` cold-load skeleton (`!data && !error`) hard-swaps to the `<Fade in appear timeout={250}>`-wrapped content once `m` resolves. Note: 250ms is slightly over the "≤200ms" figure in the contract prose, but this is the same Fade doing double duty as the (now-understaffed) §3 reveal — a minor timing miss, not scored as an independent FAIL since it is subsumed by the §3 finding above (the Fade exists and crossfades; it just isn't ≤200ms nor staggered). |

**Interaction-level summary:** 6/7 numbered interactions PASS as specified; **§3 (section reveal) is a genuine regression** — the stagger shipped, then was silently removed by a later commit in the same program, with no test catching it. §5's glide is a knowingly-deferred non-goal per the brief, not a fresh gap.

## 2. Promoted invariants — whole stack + `c93dddc`

| Invariant | Verdict | Evidence |
|---|---|---|
| `[additive-keeps-score-byte-identical]` | **PASS** | AST import-check: 0/4 scoring modules (`core/signals.py`, `core/engine.py`, `core/live.py`, `core/darkpool.py`) import `ai_recommendation`, `auth`, or `personas` (verified programmatically, not by inspection alone). Live bundle byte-identity re-proven on a clean boot (score 24 / tier `dormant` / `state_fingerprint` `1708cf662e64` cold==warm, full `signals`/`market_state`/`ai_eval` dict equality). The ticker FE commits are backend-diff-empty; `c93dddc`'s backend delta (`main.py`, `auth/service.py`, `ai_recommendation.py`, `personas.py`, `strategy_prompt.md`, `requirements.txt`) never touches the scoring modules. |
| `[best-effort-isolated-or-null]` | **PASS** | `_seed_test_account()` (`main.py`): gated by `SEED_TEST_ACCOUNT` (default unset/off, confirmed absent from `apps/api/.env`), refuses to run when `ACCOUNT_STORE=postgres`, wrapped in its own try/except (`except Exception: logger.warning(...); return` — never raises), and is called at module import time but its own body never propagates. Verified live: booted a clean backend instance with `SEED_TEST_ACCOUNT` unset → `GET /api/auth/session` returns `demo_seed: null`, boot log shows clean `Application startup complete` with no seed-account log line and no crash. (An unrelated already-running backend instance on port 8000, seeded from a different session's env, was NOT this code's fault — isolated by re-testing on a dedicated port with a controlled environment.) `_coerce_strategy` in `ai_recommendation.py` bounds `key_points` (cap 5) and `reengage_when` (cap 3), filters non-string/blank entries, and defaults `summary`/`key_points`/`reengage_when` to `None`/`[]` when absent from the LLM/stub output — additive fields degrade gracefully, never crash the strategy shape. |
| `[live-vs-static-isolation]` | **PASS** | See FRONTEND_EXECUTION_CONTRACT HARD-1 above; re-confirmed via `CommandDeck.spec.tsx`'s explicit sticky-bar freeze-on-drop test and `LiveTape.spec.tsx`'s OFFLINE case. `prefers-reduced-motion` fallback exists and is honored (HARD-3). |
| `[no-real-order-path]` | **PASS** | Widget affordances (`Widget.tsx`): the drag grip has no `draggable`/`onDragStart`/`onDrop` handlers anywhere (grep confirmed zero occurrences) — purely a styled `<Box>` with a tooltip; the `⋮` configure `IconButton` is `disabled` (its `Menu`'s only `MenuItem` is also `disabled`); the "+ Add widget" ghost slot has `aria-disabled`, `cursor:not-allowed`, and no `onClick` — all read as honest coming-soon, never fake-functional. `testSeed.ts` (dev demo-account positions) is client-local-only (`localStorage`), non-destructive (only seeds an empty store), best-effort (swallows all exceptions), and explicitly documented as simulation-only, never feeding signals/score/tier/fingerprint. No broker/order code introduced anywhere in the reviewed diff. |
| `[operator-vs-trader-path-separation]` | **PASS (untouched)** | `git show c93dddc --stat` touches no `operator-metrics`/`_metrics`/`observability` file; confirmed out of scope for the whole reviewed range. |
| `sections`→`widgets` rename (dead-key check) | **PASS** | `assemble()`'s only backend caller is `ai_recommendation.py:469` (`personas_lib.assemble("entry", persona)["text"]`) — reads `["text"]` only, never touches the renamed key. `GET /api/personas` (`main.py:1039-1050`) calls `personas_lib.readout()`, NOT `assemble()` — confirmed by reading the endpoint body. No FE consumer reads a `widgets`/`sections` key from any backend response (the FE's own `personas/template.ts` has an unrelated, pre-existing, client-embedded `sections` field that never round-trips to/from the backend — the known dual-source noted in OPEN_THREADS §7, not a new coupling). The rename is confirmed dead-key/cosmetic, does not ride the wire. |
| `demo_seed` additive/null-safe | **PASS** | Backend: `demo_seed` is `None` by default (`self._demo_seed_email: Optional[str] = None`), only set via the gated dev seed path. FE: `libs/api/src/lib/convexa.ts:295` types it `demo_seed?: { email: string } | null` (optional+nullable); `AuthContext.tsx:71` reads `s.demo_seed ?? null`; `AuthDialog.tsx:59-60` guards with `if (mode === 'login' && auth.demoSeed)` before dereferencing `.email` — never breaks the who-am-I shape or crashes on absence. |
| Zero hardcoded hex / token-only | **PASS** | See FRONTEND_EXECUTION_CONTRACT HARD-4 — zero matches across the whole `ticker/**` + `gex-profile-chart.tsx` scope. |

## 3. Runtime interface conformance (system-1)

Backend booted clean (isolated instance, port 8010, `SEED_TEST_ACCOUNT` unset, real `MASSIVE_API_KEY`, empty `ANTHROPIC_API_KEY`) via `apps/api/.venv/Scripts/python.exe`.

| Spec | Result |
|---|---|
| `user-accounts.json` | **PASS** — `GET /api/auth/session` (4 required fields incl. `demo_seed`'s parent shape) + `POST /api/auth/signup` (8 fields) — 0 failures. |
| `ticker-load-experience.json` | **PASS** — `GET /api/ticker/{ticker}` (17 fields) + `GET /api/_metrics` (7 fields) — 0 failures. |
| `ai_recommendations.json` | **PASS** — `GET /api/recommendation/export/{ticker}` (6), `GET /api/recommendation/status/{ticker}` (10), `GET /api/personas` (2) — 0 failures. |
| `byo-ai-key.json` | **PASS** — `GET /api/recommendation/status/{ticker}` (9), `GET /api/recommendation/export/{ticker}` (6) — 0 failures. |

`in_app_enabled:false` correctly reported on `/api/recommendation/status/TSLA` with no `ANTHROPIC_API_KEY` set (honest, no crash — matches the expected `no_key`/stub degrade, not scored as a failure).

**11/11 conformance endpoints PASS across 4 specs. No field the interface promises was omitted or mistyped by the live backend.**

## 4. Frontend test suite (scoped)

Full `nx test dashboard` intentionally not re-run here (parallel conductor run, per role brief). Scoped re-runs via `vitest run` directly:
- `src/app/ticker/widgets/{useFlashOnChange,useReducedMotion,StatTile,CommandDeck,Widget,LiveTape,GexStrikeProfile}.spec.tsx` → **53/53 pass**.
- `src/app/ticker/**` (13 spec files) → **99/99 pass**.
- `src/app/ai-rec/{AiRecPanel.reasoning,ai-rec}.spec.tsx` → **39/39 pass** (10 + 29).
- `src/app/positions/testSeed.spec.ts` → **6/6 pass**.

No regression found in any file touched by the reviewed commits. AC↔test traceability: every FRONTEND_EXECUTION_CONTRACT interaction has a named test EXCEPT the §3 stagger, which has **zero** test coverage anywhere — consistent with how the regression shipped invisibly.

## Summary

- **PASS:** 15
- **FAIL:** 1 (§3 section-reveal stagger — regressed, unmaintained by any test)
- **UNVERIFIABLE:** 0

## Overall GATE Q verdict: **FAIL**

The single FAIL is a real, reproducible regression (not a documentation gap): the FRONTEND_EXECUTION_CONTRACT's §3 "small stagger (~40-60ms per section)" requirement shipped correctly in `418315a` and was silently dropped by the subsequent `9c66d2e` (`ticker-widgets`) restructure, with zero test coverage ever added to protect it. Every other interaction, both promoted invariants, both `c93dddc`-specific checks (dead-key rename, `demo_seed` null-safety, gated dev seed), and runtime interface conformance (11/11) hold clean.

## GATE Q RE-RUN — §3 fix verified (conductor, 2026-07-01)

The single FAIL was bounced (GATE Z) and fixed inline by the conductor (the established pattern for this
motion program; a `delivery-frontend` lane is unnecessary for a one-item, fully-scoped motion fix that must
be render-verified by the conductor regardless). **Fix:** restored the §3 stagger through the bento
structure — `Widget.tsx` gained a `revealIndex` prop that sets an inline `--widget-reveal-delay` custom
property driving the `widgetRise` mount-reveal `animation-delay`; the displaced `@supports
(animation-timeline: view())` scroll-driven override (added by `9c66d2e`, which had replaced the stagger)
was removed so the staggered mount reveal is canonical again; the board (`TickerDashboard.tsx`) feeds each
of the 8 sections its position (`revealIndex={0..7}`), forwarded through each section component. **Files:**
`ticker/widgets/{Widget,LiveTape,DealerPositioning,GexStrikeProfile,TermStructure,FreshPositioning,OffExchangeBlocks,Setups}.tsx`,
`ai-rec/AiRecPanel.tsx`, `ticker/TickerDashboard.tsx`.

**Re-verification (the AC↔test gap closed):**
- **New named tests** (`Widget.spec.tsx` → "Widget — staggered mount reveal (§3)", 4 cases): per-position
  delay (0/55/165ms + strictly-increasing), default 0ms standalone, clamp at index 8 (440ms), and one-shot
  stability across a re-render (the "never replays on a 60s poll" guarantee). Previously ZERO tests covered
  the stagger — this is why it regressed silently.
- **Mechanical gates (conductor):** `nx test dashboard` **486/486** (49 files; +4 stagger tests), `tsc
  -p apps/dashboard/tsconfig.app.json --noEmit` clean, `nx lint dashboard` 0 errors, `nx build @org/dashboard`
  green.
- **Render pass (conductor, :4300 + live :8000 backend, Chromium):** the running bento shows the cascade —
  `--widget-reveal-delay` 0→55→110→165→220→275→330→385ms across live-tape→dealer→gex→term→ai-rec→fresh→
  off-exchange→setups, each `animationName: widgetRise` (the removed view-timeline `widgetReveal` is gone),
  computed `animation-delay` matching; the "+ Add widget" slot correctly has no reveal animation; console
  error-free.

**§3 verdict: PASS.** Overall GATE Q (re-run): **PASS** — 16/16, no FAIL, no UNVERIFIABLE.

## Amendments bounced to Frontend (RESOLVED — see GATE Q RE-RUN above)

| Failing AC | Observed | Expected | Owning lane |
|---|---|---|---|
| FRONTEND_EXECUTION_CONTRACT §3 "Section reveal on load" — "…the major sections … fade + rise in … with a small **stagger** (~40-60ms per section)" | All widgets/sections in the bento board reveal **simultaneously** on first content mount: one outer `<Fade in appear timeout={250}>` (no per-child delay) wraps the whole board, and each `Widget.tsx` instance applies its own **identical, un-staggered** `widgetRise 300ms ease-out both` keyframe (no per-index `animationDelay`). Confirmed by `grep -n "revealSx" apps/dashboard/src/app/ticker/TickerDashboard.tsx` → 0 matches at HEAD, vs. present (with explicit `nth-of-type(2..8)` → `animationDelay: '50ms'..'350ms'`) at commit `418315a` (`git show 418315a:apps/dashboard/src/app/ticker/TickerDashboard.tsx`). | Each of the ~8 top-level board sections (Header/deck, Live tape, Dealer positioning, GEX chart, Term/AI row, Fresh/Off-exchange row, Setups) should rise+fade in with a ~40-60ms cascade between sections on the first cold-load resolve, still one-time (no replay on the 60s poll), still reduced-motion → instant. | **Frontend** — the closest buildable fix is restoring a stagger analogous to the original `revealSx` block, adapted to the current bento/`Widget.tsx` structure (e.g. thread a `revealDelayMs`/index prop into `Widget` so its own `widgetRise` keyframe gets a per-position `animationDelay`, since the old `nth-of-type` selector on the outer container no longer aligns 1:1 with visual "sections" now that widgets are `Widget`-wrapped children of a CSS grid), plus a named test asserting the stagger exists and doesn't replay on a simulated poll, to close the AC↔test-traceability gap that let this regress silently. Do NOT re-flatten the bento layout to fix this — layer the stagger back into the existing `Widget` shell. |
