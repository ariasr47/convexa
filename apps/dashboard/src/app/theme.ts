import { createTheme, type Theme } from '@mui/material/styles';
import type { ThemePref } from '@org/api';
import { palette, shape, typographyTokens } from './tokens';

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
    // Buttons read in sentence case across the redesign (Figma Button labels are sentence-case),
    // not MUI's default UPPERCASE. Presentation-only default; no behavior/score path change.
    MuiButton: { styleOverrides: { root: { textTransform: 'none' as const } } },
  },
} as const;

/** Dark, data-dense theme suited to a trading dashboard. The historical default + the anonymous
 *  baseline (AC-A3). Exported as `theme` for backward compatibility with existing imports/tests. */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: palette.dark.primary },
    success: { main: palette.dark.success }, // positive gamma / calls
    error: { main: palette.dark.error },     // negative gamma / puts
    warning: { main: palette.dark.warning },
    info: { main: palette.dark.info },
    text: { primary: palette.dark.text.primary, secondary: palette.dark.text.secondary, disabled: palette.dark.text.disabled },
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
    background: { default: palette.light.background.default, paper: palette.light.background.paper },
  },
  ...COMMON,
});

/** Resolve the OS preference for `system` (best-effort; defaults to dark when unavailable). */
function prefersLight(): boolean {
  try { return !!window.matchMedia?.('(prefers-color-scheme: light)')?.matches; }
  catch { return false; }
}

/** Map a `ThemePref` to a concrete MUI theme. `system` follows the OS, defaulting to dark. */
export function themeForPref(pref: ThemePref): Theme {
  if (pref === 'light') return lightTheme;
  if (pref === 'system') return prefersLight() ? lightTheme : theme;
  return theme;
}
