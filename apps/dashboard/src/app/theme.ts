import { createTheme, type Theme } from '@mui/material/styles';
import type { ThemePref } from '@org/api';

const COMMON = {
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'Inter, system-ui, Segoe UI, Roboto, sans-serif',
    h1: { fontSize: '1.6rem', fontWeight: 700 },
  },
} as const;

/** Dark, data-dense theme suited to a trading dashboard. The historical default + the anonymous
 *  baseline (AC-A3). Exported as `theme` for backward compatibility with existing imports/tests. */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4f9cff' },
    success: { main: '#2ecc71' }, // positive gamma / calls
    error: { main: '#ff5c5c' },   // negative gamma / puts
    background: { default: '#0e1117', paper: '#161b22' },
  },
  ...COMMON,
});

/** Light counterpart (added by user-accounts settings; theme is presentation-only, AC-F4). */
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1d6fe0' },
    success: { main: '#1e9e57' },
    error: { main: '#d23b3b' },
    background: { default: '#f5f6f8', paper: '#ffffff' },
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
