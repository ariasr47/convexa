# Theme coverage audit — MUI palette/theme gaps

> **Date:** 2026-07-12 · **Scope:** `apps/dashboard/src/app/theme.ts` + `apps/dashboard/src/app/tokens.ts`
> **Status:** audit + first fix applied (see Changelog). Findings ranked by real-world impact.

## Changelog

- **2026-08-10** — **Gaps #1–#3 closed in code** (audit doc catch-up). `palette.secondary` is wired
  (dark = steel, light = measured secondary) with explicit `contrastText`; light theme sets
  `text.primary` to `inkText`; dark `shadows[]` uses the elevation ladder. Remaining: optional
  typography fine-tuning (#5), divider/action token polish (#6–#7) only if drift appears.
- **2026-07-12** — **Gap #4 (elevation) addressed via a named ladder.** Added
  `elevation` / `elevationFor(theme)` to `tokens.ts` — a small mode-aware box-shadow scale
  (`e1` resting panel · `e2` raised/hover/scrolled-nav · `e4` overlay), dark-tuned (ambient +
  faint top inset-highlight), _not_ MUI's 25-slot `shadows[]`. Wired on the landing surfaces:
  **value cards** rest at `e1` and lift to `e2` (neutral depth + primary border rim, replacing the
  pure colored glow); the **navbar** (`TopNav`) is now scroll-aware (flat/borderless over the hero →
  `divider` border + `e2` on scroll, via `useScrollTrigger`); the **toast** was promoted from #10's
  `background.paper` to the overlay tier (`panelRaised` + `e4`). Recessed surfaces (coming-soon band,
  footer) intentionally left un-elevated. Presentation-only.
- **2026-07-12** — Gap #10 first concrete fix: added a global `MuiSnackbarContent` override
  (`theme.ts` → `COMMON.components`) so snackbars are themed (superseded same day — the toast now
  sits at the overlay elevation tier `panelRaised` + `e4`; see the Gap #4 entry above) instead of
  MUI's default inverted (near-white) `SnackbarContent`. Mode-aware; presentation-only.

## How the theme is built

- **Dark-first, light-derived.** `theme` (dark) is the historical default / anonymous baseline;
  `lightTheme` mirrors its structure. Both spread a shared `COMMON` (`cssVariables`, `shape`,
  partial `typography`, one `MuiButton` override).
- **Single-source tokens.** Color/shape/type values live in `tokens.ts` (kept in sync with Figma via
  `scripts/sync-figma-tokens.mjs`); `theme.ts` consumes them. `cssVariables: true` emits
  `--mui-palette-*` for the palette subset.
- **`extras` live _outside_ the palette.** `panelRaised`, `hatchAlt`, `accentViolet`, `buttonPrimaryBg`,
  … are a separate object resolved via `extrasFor(theme)` in `sx`/styled callbacks (mode-aware). They
  are **not** `--mui-palette-*` vars and **not** addressable via the `sx` string-token shorthand.

**Net:** we set the color _anchors_ and let MUI default or algorithmically derive the rest.

## What is explicitly set

Per theme: `mode`; `primary`/`success`/`error`/`warning`/`info` (**`.main` only**); `text.*`;
`background.default`/`paper`. Shared: `cssVariables`, `shape.borderRadius` (10),
`typography.fontFamily` + `h1` + `h6`, `components.MuiButton`. Plus the `extras` object (dark + light).

## Gaps (unset → MUI default or derived)

| #   | Area                                                     | Status                                                               | Impact down the line                                                                                                                                                                                |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`palette.secondary`**                                  | ✅ set (dark steel / light secondary)                                | Was the highest risk (MUI purple leak). Closed in tokens + theme.                                                                                                                                   |
| 2   | **`.light` / `.dark` / `.contrastText`** per color       | ✅ primary/secondary set explicit contrastText; others still derived | Primary amber uses explicit ink/inkText contrast. Remaining success/error/info auto-derive is acceptable.                                                                                           |
| 3   | **`text.primary` (light theme)**                         | ✅ `inkText`                                                         | Symmetric with dark.                                                                                                                                                                                |
| 4   | **`shadows`** (25-level array)                           | ✅ dark ladder from elevation tokens                                 | Light still uses MUI defaults (readable on paper).                                                                                                                                                  |
| 5   | **`typography` variants**                                | ⚠️ only `h1`, `h6`, `fontFamily`                                     | `h2–h5`, `body1/2`, `subtitle`, `button`, `caption`, `overline` use MUI's default Roboto scale (re-fonted to Inter). `caption` (disclaimers/footer) is default. Only 2 rungs of the ramp are wired. |
| 6   | **`divider`**                                            | ⚠️ MUI default                                                       | `<Divider>` (footer), card borders → `rgba(255,255,255,0.12)`, not a token.                                                                                                                         |
| 7   | **`action.*`** (hover/selected/focus/disabled)           | ⚠️ MUI default                                                       | `'action.hover'` (used ~9×) is MUI's default overlay, not designed.                                                                                                                                 |
| 8   | **`grey`, `common`, `contrastThreshold`, `tonalOffset`** | ⚠️ default                                                           | Feed the derivations in #2 + component internals.                                                                                                                                                   |
| 9   | **`breakpoints`, `spacing`, `zIndex`, `transitions`**    | ⚠️ default                                                           | Fine to leave — rarely need branding.                                                                                                                                                               |
| 10  | **`components.*`** (besides `MuiButton`)                 | ⚠️ default                                                           | No global defaults for Paper/Card/TextField/Chip/etc.; each styled ad-hoc via `sx`.                                                                                                                 |

## Structural note — two parallel token systems

`extras` sit outside `theme.palette`, so they are callback-only (`extrasFor(theme)`) and not
string-addressable / not CSS-var-backed. Palette tokens and extras are maintained separately; e.g.
`accentViolet` cannot be `color="secondary"` until promoted into the palette (see gap #1).

## Recommended fixes (ranked)

1. ~~**Wire `palette.secondary`**~~ — **done** (dark steel / light secondary).
2. ~~**Set `contrastText` explicitly**~~ — **done** on primary/secondary.
3. ~~**Add `text.primary` to the light theme**~~ — **done** (`inkText`).
4. ~~**Dark `shadows` ladder**~~ — **done** via elevation tokens → dark `shadows[]`.
5. **Typography ramp** (`h2–h5`, `caption`) — only if Figma specifies them and drift appears.

Items 1–4 closed 2026-08-10; #5 optional.

## Guardrails when acting on this

- Change tokens in `tokens.ts` (or Figma + re-sync), never hardcode hex in components
  (`theme-token-discipline`).
- Any palette change is **presentation-only** — must not touch score/tier/`state_fingerprint`
  (`additive-keeps-score-byte-identical`).
- Verify **both** modes (dark + light) — the asymmetries above (esp. #3) are exactly where parity
  regresses.
