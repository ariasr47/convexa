import { createTheme, darken, type Theme } from '@mui/material/styles';
import type { ThemePref } from '@org/api';
import { elevationFor, extras, extrasFor, palette, shape, typographyTokens } from '@/shared/theme/tokens';

const COMMON = {
  // Emit MUI CSS theme variables (`--mui-palette-*`, …) so the Figma design system's variable
  // code-syntax maps 1:1 to the real CSS custom properties the app ships (owner-directed). The
  // palette/shape/type values are single-sourced from `tokens.ts` (kept in sync with the Figma
  // variables via `scripts/sync-figma-tokens.mjs`). Presentation-only: no bundle/score path change.
  cssVariables: true,
  shape,
  typography: {
    fontFamily: typographyTokens.fontFamily,
    h1: { fontSize: '1.6rem', fontWeight: 700 },
    // Section/card titles — the Figma DS "Type/Section" idiom (Inter Semi Bold 16), not MUI's 20/500.
    h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.25 },
  },
  components: {
    // ---- Stage 0 quality floor (redesign-stage-0, FRONTEND_EXECUTION_CONTRACT §3 items 2 + 4) ----
    // THE authored `:focus-visible` ring + the coarse-pointer touch-target floor, both defined ONCE
    // here at the theme layer so every component inherits them (no per-component bespoke rings).
    // Token-bound by construction: the ring color reads the live theme's `primary.main`, so it is
    // mode-aware (dark + light) with zero literals.
    MuiCssBaseline: {
      styleOverrides: (theme: Theme) => ({
        // The one authored focus ring — plain 2px primary outline + offset. `:focus-visible` (not
        // `:focus`) so mouse-click focus stays ringless while keyboard focus is always visible.
        '*:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '2px',
        },
        // Matching treatment for MUI ButtonBase descendants (buttons, icon buttons, menu items,
        // toggle pills): ButtonBase resets `outline: 0` at (0,1,0), so this (0,2,0) selector pair
        // restores the SAME ring for both the native pseudo-class and MUI's focus-visible class.
        '.MuiButtonBase-root:focus-visible, .MuiButtonBase-root.Mui-focusVisible': {
          outline: `2px solid ${theme.palette.primary.main}`,
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
    // Buttons read in sentence case across the redesign (Figma Button labels are sentence-case),
    // not MUI's default UPPERCASE. Presentation-only default; no behavior/score path change.
    MuiButton: {
      styleOverrides: {
        // Filled primary buttons only: dark mode's bright `#4f9cff` primary would auto-pick black
        // text (washed look). Use the deep brand blue + white for white-legible contrast. Light mode
        // (primary is already `#1d6fe0` + auto-white) keeps the theme default. Targeted via `ownerState`
        // on `root` because MUI (v6+) dropped the combined `containedPrimary` styleOverrides slot —
        // variant + color are now separate classes, so that slot never applied.
        root: ({
          ownerState,
          theme,
        }: {
          ownerState: { variant?: string; color?: string };
          theme: Theme;
        }) => ({
          textTransform: 'none' as const,
          ...(ownerState.variant === 'contained' &&
          ownerState.color === 'primary' &&
          theme.palette.mode === 'dark'
            ? {
                backgroundColor: extras.buttonPrimaryBg,
                color: '#fff',
                '&:hover': { backgroundColor: darken(extras.buttonPrimaryBg, 0.12) },
              }
            : {}),
        }),
      },
    },
    // Snackbars are OVERLAYS → the top of the elevation ladder: the lightest surface (panelRaised)
    // + an e4 shadow so the toast clearly floats above the page, instead of MUI's default inverted
    // (near-white) SnackbarContent. Mode-aware — themes are swapped at the provider. See
    // docs/THEME_AUDIT.md gaps #4 (elevation) + #10 (snackbar).
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
  },
} as const;

/** Dark, data-dense theme suited to a trading dashboard. The historical default + the anonymous
 *  baseline (AC-A3). Exported as `theme` for backward compatibility with existing imports/tests. */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: palette.dark.primary },
    success: { main: palette.dark.success }, // positive gamma / calls
    error: { main: palette.dark.error }, // negative gamma / puts
    warning: { main: palette.dark.warning },
    info: { main: palette.dark.info },
    text: {
      primary: palette.dark.text.primary,
      secondary: palette.dark.text.secondary,
      disabled: palette.dark.text.disabled,
    },
    background: { default: palette.dark.background.default, paper: palette.dark.background.paper },
  },
  ...COMMON,
});

/** Light counterpart (added by user-accounts settings; theme is presentation-only, AC-F4). */
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: palette.light.primary },
    success: { main: palette.light.success },
    error: { main: palette.light.error },
    warning: { main: palette.light.warning },
    info: { main: palette.light.info },
    text: { secondary: palette.light.text.secondary, disabled: palette.light.text.disabled },
    background: {
      default: palette.light.background.default,
      paper: palette.light.background.paper,
    },
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
