/**
 * AppThemeProvider — applies the EFFECTIVE theme pref (server-wins when signed in, client-local when
 * anonymous; UX_BLUEPRINT §2.9). Mount INSIDE AuthProvider (it consumes useSettings → useAuth). The
 * theme is presentation-only and NEVER touches the bundle/score path (AC-F4).
 *
 * Anonymous + never-touched ⇒ resolves to `dark` (today's behavior, AC-A3): zero regression.
 */
import type { ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { themeForPref } from '../theme';
import { useSettings } from './useSettings';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { effective } = useSettings();
  return (
    <ThemeProvider theme={themeForPref(effective.theme)}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
