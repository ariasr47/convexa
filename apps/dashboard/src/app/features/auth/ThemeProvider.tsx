/**
 * AppThemeProvider — applies the EFFECTIVE theme pref (server-wins when signed in, client-local when
 * anonymous; UX_BLUEPRINT §2.9). Mount INSIDE AuthProvider (it consumes useSettings → useAuth). The
 * theme is presentation-only and NEVER touches the bundle/score path (AC-F4).
 *
 * Anonymous + never-touched ⇒ resolves to `dark` (today's behavior, AC-A3): zero regression.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useEffect, type ReactNode } from 'react';
import { themeForPref } from '@/shared/theme/theme';
import { useSettings } from './useSettings';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { effective } = useSettings();
  const resolved = themeForPref(effective.theme);

  // `<meta name="theme-color">` follows the ACTIVE resolved mode (redesign-stage-0 §3 item 6): on
  // every resolved theme change (incl. the `system` pref resolving) write the live theme object's
  // `background.default` — token-bound by construction, no literal anywhere. `index.html` keeps its
  // static dark content only for the pre-React first paint.
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', resolved.palette.background.default);
  }, [resolved]);

  return (
    <ThemeProvider theme={resolved}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
