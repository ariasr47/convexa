/**
 * Unit/integration — the settings precedence brain (D7, AC-F1/F2/F3/F4). Drives `useSettings` over the
 * real AuthProvider + the mock network boundary. Covers server-wins, anonymous-client-local, and
 * per-account isolation (the FE never overwrites the server value from local state).
 */
import { saveActiveId } from '@/features/personas/store';
import { demoStorageKey } from '@convexa/api';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from './AuthContext';
import {
  __resetLocalPrefs,
  loadLocalDefaultTicker,
  loadLocalTheme,
  saveLocalTheme,
  UIPREFS_KEY,
} from './localPrefs';
import {
  installAuthBackend,
  uninstallAuthBackend,
  userSession,
  type AuthBackend,
} from './testBackend';
import { useSettings } from './useSettings';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

let backend: AuthBackend;

beforeEach(() => {
  localStorage.clear();
  __resetLocalPrefs();
});
afterEach(() => {
  cleanup();
  uninstallAuthBackend();
  localStorage.clear();
  __resetLocalPrefs();
});

describe('useSettings — server-wins when signed in, per account (AC-F1/F2)', () => {
  it.each([
    {
      case: 'a client-local persona and theme',
      localTheme: 'light',
      userId: 'u-1',
      email: 'a@x.com',
      persona: 'steady_swinger',
      ticker: 'NVDA',
      theme: 'light',
    },
    {
      // Account X left a local pref; signing in as Y returns Y own value — X must not leak.
      case: "account X's leftover local persona (signed in as Y)",
      localTheme: null,
      userId: 'u-Y',
      email: 'y@x.com',
      persona: 'steady_swinger',
      ticker: 'MSFT',
      theme: 'dark',
    },
  ] as const)(
    'reflects the server value over $case and never writes the local value back',
    async ({ localTheme, userId, email, persona, ticker, theme }) => {
      saveActiveId('income_keeper'); // a leftover client-local value the server must override
      if (localTheme) saveLocalTheme(localTheme);
      backend = installAuthBackend({
        session: userSession(userId, email, {
          active_persona_id: persona,
          default_ticker: ticker,
          theme,
        }),
      });
      const { result } = renderHook(() => useSettings(), { wrapper });
      await waitFor(() => expect(result.current.serverBacked).toBe(true));
      expect(result.current.effective.personaId).toBe(persona); // server, not the local income_keeper
      expect(result.current.effective.defaultTicker).toBe(ticker);
      expect(result.current.effective.theme).toBe(theme);
      // The local income_keeper is NOT written back to the server.
      expect(backend.calls.settingsPut).toBe(0);
    },
  );

  it('writes a pref through to the server and carries the saved value (AC-F1)', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', {
        active_persona_id: null,
        default_ticker: null,
        theme: 'dark',
      }),
    });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.serverBacked).toBe(true));
    await act(async () => {
      await result.current.setTheme('light');
    });
    expect(backend.calls.settingsPut).toBe(1);
    await waitFor(() => expect(result.current.effective.theme).toBe('light'));
  });
});

describe('useSettings — anonymous uses client-local, no server pref (AC-F3/A3)', () => {
  it('keeps a historical theme-only preference and defaults the missing ticker', async () => {
    localStorage.setItem(
      demoStorageKey(UIPREFS_KEY),
      JSON.stringify({ schema_version: 1, theme: 'light' }),
    );
    backend = installAuthBackend(); // anonymous
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.effective.theme).toBe('light'));
    expect(result.current.effective.defaultTicker).toBe('SPY');
    expect(loadLocalDefaultTicker()).toBeNull();
    expect(backend.calls.settingsPut).toBe(0);
  });

  it('preserves malformed stored bytes and refuses to overwrite them', () => {
    const key = demoStorageKey(UIPREFS_KEY);
    const malformed = JSON.stringify({ schema_version: 2, theme: 'light' });
    localStorage.setItem(key, malformed);
    __resetLocalPrefs();

    expect(loadLocalTheme()).toBe('dark');
    saveLocalTheme('light');
    expect(localStorage.getItem(key)).toBe(malformed);
  });

  it('falls back to the client-local stores and never PUTs', async () => {
    saveActiveId('income_keeper');
    saveLocalTheme('light');
    backend = installAuthBackend(); // anonymous
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.effective).toBeTruthy());
    expect(result.current.serverBacked).toBe(false);
    expect(result.current.effective.personaId).toBe('income_keeper');
    expect(result.current.effective.theme).toBe('light');
    await act(async () => {
      await result.current.setTheme('system');
    });
    expect(backend.calls.settingsPut).toBe(0); // anonymous never hits the server
    await waitFor(() => expect(result.current.effective.theme).toBe('system'));
  });
});

describe('useSettings — save error reverts (UX_BLUEPRINT §2.9)', () => {
  it('surfaces a save error and keeps the last confirmed value', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', {
        active_persona_id: null,
        default_ticker: null,
        theme: 'dark',
      }),
      settingsWrite: 'auth_unavailable',
    });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.serverBacked).toBe(true));
    // curvature-v2-surfaces criterion 40 (SB): `writeServer` now RE-THROWS on failure (mirroring
    // `setRiskInputs`'s own idiom) so a caller — SettingsPage.tsx — can suppress its own success
    // confirmation. `settings.saveError` is a later render's state and cannot be read from the
    // caller's stale closure, so a silent (non-throwing) failure is unobservable to the caller.
    await act(async () => {
      await expect(result.current.setTheme('light')).rejects.toThrow('save_failed');
    });
    expect(result.current.saveError).toBe('save_failed');
    expect(result.current.effective.theme).toBe('dark'); // reverted (never optimistically mutated)
  });
});
