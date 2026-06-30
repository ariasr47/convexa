/**
 * Component/integration — the Settings UI (3 light prefs; UX_BLUEPRINT §2.9, AC-F1/F2/F3/F4). Mounts
 * the REAL SettingsPage under the auth providers, mocking ONLY the network boundary.
 *
 * Traceability: T-A3 (anonymous client-local), T-F1 (server-wins write), T-F2 (per-account isolation),
 * T-F3 (anonymous prefs), plus the save-error revert + the theme provider applying the pref.
 */
import { render, screen, within, waitFor, cleanup } from '@testing-library/react';
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

/** The Theme segmented control is a `ToggleButtonGroup` (convexa-redesign re-skin); a selected option
 *  carries aria-pressed="true". This replaces the old `Select`/`option` interaction. */
function themeButton(pref: 'dark' | 'light' | 'system') {
  return screen.getByTestId(`settings-theme-${pref}`);
}

describe('Settings — signed in, server-wins (AC-F1)', () => {
  it('T-F1: pre-sets controls to the server value, then a change writes through to the server', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', { active_persona_id: null, default_ticker: 'NVDA', theme: 'light' }),
    });
    const user = userEvent.setup();
    render(<Mount><SettingsPage /></Mount>);
    // Server value shown (the segmented control reflects 'light' as the pressed segment).
    await waitFor(() => expect(screen.getByTestId('settings-ticker')).toHaveValue('NVDA'));
    expect(themeButton('light')).toHaveAttribute('aria-pressed', 'true');
    // Change the theme ⇒ a PUT is issued (server-wins becomes the carried value).
    await user.click(themeButton('dark'));
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
    // The segmented control reflects Y server 'dark', not the leftover local 'light'; no PUT mirroring.
    expect(themeButton('dark')).toHaveAttribute('aria-pressed', 'true');
    expect(themeButton('light')).toHaveAttribute('aria-pressed', 'false');
    expect(backend.calls.settingsPut).toBe(0);
  });
});

describe('Settings — anonymous client-local (AC-F3/A3)', () => {
  it('T-F3: anonymous changes go to the client-local store, never the server', async () => {
    backend = installAuthBackend(); // anonymous
    const user = userEvent.setup();
    render(<Mount><SettingsPage /></Mount>);
    // Anonymous: the Account panel shows the sign-in prompt (not a signed-in profile).
    await waitFor(() => expect(screen.getByTestId('settings-account-signed-out')).toBeInTheDocument());

    await user.click(themeButton('light'));
    // No server write for an anonymous user.
    expect(backend.calls.settingsPut).toBe(0);
    // The change persisted client-local (the segmented control reflects it).
    await waitFor(() => expect(themeButton('light')).toHaveAttribute('aria-pressed', 'true'));
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
    await waitFor(() => expect(themeButton('dark')).toHaveAttribute('aria-pressed', 'true'));

    await user.click(themeButton('light'));
    expect(await screen.findByTestId('settings-save-error')).toHaveTextContent(AUTH_COPY.settings.saveError);
    // The theme reverts to the server-confirmed dark (never optimistically applied).
    await waitFor(() => expect(themeButton('dark')).toHaveAttribute('aria-pressed', 'true'));
    expect(themeButton('light')).toHaveAttribute('aria-pressed', 'false');
  });
});

// =================================================================================================
// convexa-redesign: the re-skinned page layout (Figma 4:2572) — Account panel + Preferences + footer
// =================================================================================================
describe('Settings — page layout / heading + footer disclaimer', () => {
  it('renders the heading, subtitle, the three panels, and the Landing disclaimer caption', async () => {
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    render(<Mount><SettingsPage /></Mount>);
    await screen.findByTestId('settings-account-panel');
    expect(screen.getByText(AUTH_COPY.settings.title)).toBeInTheDocument();
    expect(screen.getByText(AUTH_COPY.settings.subtitle)).toBeInTheDocument();
    expect(screen.getByTestId('settings-ai-key-panel')).toBeInTheDocument();
    expect(screen.getByTestId('settings-preferences-panel')).toBeInTheDocument();
    // The footer reuses the Landing disclaimer (verbatim, paper-only honesty floor).
    expect(screen.getByTestId('settings-disclaimer')).toHaveTextContent(
      'Convexa is an analysis tool. All positions and trades shown are simulated (paper). ' +
        'Not investment advice. No brokerage connection.',
    );
  });
});

describe('Settings — Account panel (logout now lives here)', () => {
  it('signed-in: shows the gradient avatar + display name/email + a Sign out button that logs out', async () => {
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    const user = userEvent.setup();
    render(<Mount><SettingsPage /></Mount>);

    const panel = await screen.findByTestId('settings-account-signed-in');
    // No display_name ⇒ the email serves as both the name line and the secondary email line.
    expect(within(panel).getAllByText('a@x.com').length).toBeGreaterThanOrEqual(1);
    const signout = screen.getByTestId('settings-signout');
    expect(signout).toHaveTextContent(AUTH_COPY.settings.signOut);

    // Clicking Sign out drives auth.signOut() → who-am-I reports anonymous → the prompt panel shows.
    await user.click(signout);
    await waitFor(() => expect(screen.getByTestId('settings-account-signed-out')).toBeInTheDocument());
    expect(backend.state.session.authenticated).toBe(false);
  });

  it('signed-out: shows the sync prompt + a Sign in button that opens the auth dialog (login mode)', async () => {
    backend = installAuthBackend(); // anonymous
    const user = userEvent.setup();
    render(<Mount><SettingsPage /></Mount>);

    const panel = await screen.findByTestId('settings-account-signed-out');
    expect(within(panel).getByText(AUTH_COPY.settings.accountSignedOutPrompt)).toBeInTheDocument();
    await user.click(screen.getByTestId('settings-signin'));
    // The shared auth dialog opens in login mode (its submit affordance appears).
    expect(await screen.findByTestId('auth-submit')).toBeInTheDocument();
  });
});

describe('Settings — Preferences panel controls', () => {
  it('persona select, default-ticker input, and the theme segmented control all render + are wired', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', { active_persona_id: null, default_ticker: 'AAPL', theme: 'system' }),
    });
    const user = userEvent.setup();
    render(<Mount><SettingsPage /></Mount>);

    // Default-ticker input pre-set to the server value.
    await waitFor(() => expect(screen.getByTestId('settings-ticker')).toHaveValue('AAPL'));
    // Persona select present.
    expect(screen.getByTestId('settings-persona')).toBeInTheDocument();
    // Theme segmented control: the server 'system' is the pressed segment.
    expect(themeButton('system')).toHaveAttribute('aria-pressed', 'true');

    // Editing the ticker writes through to the server (server-wins).
    const ticker = screen.getByTestId('settings-ticker');
    await user.clear(ticker);
    await user.type(ticker, 'msft');
    await user.tab(); // blur commits
    await waitFor(() => expect(backend.calls.settingsPut).toBeGreaterThanOrEqual(1));
  });
});
