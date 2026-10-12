/**
 * settings.register.spec.tsx — curvature-v2-surfaces FE-8 (SPEC §3 D, §4.4; council D-D/D-B).
 * Criteria: 36 (SB), 40 (SB).
 *
 * Mocks ONLY the network boundary (`testBackend`), never a live backend — same idiom as
 * `auth.risk.spec.tsx` / `riskInputs.spec.tsx`.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from './AuthContext';
import { AuthDialogProvider } from './AuthDialogProvider';
import { AUTH_COPY } from './copy';
import { SettingsPage } from './SettingsPage';
import {
  installAuthBackend,
  uninstallAuthBackend,
  userSession,
  type AuthBackend,
} from './testBackend';
import { AppThemeProvider } from './ThemeProvider';

const C = AUTH_COPY.settings;

let backend: AuthBackend;

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  uninstallAuthBackend();
  localStorage.clear();
});

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

function mountSignedIn(settingsWrite?: 'ok' | 'auth_unavailable') {
  backend = installAuthBackend({
    session: userSession('u-1', 'trader@example.com', {
      active_persona_id: null,
      default_ticker: 'SPY',
      theme: 'dark',
    }),
    settingsWrite,
  });
  return render(
    <Mount>
      <SettingsPage />
    </Mount>,
  );
}

describe('criterion 36 (SB) — `not set` is never a pre-filled number', () => {
  it('both risk inputs show placeholder="not set", never "0"', async () => {
    mountSignedIn();
    const account = await screen.findByTestId('risk-inputs-account-size');
    const cap = screen.getByTestId('risk-inputs-cap-value');
    expect(account).toHaveAttribute('placeholder', 'not set');
    expect(cap).toHaveAttribute('placeholder', 'not set');
    // formatAmount(null) already yields '' — an unset field renders empty with the `not set`
    // placeholder doing the talking, never a bare `0`.
    expect(account).not.toHaveAttribute('placeholder', '0');
  });
});

describe('criterion 40 (SB) — a failed write is non-blocking, reverts the control, and shows NO confirmation', () => {
  it('a failed theme write: no settings-saved toast, the error alert renders, and the toggle never leaves the last-confirmed value', async () => {
    const user = userEvent.setup();
    mountSignedIn('auth_unavailable');
    await screen.findByTestId('settings-theme');
    await user.click(screen.getByTestId('settings-theme-light'));
    expect(await screen.findByTestId('settings-save-error')).toHaveTextContent(C.saveError);
    expect(screen.queryByTestId('settings-saved')).not.toBeInTheDocument();
    // Controlled reflection of settings.effective.theme, which a failed PUT never moves.
    expect(screen.getByTestId('settings-theme-dark')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('settings-theme-light')).toHaveAttribute('aria-pressed', 'false');
  });

  it('a failed ticker write reverts the draft to the last CONFIRMED value, never left showing the failed attempt', async () => {
    const user = userEvent.setup();
    mountSignedIn('auth_unavailable');
    const ticker = await screen.findByTestId('settings-ticker');
    expect(ticker).toHaveValue('SPY');
    await user.clear(ticker);
    await user.type(ticker, 'AAPL');
    await user.tab(); // blur → commitTicker
    await waitFor(() => expect(screen.getByTestId('settings-ticker')).toHaveValue('SPY'));
    expect(screen.queryByTestId('settings-saved')).not.toBeInTheDocument();
    expect(backend.calls.settingsPut).toBeGreaterThan(0); // the write was attempted, not skipped
  });
});
