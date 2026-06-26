/**
 * Unit/integration — the settings precedence brain (D7, AC-F1/F2/F3/F4). Drives `useSettings` over the
 * real AuthProvider + the mock network boundary. Covers server-wins, anonymous-client-local, and
 * per-account isolation (the FE never overwrites the server value from local state).
 */
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { useSettings } from './useSettings';
import { installAuthBackend, uninstallAuthBackend, userSession, type AuthBackend } from './testBackend';
import { saveActiveId } from '../personas/store';
import { __resetLocalPrefs, saveLocalTheme } from './localPrefs';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

let backend: AuthBackend;

beforeEach(() => {
  localStorage.clear();
  __resetLocalPrefs();
});
afterEach(() => { cleanup(); uninstallAuthBackend(); localStorage.clear(); __resetLocalPrefs(); });

describe('useSettings — server-wins when signed in (AC-F1)', () => {
  it('reflects the server settings value over any client-local store', async () => {
    // A client-local persona/theme exist, but the signed-in server value must win.
    saveActiveId('income_keeper');
    saveLocalTheme('light');
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', { active_persona_id: 'steady_swinger', default_ticker: 'NVDA', theme: 'light' }),
    });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.serverBacked).toBe(true));
    expect(result.current.effective.personaId).toBe('steady_swinger'); // server, not the local income_keeper
    expect(result.current.effective.defaultTicker).toBe('NVDA');
    expect(result.current.effective.theme).toBe('light');
  });

  it('writes a pref through to the server and carries the saved value (AC-F1)', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', { active_persona_id: null, default_ticker: null, theme: 'dark' }),
    });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.serverBacked).toBe(true));
    await act(async () => { await result.current.setTheme('light'); });
    expect(backend.calls.settingsPut).toBe(1);
    await waitFor(() => expect(result.current.effective.theme).toBe('light'));
  });
});

describe('useSettings — anonymous uses client-local, no server pref (AC-F3/A3)', () => {
  it('falls back to the client-local stores and never PUTs', async () => {
    saveActiveId('income_keeper');
    saveLocalTheme('light');
    backend = installAuthBackend(); // anonymous
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.effective).toBeTruthy());
    expect(result.current.serverBacked).toBe(false);
    expect(result.current.effective.personaId).toBe('income_keeper');
    expect(result.current.effective.theme).toBe('light');
    await act(async () => { await result.current.setTheme('system'); });
    expect(backend.calls.settingsPut).toBe(0); // anonymous never hits the server
    await waitFor(() => expect(result.current.effective.theme).toBe('system'));
  });
});

describe('useSettings — per-account isolation (AC-F2)', () => {
  it('shows account Y own value, never account X (FE does not overwrite server from local)', async () => {
    // Account X had a local pref; signing in as Y returns Y own (default) value — X must not leak.
    saveActiveId('income_keeper'); // a leftover local value from a prior anonymous session
    backend = installAuthBackend({
      session: userSession('u-Y', 'y@x.com', { active_persona_id: 'steady_swinger', default_ticker: 'MSFT', theme: 'dark' }),
    });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.serverBacked).toBe(true));
    expect(result.current.effective.personaId).toBe('steady_swinger'); // Y server value
    expect(result.current.effective.defaultTicker).toBe('MSFT');
    // The local income_keeper is NOT applied and is NOT written back to the server.
    expect(backend.calls.settingsPut).toBe(0);
  });
});

describe('useSettings — save error reverts (UX_BLUEPRINT §2.9)', () => {
  it('surfaces a save error and keeps the last confirmed value', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', { active_persona_id: null, default_ticker: null, theme: 'dark' }),
      settingsWrite: 'auth_unavailable',
    });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.serverBacked).toBe(true));
    await act(async () => { await result.current.setTheme('light'); });
    expect(result.current.saveError).toBe('save_failed');
    expect(result.current.effective.theme).toBe('dark'); // reverted (never optimistically mutated)
  });
});
