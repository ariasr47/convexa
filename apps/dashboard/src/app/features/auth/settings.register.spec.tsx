/**
 * settings.register.spec.tsx — curvature-v2-surfaces FE-8 (SPEC §3 D, §4.4; council D-D/D-B).
 * Criteria: 36 (SB), 39 (SB), 40 (SB), 41 (SB), 42 (SB), U-19, U-35 (settings half).
 *
 * Mocks ONLY the network boundary (`testBackend`), never a live backend — same idiom as
 * `auth.risk.spec.tsx` / `riskInputs.spec.tsx`.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// A raw-source scan, same idiom as `shared/theme/radius-scale.spec.ts` / `fonts.spec.ts` — mutation
// tested below rather than trusted on the strength of the render assertions alone.
const AUTH_SOURCES = import.meta.glob(['/src/app/features/auth/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function sourceOf(file: string): string {
  const entry = Object.entries(AUTH_SOURCES).find(([k]) => k.endsWith(`/${file}`));
  if (!entry) throw new Error(`${file} missing from the features/auth source scan`);
  return entry[1];
}

describe('criterion 36 (SB) — a user-entered number renders Mono/traced, and `not set` is never a pre-filled number', () => {
  it('both risk inputs emit data-figure-register="mono" and placeholder="not set", never "0"', async () => {
    mountSignedIn();
    const account = await screen.findByTestId('risk-inputs-account-size');
    const cap = screen.getByTestId('risk-inputs-cap-value');
    expect(account).toHaveAttribute('data-figure-register', 'mono');
    expect(account).toHaveAttribute('placeholder', 'not set');
    expect(cap).toHaveAttribute('data-figure-register', 'mono');
    expect(cap).toHaveAttribute('placeholder', 'not set');
    // formatAmount(null) already yields '' — an unset field renders empty with the `not set`
    // placeholder doing the talking, never a bare `0`.
    expect(account).not.toHaveAttribute('placeholder', '0');
  });

  it('MUTATION GUARD — RiskInputsSection.tsx binds the face from shared/figure, never a local `MONO` constant (the source this scan reads is REAL, not a fixture)', () => {
    const src = sourceOf('RiskInputsSection.tsx');
    expect(src).not.toMatch(/const MONO\s*=/);
    expect(src).toMatch(/faceFor\(true\)/);
    expect(src).toMatch(/from '@\/shared\/figure'/);
  });
});

describe('criterion 39 (SB) — signed out states browser-only persistence; the canvas account footnote never renders', () => {
  it('renders "Stored in this browser." and the "Saved to your account." string is absent from the DOM', async () => {
    backend = installAuthBackend();
    render(
      <Mount>
        <SettingsPage />
      </Mount>,
    );
    await screen.findByTestId('settings-account-signed-out');
    expect(screen.getByText(C.subtitleAnonymous)).toBeInTheDocument();
    expect(screen.queryByText(C.subtitleSignedIn)).not.toBeInTheDocument();
  });

  it('MUTATION GUARD — the canvas footnote string never appears as a literal anywhere in SettingsPage.tsx', () => {
    const src = sourceOf('SettingsPage.tsx');
    expect(src).not.toMatch(/Saved to your account\./);
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

describe('criterion 41 (SB) — the confirmation is neutral chrome; the error alert keeps severity="error" and its icon', () => {
  it('a successful write shows severity="info" carrying the shipped word "Saved", never "success"', async () => {
    const user = userEvent.setup();
    mountSignedIn('ok');
    await screen.findByTestId('settings-theme');
    await user.click(screen.getByTestId('settings-theme-light'));
    const toast = await screen.findByTestId('settings-saved');
    expect(toast).toHaveTextContent(C.saved);
    expect(toast.className).toMatch(/colorInfo|MuiAlert-standardInfo/);
    expect(toast.className).not.toMatch(/colorSuccess|MuiAlert-standardSuccess/);
  });

  it('the risk-inputs confirmation is also neutral chrome (severity="info")', async () => {
    const user = userEvent.setup();
    mountSignedIn('ok');
    await screen.findByTestId('risk-inputs-form');
    await user.clear(screen.getByTestId('risk-inputs-account-size'));
    await user.type(screen.getByTestId('risk-inputs-account-size'), '10000');
    await user.click(screen.getByTestId('risk-inputs-save'));
    const toast = await screen.findByTestId('risk-inputs-saved');
    expect(toast.className).toMatch(/colorInfo|MuiAlert-standardInfo/);
    expect(toast.className).not.toMatch(/colorSuccess|MuiAlert-standardSuccess/);
  });

  it('the AI-key and Brokerage confirmations on the SAME settings page are also neutral chrome — one page, one confirmation-palette rule', async () => {
    mountSignedIn('ok');
    await screen.findByTestId('settings-ai-key-panel');
    expect(sourceOf('AiKeySection.tsx')).not.toMatch(/severity="success"/);
    expect(sourceOf('BrokerageSection.tsx')).not.toMatch(/severity="success"/);
  });

  it('the save-error alert is untouched: severity="error" with its icon rendered', async () => {
    const user = userEvent.setup();
    mountSignedIn('auth_unavailable');
    await screen.findByTestId('settings-theme');
    await user.click(screen.getByTestId('settings-theme-light'));
    const alert = await screen.findByTestId('settings-save-error');
    expect(alert.className).toMatch(/colorError|MuiAlert-standardError/);
    expect(alert.querySelector('.MuiAlert-icon')).not.toBeNull();
  });

  it('MUTATION GUARD — no `severity="success"` remains anywhere in the four owned/adjacent settings files', () => {
    for (const file of [
      'SettingsPage.tsx',
      'RiskInputsSection.tsx',
      'AiKeySection.tsx',
      'BrokerageSection.tsx',
    ]) {
      expect(sourceOf(file), `${file} still carries severity="success"`).not.toMatch(
        /severity="success"/,
      );
    }
  });
});

describe('criterion 42 (SB) — nothing on settings carries a live mark or a pulse', () => {
  it('zero figure-live-dot nodes and zero pulse/live-keyframe classes anywhere on the page', async () => {
    mountSignedIn();
    const page = await screen.findByTestId('settings-page');
    expect(page.querySelectorAll('[data-testid="figure-live-dot"]').length).toBe(0);
    expect(page.querySelectorAll('[class*="livePulse" i]').length).toBe(0);
  });
});

describe('U-19 — one line while the session is still resolving, removed the instant it resolves', () => {
  it('renders the resolving line while auth.ready is false, and it is gone once who-am-I resolves', async () => {
    let resolveSession: (v: Response) => void = () => {
      /* replaced below before use */
    };
    const sessionPromise = new Promise<Response>((resolve) => {
      resolveSession = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/auth/session')) return sessionPromise;
        return Promise.resolve(new Response('{}', { status: 200 }));
      }),
    );

    render(
      <Mount>
        <SettingsPage />
      </Mount>,
    );

    expect(await screen.findByTestId('settings-session-resolving')).toHaveTextContent(
      C.sessionResolving,
    );
    // The controls it freezes are still present (never silently frozen with no explanation).
    expect(screen.getByTestId('settings-theme')).toBeInTheDocument();

    resolveSession(
      new Response(
        JSON.stringify({
          authenticated: false,
          user: null,
          google_available: false,
          settings: null,
        }),
        { status: 200 },
      ),
    );

    await waitFor(() =>
      expect(screen.queryByTestId('settings-session-resolving')).not.toBeInTheDocument(),
    );
  });
});

describe('U-35 (settings half) — the panel radius is the declared `1` (12px), never the old 2.5 (30px)', () => {
  it('SettingsPage.tsx no longer carries `borderRadius: 2.5` and declares `borderRadius: 1` on the panel card', () => {
    const src = sourceOf('SettingsPage.tsx');
    expect(src).not.toMatch(/borderRadius:\s*2\.5/);
    expect(src).toMatch(/borderRadius:\s*1\s*,/);
  });

  it('MUTATION GUARD — the regex actually distinguishes 2.5 from 1 (fixture proof, not a real source)', () => {
    const before = `borderRadius: 2.5,`;
    const after = `borderRadius: 1,`;
    expect(before).not.toMatch(/borderRadius:\s*1\s*,/);
    expect(after).not.toMatch(/borderRadius:\s*2\.5/);
    expect(after).toMatch(/borderRadius:\s*1\s*,/);
  });
});
