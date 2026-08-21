/**
 * AppThemeProvider — applies the EFFECTIVE theme pref (server-wins when signed in, client-local when
 * anonymous; UX_BLUEPRINT §2.9). Mount INSIDE AuthProvider (it consumes useSettings → useAuth). The
 * theme is presentation-only and NEVER touches the bundle/score path (AC-F4).
 *
 * Anonymous + never-touched ⇒ resolves to `dark` (today's behavior, AC-A3): zero regression.
 */
import { themeForPref } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useEffect, type ReactNode } from 'react';
import { applyPaintMode } from './firstPaintTheme';
import { useSettings } from './useSettings';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { effective } = useSettings();
  const resolved = themeForPref(effective.theme);

  // First-paint `data-theme` + `<meta name="theme-color">` follow the ACTIVE resolved mode
  // (redesign-stage-0 §3 item 6). Token-bound by construction — `background.default`, no literal.
  // `index.html` keeps a static dark meta for no-JS; the blocking script + this effect close the
  // light-pref flash. Paint cache is last resolved mode, not a settings write (AC-F2).
  useEffect(() => {
    applyPaintMode(
      document,
      resolved.palette.mode === 'light' ? 'light' : 'dark',
      resolved.palette.background.default,
    );
  }, [resolved]);

  return (
    <ThemeProvider theme={resolved}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
