# Design-review verification pass — 2026-07-22 (real browser, Playwright MCP)

> Companion to `docs/design/DESIGN_REVIEW_2026-07-22.md`, which was structural-only
> ("not visually verified by eye"). This pass re-checked its hard-floor findings against
> the RUNNING app (live backend, real TSLA data) in real Chromium, plus a Vercel Web
> Interface Guidelines (WIG) anti-pattern sweep. Screenshots in this folder.

## Hard-floor findings — verdicts

| Review claim | Verdict | Evidence |
|---|---|---|
| Horizontal overflow at 393px | **CONFIRMED — severe** | `scrollWidth 580 vs 393` on `/ticker/TSLA`; offenders: header toolbar `MuiStack` (right=580), "Open simulated trade" button row, widget headers. `ticker-393-dark.jpeg`: Live-tape tiles cut mid-tile. |
| No mobile nav | **CONFIRMED** | At 393px the text nav overflows ("Blog" clipped off-screen); no hamburger/drawer. |
| Zero `:focus-visible` | **CONFIRMED (near-zero)** | Tab-focus on nav link → UA default `outline: auto` only. Source grep: exactly 1 file with focus styling (`shared/ui/Widget/Widget.tsx`, its `outline:'none'` paired with `:has(:focus-visible)` grip chrome). All buttons/links/fields ride UA defaults. |
| `<h6>` stat values | **CONFIRMED** | 29 `<h6>` on the ticker page; samples are VALUES ("$367.17", "+9,228"), not headings. `h1` count 1. |
| 9px text ("chips") | **CONFIRMED (nuance)** | The 9px text is the "+0.0% vs spot" delta SPANS inside tiles; MuiChip labels proper are 13px. |
| Competent-but-generic aesthetic | **VISUALLY CONFIRMED** | `landing-1440-dark.jpeg` / `ticker-1440-dark.jpeg`: GitHub-dark neutrals, Inter, blue→violet gradient CTA, arc motif barely perceptible. Retires the review's "not verified by eye" caveat. |
| Light-mode parity | **CONFIRMED GENUINE** | `ticker-1440-light.jpeg`; `color-scheme` flips to light correctly. |

## New findings (this pass)

- `<meta name="theme-color">` stays `#0e1117` in LIGHT mode (WIG: should match background).
- Clickable `<Box>`/`<div>` without keyboard handlers: `features/trading/positions/PositionCard.tsx`, `PositionRow.tsx`, `PositionsView.tsx` (WIG: use `<button>`/keyboard handlers).
- `autoFocus` ×2 (justify or remove — WIG "sparingly").

## Retracted / false alarms

- Light-mode "Net flow positive rendered red": transient flash-on-tick animation frame; steady-state is green (rgb 30,158,87). NOT a bug.

## What passed the WIG sweep

- No `user-scalable=no` / `maximum-scale` zoom-blocking.
- No `transition: all`.
- `tabular-nums` present (8 sites).
- `aria-label` coverage decent (36 sites).
- No stray `outline: none` beyond the accounted Widget case.

## Implication for Q4

The floor failures are real, severe on mobile, and independent of any brand-direction
taste question — Stage 0 (floor repair) is justified regardless of which direction
(a)/(b)/(c) is chosen for the brand.
