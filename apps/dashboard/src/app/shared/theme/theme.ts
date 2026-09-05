import {
  elevation,
  elevationFor,
  extrasFor,
  palette,
  shape,
  typographyTokens,
} from '@/shared/theme/tokens';
import type { ThemePref } from '@convexa/api';
import { createTheme, type Theme } from '@mui/material/styles';
// `mui.d.ts` (this directory) ambiently augments `BreakpointOverrides` with the five v2 keys
// (tablet/smallLaptop/laptop/desktop/wide) — picked up by the TS program via tsconfig's include
// glob, so `{ xs: 'none', laptop: 'flex' }` type-checks app-wide with no explicit import here.

// The shared MUI typography variant map (redesign-stage-1 §4.3 — the proposal §3 scale).
// Display voice = Archivo SemiExpanded via a REAL `font-stretch` (variable wdth axis, never a
// faux scaleX). In-app heading SIZES are structural and stay (h1 = the ticker anchor); the
// 44–56px display scale is exported from tokens (`displayScale`) for Stage 2's landing hero.
const TYPOGRAPHY = {
  fontFamily: typographyTokens.fontFamily,
  h1: {
    fontFamily: typographyTokens.displayFontFamily,
    fontStretch: typographyTokens.displayFontStretch,
    fontSize: '1.6rem',
    fontWeight: 700,
  },
  // H2 = 28px / 700 per the proposal scale.
  h2: {
    fontFamily: typographyTokens.displayFontFamily,
    fontStretch: typographyTokens.displayFontStretch,
    fontSize: '1.75rem',
    fontWeight: 700,
  },
  h3: {
    fontFamily: typographyTokens.displayFontFamily,
    fontStretch: typographyTokens.displayFontStretch,
    fontWeight: 700,
  },
  h4: {
    fontFamily: typographyTokens.displayFontFamily,
    fontStretch: typographyTokens.displayFontStretch,
    fontWeight: 600,
  },
  // Section/card titles — Plex Sans SemiBold 16 (the shipped widget-title idiom).
  h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.25 },
  // Section labels: 13px caps, +6% tracking (proposal scale).
  overline: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    lineHeight: 2,
  },
  // Body 15/1.65 · secondary body 13 (proposal scale). Caption stays 12px — above the 11px chip floor.
  body1: { fontSize: '0.9375rem', lineHeight: 1.65 },
  body2: { fontSize: '0.8125rem' },
  caption: { fontSize: '0.75rem' },
  button: { fontWeight: 600 },
} as const;

const COMMON = {
  // Emit MUI CSS theme variables (`--mui-palette-*`, …) — the palette/shape/type values are
  // single-sourced from `tokens.ts` (the single authority; the Figma DS is retired).
  // Presentation-only: no bundle/score path change.
  cssVariables: true,
  shape,
  typography: TYPOGRAPHY,
  // The declared v2 rungs (SPEC §2.2). `sheetScrim` 29 and `popover` 35 are named in the canon
  // for later phases; MUI has no slot for either, so they are not invented here.
  // mobileStepper/fab/speedDial have NO consumers but MUST be given values — left at MUI's
  // 1000–1050 defaults they sit above every rung below.
  zIndex: {
    mobileStepper: 10,
    fab: 15,
    speedDial: 15,
    appBar: 20,
    drawer: 30,
    modal: 40,
    snackbar: 50,
    // The canon declares six rungs; MUI has eight slots. `tooltip` is UNDECLARED (SPEC §9-2, an
    // Amendments-shaped gap for the owner). This is the working mapping: above toast, and no
    // longer 1500. `AppShell.tsx:42` reads `theme.zIndex.tooltip + 1` for the skip link.
    tooltip: 60,
  },
  // ADDITIVE ONLY. Redefining xs/sm/md/lg/xl is rejected (SPEC §2.2).
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      tablet: 768,
      md: 900,
      smallLaptop: 1000,
      laptop: 1100,
      lg: 1200,
      desktop: 1300,
      xl: 1536,
      wide: 1600,
    },
  },
  components: {
    // ---- Stage 0 quality floor (redesign-stage-0, FRONTEND_EXECUTION_CONTRACT §3 items 2 + 4) ----
    // THE authored `:focus-visible` ring + the coarse-pointer touch-target floor, both defined ONCE
    // here at the theme layer so every component inherits them (no per-component bespoke rings).
    // Token-bound by construction. Ring color (redesign-stage-3 GATE Z B2 ruling): the mode's
    // TEXT-GRADE amber via `extrasFor(theme).textAmber` — dark ≡ gammaAmber ≡ primary.main
    // (byte-identical render), light = #8F5C0F, because light `primary.main` (amberDeep) measured
    // 2.76:1 on the raised light surface #ECECE7 (< the 3:1 ring floor); textAmber measures
    // 5.23 / 5.67 / 4.78 on paper / white / panelRaised — ≥3.0 on EVERY surface the ring can
    // land on (pinned in stage3-amber.spec.ts).
    MuiCssBaseline: {
      styleOverrides: (theme: Theme) => ({
        // Aligned figures on a data terminal are a feature: Plex Mono is tabular by construction,
        // and Plex Sans supports `tnum` — belt-and-braces global tabular numerals (stage-1 §4.3).
        html: { fontVariantNumeric: 'tabular-nums' },
        // The one authored focus ring — plain 2px amber outline + offset. `:focus-visible` (not
        // `:focus`) so mouse-click focus stays ringless while keyboard focus is always visible.
        '*:focus-visible': {
          outline: `2px solid ${extrasFor(theme).textAmber}`,
          outlineOffset: '2px',
        },
        // Matching treatment for MUI ButtonBase descendants (buttons, icon buttons, menu items,
        // toggle pills): ButtonBase resets `outline: 0` at (0,1,0), so this (0,2,0) selector pair
        // restores the SAME ring for both the native pseudo-class and MUI's focus-visible class.
        '.MuiButtonBase-root:focus-visible, .MuiButtonBase-root.Mui-focusVisible': {
          outline: `2px solid ${extrasFor(theme).textAmber}`,
          outlineOffset: '2px',
        },
        // Touch-target floor (≥44px effective hit area) on touch/coarse pointers only — desktop
        // density is unchanged. Inline (`display: inline`) prose links are structurally unaffected
        // (min-height/min-width don't apply to non-replaced inline boxes); buttons, icon buttons,
        // and block/inline-block CTAs grow to the floor.
        '@media (pointer: coarse)': {
          'button, [role="button"], a': {
            minHeight: 44,
            minWidth: 44,
          },
        },
      }),
    },
    // Buttons read in sentence case across the redesign, not MUI's default UPPERCASE.
    // (The former dark contained-primary override is DELETED with `buttonPrimaryBg`
    // — amber primary + explicit ink contrastText makes MUI's default contained treatment
    // correct in both modes; redesign-stage-1 §3.3-5.)
    // CONTROL role = 8px (SPEC §2.2, ruling 4). `shape.borderRadius` is the PANEL role (12) and
    // cannot also be the control role, so each control family binds 8 explicitly. `styleOverrides`
    // root objects are plain CSS-in-JS (not routed through the `sx` engine's `createUnaryUnit`), so
    // a bare `8` here is genuinely 8px, not a multiplier.
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' as const, borderRadius: 8 },
      },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiFilledInput: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiInputBase: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiToggleButton: { styleOverrides: { root: { borderRadius: 8 } } },
    // DIALOG role = 16px (SPEC §2.2, ruling 4) — the single declared dialog radius; component-local
    // paper `sx` overrides (Widget.tsx, AuthDialog.tsx) were de-duplicated onto this in the same
    // change so there is one dialog radius, not several drifting values.
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    // Links rebind to SIGNAL at the slot level (`info`) — amber is spent on brand/active
    // surfaces, not sprinkled across every anchor (redesign-stage-1 §1 self-critique 2).
    // Components that explicitly set a color still win (e.g. brand CTAs).
    MuiLink: {
      defaultProps: { color: 'info.main' } as const,
    },
    // HALF OF THE MODAL FOCUS HANDOFF — see `shared/a11y/modalFocusHandoff.ts` for the full trace.
    // MUI's FocusTrap restores focus to the trigger BEFORE ModalManager drops `aria-hidden` from the
    // app root, and `Dialog` sets `closeAfterTransition`, so that window lasts the whole exit fade:
    // Chrome blocks the aria-hidden and the focused control leaves the accessibility tree. Restoring
    // focus is therefore taken over by the `ModalManager` seam, which does it AFTER the attribute is
    // gone. Standing MUI's own restore down here is what makes that ordering the only one there is.
    // Applies to every Modal descendant — Dialog, Drawer, and Popover (so Menu/Select too).
    // NOT a focus REGRESSION: focus still returns to the trigger, and `modalFocusHandoff.spec.tsx`
    // asserts both halves — remove this and its autoFocus case fails.
    MuiModal: {
      defaultProps: { disableRestoreFocus: true } as const,
    },
    // Snackbars are OVERLAYS → the top of the elevation ladder: the lightest surface (panelRaised)
    // + an e4 shadow so the toast clearly floats above the page, instead of MUI's default inverted
    // (near-white) SnackbarContent. Mode-aware — themes are swapped at the provider.
    MuiSnackbarContent: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          backgroundColor: extrasFor(theme).panelRaised,
          color: theme.palette.text.primary,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: theme.shape.borderRadius,
          boxShadow: elevationFor(theme).e4,
        }),
      },
    },
    // v2 `scrim` (SPEC §2.1) — a scrim is only correct if EVERY overlay gets it, so it binds ONCE
    // at the theme layer rather than per-dialog. This is what lets `Widget.tsx`'s hardcoded
    // `rgba(0,0,0,0.6)` go (FE-6). Mode-aware via `extrasFor`.
    MuiBackdrop: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          backgroundColor: extrasFor(theme).scrim,
        }),
      },
    },
  },
} as const;

// Explicit dark-tuned MUI `shadows[]` derived from the elevation ladder (theme-audit gap:
// stock MUI shadows are light-tuned and vanish on ink). Slot 1 → e1-class, 2–7 → e2-class,
// 8+ → e4-class, so menus/popovers/dialogs visibly separate on `panel` (render-pass judged).
const darkShadows = [
  'none',
  elevation.dark.e1,
  ...Array(6).fill(elevation.dark.e2),
  ...Array(17).fill(elevation.dark.e4),
] as Theme['shadows'];

/** Dark, data-dense theme suited to a trading dashboard. The historical default + the anonymous
 *  baseline (AC-A3). Exported as `theme` for backward compatibility with existing imports/tests. */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { ...palette.dark.primary },
    secondary: { ...palette.dark.secondary },
    success: { main: palette.dark.success }, // positive gamma / calls (RESERVED)
    error: { main: palette.dark.error }, // negative gamma / puts (RESERVED)
    warning: { main: palette.dark.warning }, // true warnings only + icon ALWAYS
    info: { main: palette.dark.info }, // links / live status (signal)
    text: {
      primary: palette.dark.text.primary,
      secondary: palette.dark.text.secondary,
      disabled: palette.dark.text.disabled,
    },
    background: { default: palette.dark.background.default, paper: palette.dark.background.paper },
    divider: palette.dark.divider,
  },
  shadows: darkShadows,
  ...COMMON,
});

/** Light counterpart (added by user-accounts settings; theme is presentation-only, AC-F4). */
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { ...palette.light.primary },
    secondary: { ...palette.light.secondary },
    success: { main: palette.light.success },
    error: { main: palette.light.error },
    warning: { main: palette.light.warning },
    info: { main: palette.light.info },
    text: {
      primary: palette.light.text.primary,
      secondary: palette.light.text.secondary,
      disabled: palette.light.text.disabled,
    },
    background: {
      default: palette.light.background.default,
      paper: palette.light.background.paper,
    },
    divider: palette.light.divider,
  },
  ...COMMON,
});

/** Resolve the OS preference for `system` (best-effort; defaults to dark when unavailable). */
function prefersLight(): boolean {
  try {
    return window.matchMedia?.('(prefers-color-scheme: light)')?.matches;
  } catch {
    return false;
  }
}

/** Map a `ThemePref` to a concrete MUI theme. `system` follows the OS, defaulting to dark. */
export function themeForPref(pref: ThemePref): Theme {
  if (pref === 'light') return lightTheme;
  if (pref === 'system') return prefersLight() ? lightTheme : theme;
  return theme;
}
