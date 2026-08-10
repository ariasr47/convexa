/**
 * Stage 0 item 6 — `<meta name="theme-color">` follows the ACTIVE resolved mode (redesign-stage-0
 * FRONTEND_EXECUTION_CONTRACT §8.5; convexa-design skill rule 10 — "it stays dark in light mode
 * today" was the documented failure).
 *
 * The contract: on every resolved mode change (INCLUDING the `system` pref resolving), the meta's
 * `content` equals the LIVE theme object's `palette.background.default` — token-bound by
 * construction, never a literal. Anonymous path (client-local prefs) drives the resolution here;
 * the pref → theme mapping itself is `themeForPref`'s existing contract.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { theme as darkTheme, lightTheme } from '@/shared/theme/theme';
import { AuthProvider } from './AuthContext';
import { __resetLocalPrefs, saveLocalTheme } from './localPrefs';
import { AppThemeProvider } from './ThemeProvider';

function metaContent(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

beforeEach(() => {
  localStorage.clear();
  __resetLocalPrefs();
  document.querySelector('meta[name="theme-color"]')?.remove();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return new Response(
          JSON.stringify({
            authenticated: false,
            user: null,
            google_available: false,
            settings: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount() {
  return render(
    <AuthProvider>
      <AppThemeProvider>
        <span data-testid="probe" />
      </AppThemeProvider>
    </AuthProvider>,
  );
}

describe('<meta name="theme-color"> follows the resolved mode', () => {
  it('dark pref → the DARK theme background token (never a literal drifting from the theme)', async () => {
    saveLocalTheme('dark');
    mount();
    await waitFor(() => expect(metaContent()).toBe(darkTheme.palette.background.default));
  });

  it('switching to light → the LIGHT theme background token', async () => {
    saveLocalTheme('dark');
    const first = mount();
    await waitFor(() => expect(metaContent()).toBe(darkTheme.palette.background.default));
    first.unmount();

    __resetLocalPrefs();
    saveLocalTheme('light');
    mount();
    await waitFor(() => expect(metaContent()).toBe(lightTheme.palette.background.default));
  });

  it('`system` pref RESOLVING to light writes the light background (the resolution path is covered)', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({
        matches: q.includes('prefers-color-scheme: light'),
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        onchange: null,
        dispatchEvent: () => false,
      })),
    );
    saveLocalTheme('system');
    mount();
    await waitFor(() => expect(metaContent()).toBe(lightTheme.palette.background.default));
  });
});
