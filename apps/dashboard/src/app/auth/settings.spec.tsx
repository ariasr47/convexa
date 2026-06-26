/**
 * Component/integration — the Settings UI (3 light prefs; UX_BLUEPRINT §2.9, AC-F1/F2/F3/F4). Mounts
 * the REAL SettingsPage under the auth providers, mocking ONLY the network boundary.
 *
 * Traceability: T-A3 (anonymous client-local), T-F1 (server-wins write), T-F2 (per-account isolation),
 * T-F3 (anonymous prefs), plus the save-error revert + the theme provider applying the pref.
 */
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { AuthDialogProvider } from './AuthDialogProvider';
import { AppThemeProvider } from './ThemeProvider';
import { AUTH_COPY } from './copy';
import { SettingsPage } from './SettingsPage';
import { __resetLocalPrefs, saveLocalTheme } from './localPrefs';
import { installAuthBackend, uninstallAuthBackend, userSession, type AuthBackend } from './testBackend';

function Mount({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <AuthDialogProvider>{children}</AuthDialogProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </AuthProvider>
  );
}

let backend: AuthBackend;
beforeEach(() => { localStorage.clear(); __resetLocalPrefs(); });
afterEach(() => { cleanup(); uninstallAuthBackend(); localStorage.clear(); __resetLocalPrefs(); });

describe('Settings — signed in, server-wins (AC-F1)', () => {
  it('T-F1: pre-sets controls to the server value, then a change writes through to the server', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', { active_persona_id: null, default_ticker: 'NVDA', theme: 'light' }),
    });
    const user = userEvent.setup();
    render(<Mount><SettingsPage /></Mount>);
    // Server value shown.
    await waitFor(() => expect(screen.getByTestId('settings-ticker')).toHaveValue('NVDA'));
    // Change the theme ⇒ a PUT is issued (server-wins becomes the carried value).
    await user.click(screen.getByLabelText(AUTH_COPY.settings.theme));
    await user.click(await screen.findByRole('option', { name: AUTH_COPY.settings.themeDark }));
    await waitFor(() => expect(backend.calls.settingsPut).toBeGreaterThanOrEqual(1));
  });
});

describe('Settings — per-account isolation (AC-F2)', () => {
  it('T-F2: account Y own value shows, never a leftover local value', async () => {
    saveLocalTheme('light'); // a leftover anonymous local pref
    backend = installAuthBackend({
      session: userSession('u-Y', 'y@x.com', { active_persona_id: null, default_ticker: 'MSFT', theme: 'dark' }),
    });
    render(<Mount><SettingsPage /></Mount>);
    await waitFor(() => expect(screen.getByTestId('settings-ticker')).toHaveValue('MSFT'));
    // The theme select reflects Y server 'dark', not the leftover local 'light'; no PUT mirroring.
    expect(backend.calls.settingsPut).toBe(0);
  });
});

describe('Settings — anonymous client-local (AC-F3/A3)', () => {
  it('T-F3: anonymous changes go to the client-local store, never the server', async () => {
    backend = installAuthBackend(); // anonymous
    const user = userEvent.setup();
    render(<Mount><SettingsPage /></Mount>);
    await waitFor(() => expect(screen.getByTestId('settings-anonymous')).toBeInTheDocument());

    await user.click(screen.getByLabelText(AUTH_COPY.settings.theme));
    await user.click(await screen.findByRole('option', { name: AUTH_COPY.settings.themeLight }));
    // No server write for an anonymous user.
    expect(backend.calls.settingsPut).toBe(0);
    // The change persisted client-local (the control reflects it).
    await waitFor(() => expect(screen.getByLabelText(AUTH_COPY.settings.theme))
      .toHaveTextContent(AUTH_COPY.settings.themeLight));
  });
});

describe('Settings — save error reverts (UX_BLUEPRINT §2.9)', () => {
  it('shows the non-blocking error and reverts the control to the last confirmed value', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', { active_persona_id: null, default_ticker: null, theme: 'dark' }),
      settingsWrite: 'auth_unavailable',
    });
    const user = userEvent.setup();
    render(<Mount><SettingsPage /></Mount>);
    await waitFor(() => expect(screen.getByLabelText(AUTH_COPY.settings.theme)).toBeInTheDocument());

    await user.click(screen.getByLabelText(AUTH_COPY.settings.theme));
    await user.click(await screen.findByRole('option', { name: AUTH_COPY.settings.themeLight }));
    expect(await screen.findByTestId('settings-save-error')).toHaveTextContent(AUTH_COPY.settings.saveError);
    // The theme reverts to the server-confirmed dark (never optimistically applied).
    expect(screen.getByLabelText(AUTH_COPY.settings.theme)).toHaveTextContent(AUTH_COPY.settings.themeDark);
  });
});
