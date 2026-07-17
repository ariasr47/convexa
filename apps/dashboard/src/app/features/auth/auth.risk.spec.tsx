/**
 * Auth feature — RISK-BASED suite (per the amended QA rule, `.claude/agents/qa-verify.md` §4,
 * 2026-07-13). Consolidates the former per-AC mirrors (`auth.flow`, `auth-invariants`, `auth-entry`,
 * `gated-positions`, `gated-ai-rec`, `google-control`, `settings` specs) down to the invariants where
 * a silent regression is plausible AND invisible to a human reviewer:
 *
 *   1. DEGRADE-TO-ANONYMOUS (the most important test here) — a failed who-am-I NEVER blocks the
 *      trader path: the app renders anonymous, the bundle fetch and the SSE subscribe both proceed.
 *      By construction: the mock's auth endpoint 503s while every other endpoint stays reachable.
 *   2. SERVER GATE BEFORE ANY LOCAL WRITE (`server-side-gate-enforcement`, the FE half — promoted
 *      after the real AC-E7 bug where the gate was FE-only): a gated Positions write awaits
 *      `POST /api/positions/sim-trade/gate` BEFORE the client-local store mutation. ORDER is probed
 *      (the store length is sampled AT the moment the gate endpoint is hit). 403 ⇒ the write NEVER
 *      happens (store asserted untouched, prompt shown); 503 ⇒ same abort; 200 ⇒ the write proceeds.
 *      Logged out, the FE gate short-circuits: prompt, no server call, no write.
 *   3. SESSION LIFECYCLE — signup → signed-in → persists across a remount → logout → anonymous, and
 *      gated actions RE-GATE after logout. (Stale/expired-cookie ⇒ anonymous is observationally the
 *      anonymous-resolve start of this flow: the server answers anonymous, the app renders anonymous,
 *      no crash / no redirect loop — folded in here, and the server-caught variant is the 403 in §2.)
 *   4. NON-ENUMERATING 401 — unknown-email and wrong-password produce the IDENTICAL observable
 *      failure state (the two DOM error states are compared to each other, not to their wording).
 *   5. NEVER-ECHO FLOOR — the typed password never re-enters the DOM outside its input, and never
 *      rides ANY request URL (every URL the mock ever received is scanned — by construction).
 *   6. SERVER-WINS SETTINGS, NO BLEED — signed-in prefs come from the server (a leftover local pref
 *      is neither applied nor written back), anonymous falls back client-local, and switching the
 *      account switches the effective settings with zero residue (settings PUT stays at 0 throughout).
 *   7. GOOGLE PRESENT-BUT-DISABLED-WHEN-UNCONFIGURED — `google_available:false` ⇒ the control renders
 *      disabled and a click initiates NOTHING (no navigation, no fetch); the config-only flip
 *      false→true enables it with no rebuild (the test IS the flip, via a who-am-I re-read).
 *   8. TRADER PATH UNTOUCHED BY IDENTITY — the bundle fetch carries no auth header and no new query
 *      param whether anonymous (asserted in §1) or signed-in (asserted here).
 *
 * NOT asserted here (visible + intentional → review/QA; brittle to automate): exact copy (dialog
 * titles, prompts, helper lines, disclaimers), label/placeholder/testid presence for its own sake,
 * layout/styling, the Settings page structure. The ai-rec panel's own auth-outermost rendering is
 * owned by `pages/ticker/widgets/ai-rec/ai-rec.risk.spec.tsx`; the positions-side happy-path gated
 * write is also walked flow-level in `features/trading/positions/positions.risk.spec.tsx` — this file
 * owns the GATE MECHANICS (order / abort / degrade). Pure logic keeps its colocated unit specs
 * (`validation.spec.ts`, `useSettings.spec.tsx`).
 *
 * Mocks ONLY the network boundary (`fetch` + `EventSource` via testBackend); never a live backend.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/app';
import { __resetMemory, allPositions } from '@/features/trading/positions/store';
import { PositionsPage } from '@/pages/positions/PositionsPage';
import { AuthProvider, useAuth } from './AuthContext';
import { AuthDialog, type AuthMode } from './AuthDialog';
import { AuthDialogProvider } from './AuthDialogProvider';
import { SettingsPage } from './SettingsPage';
import { AppThemeProvider } from './ThemeProvider';
import { __resetLocalPrefs, saveLocalTheme } from './localPrefs';
import {
  installAuthBackend,
  uninstallAuthBackend,
  userSession,
  type AuthBackend,
} from './testBackend';

let backend: AuthBackend;

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  __resetLocalPrefs();
});
afterEach(() => {
  cleanup();
  uninstallAuthBackend();
  localStorage.clear();
  __resetMemory();
  __resetLocalPrefs();
});

/** Mount the WHOLE app at a route. <App/> self-composes the auth/theme/dialog providers. */
function mountApp(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <App />
    </MemoryRouter>,
  );
}

/** Mount a feature subtree under the real providers (theme incl. CssBaseline via AppThemeProvider). */
function Mount({ children, route = '/' }: { children: ReactNode; route?: string }) {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[route]}>
          <AuthDialogProvider>{children}</AuthDialogProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </AuthProvider>
  );
}

/** Every URL the installed fetch mock has been called with. */
function calledUrls(): string[] {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
}

// =================================================================================================
// 1. Degrade-to-anonymous — an auth fault NEVER blocks the trader path (THE most important test)
// =================================================================================================
describe('auth · degrade-to-anonymous', () => {
  it('who-am-I 503s ⇒ the bundle still fetches + renders, the SSE still opens, the app is anonymous', async () => {
    // By construction: ONLY the auth endpoint fails; every trader endpoint stays reachable.
    backend = installAuthBackend({ sessionFails: true });
    // Count SSE opens (override the backend's silent stub with a counting one).
    let openedEventSources = 0;
    class CountingEventSource {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      constructor() {
        openedEventSources += 1;
      }
      close() {
        /* no-op */
      }
    }
    vi.stubGlobal('EventSource', CountingEventSource as unknown as typeof EventSource);

    mountApp('/ticker/TSLA');

    // The trader bundle renders exactly as today despite the auth fault — never a blank/blocked path.
    expect(await screen.findByText('Gamma flip')).toBeInTheDocument();
    await waitFor(() => expect(backend.calls.ticker).toBeGreaterThanOrEqual(1));
    // The live stream was opened too — the SSE path never waits on auth.
    await waitFor(() => expect(openedEventSources).toBeGreaterThanOrEqual(1));
    // Degraded ⇒ treated as anonymous (the account control resolves to Sign in, no crash, no loop).
    expect(await screen.findByTestId('account-signin')).toBeInTheDocument();
    // Trader path untouched: the bundle call carries no auth header and no new query param.
    const call = backend.tickerCalls[0];
    expect(call.init?.headers).toBeUndefined();
    expect(call.url).not.toMatch(/auth|session|persona|theme|token/i);
  }, 20000);
});

// =================================================================================================
// 2. useGate awaits the SERVER gate before ANY local write (server-side-gate-enforcement, FE half)
// =================================================================================================

/** Sample the client-local store length AT the exact moment the server gate endpoint is hit, so the
 *  gate-before-write ORDER is proven, not inferred. Wraps the already-installed backend fetch. */
function probeGateOrder() {
  const inner = globalThis.fetch;
  const probe = { storeLenAtGate: null as number | null };
  vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/api/positions/sim-trade/gate')) {
      probe.storeLenAtGate = allPositions().length;
    }
    return (inner as typeof fetch)(input, init);
  }) as typeof fetch);
  return probe;
}

/** Drive the real entry dialog through a minimal MANUAL open (the simplest state-bearing write). */
async function fillManualEntryAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText('Manual price'), '1.50');
  await user.click(within(dialog).getByRole('button', { name: 'Open simulated position' }));
}

function renderPositions() {
  return render(
    <Mount route="/positions">
      <PositionsPage />
    </Mount>,
  );
}

describe('auth · server gate precedes the local write', () => {
  it('200: the gate is called BEFORE the store mutation (order probed), then the write persists', async () => {
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    const probe = probeGateOrder();
    const user = userEvent.setup();
    renderPositions();
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));
    await fillManualEntryAndConfirm(user);

    await waitFor(() => expect(backend.calls.simTradeGate).toBe(1));
    // ORDER: when the gate endpoint was hit, NOTHING had been written yet.
    expect(probe.storeLenAtGate).toBe(0);
    // The authorized write then proceeded.
    await waitFor(() => expect(allPositions()).toHaveLength(1));
    expect(screen.queryByTestId('positions-signin-prompt')).not.toBeInTheDocument();
  }, 20000);

  it('403 (stale cookie / bypassed FE check): gate called, write ABORTED — store untouched, prompt shown', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com'),
      gatedAction: 'auth_required',
    });
    const user = userEvent.setup();
    renderPositions();
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));
    await fillManualEntryAndConfirm(user);

    await waitFor(() => expect(backend.calls.simTradeGate).toBe(1));
    // The 403 aborted the local write — nothing persisted (the invariant, not the prompt's copy).
    expect(allPositions()).toHaveLength(0);
    // Never a silent no-op: the in-context sign-in prompt surfaces.
    expect(await screen.findByTestId('positions-signin-prompt')).toBeInTheDocument();
  }, 20000);

  it('503 (auth subsystem down): the write is ABORTED and a prompt surfaces — never a half-write', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com'),
      gatedAction: 'auth_unavailable',
    });
    const user = userEvent.setup();
    renderPositions();
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));
    await fillManualEntryAndConfirm(user);

    await waitFor(() => expect(backend.calls.simTradeGate).toBe(1));
    expect(allPositions()).toHaveLength(0);
    expect(await screen.findByTestId('positions-signin-prompt')).toBeInTheDocument();
  }, 20000);

  it('logged out: the FE gate short-circuits — prompt shown, NO server call, NO write, no dialog', async () => {
    backend = installAuthBackend(); // anonymous
    const user = userEvent.setup();
    renderPositions();
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));

    expect(await screen.findByTestId('positions-signin-prompt')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // the action did NOT execute
    expect(backend.calls.simTradeGate).toBe(0);
    expect(allPositions()).toHaveLength(0);
  });
});

// =================================================================================================
// 3. Session lifecycle — signup → persist across remount → logout → gated actions RE-GATE
// =================================================================================================
describe('auth · session lifecycle', () => {
  it('anonymous ⇒ prompt; signup ⇒ write unlocked; remount ⇒ persists; logout ⇒ anonymous + re-gates', async () => {
    backend = installAuthBackend(); // anonymous start (= how a stale/expired cookie resolves)
    const user = userEvent.setup();
    let view = mountApp('/positions');

    // Anonymous: a gated write prompts instead of executing (no crash, no redirect loop).
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));
    const prompt = await screen.findByTestId('positions-signin-prompt');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.calls.simTradeGate).toBe(0);

    // Sign UP from the in-context prompt.
    await user.click(within(prompt).getByTestId('positions-signin-prompt-button'));
    await user.click(await screen.findByTestId('auth-mode-switch')); // login → signup
    await user.type(screen.getByTestId('auth-email'), 'new@user.com');
    await user.type(screen.getByTestId('auth-password'), 'longenoughpw');
    await user.click(screen.getByTestId('auth-submit'));

    // Signed in: the account control flips and the gated write now executes (the entry dialog opens).
    await waitFor(() => expect(screen.getByTestId('account-avatar')).toBeInTheDocument());
    await user.click(screen.getByTestId('open-entry'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // Reload (remount): who-am-I reports the SAME user — the session persists.
    view.unmount();
    view = mountApp('/positions');
    await waitFor(() =>
      expect(screen.getByTestId('account-email')).toHaveTextContent('new@user.com'),
    );

    // Log out (lives on the Settings Account panel) ⇒ anonymous.
    await user.click(screen.getByTestId('account-avatar')); // links to /settings
    await user.click(await screen.findByTestId('settings-signout'));
    await waitFor(() => expect(screen.getByTestId('account-signin')).toBeInTheDocument());
    expect(backend.state.session.authenticated).toBe(false);

    // Gated actions RE-GATE after logout (fresh mount, fresh who-am-I ⇒ anonymous again).
    view.unmount();
    mountApp('/positions');
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));
    expect(await screen.findByTestId('positions-signin-prompt')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.calls.simTradeGate).toBe(0); // the FE gate never even reached the server
  }, 30000);
});

// =================================================================================================
// 4 + 5. Login security floors — non-enumerating 401, never-echo
// =================================================================================================

/** Mounts the real dialog open in a mode, under the real provider + theme. */
function DialogHarness({ mode: initial }: { mode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initial);
  const [open, setOpen] = useState(true);
  return (
    <AuthProvider>
      <AppThemeProvider>
        <AuthDialog open={open} mode={mode} onClose={() => setOpen(false)} onModeChange={setMode} />
      </AppThemeProvider>
    </AuthProvider>
  );
}

async function submitLogin(user: ReturnType<typeof userEvent.setup>, email: string, pw: string) {
  await user.clear(screen.getByTestId('auth-email'));
  await user.type(screen.getByTestId('auth-email'), email);
  await user.clear(screen.getByTestId('auth-password'));
  await user.type(screen.getByTestId('auth-password'), pw);
  await user.click(screen.getByTestId('auth-submit'));
}

describe('auth · non-enumerating 401', () => {
  it('unknown-email and wrong-password yield the IDENTICAL observable failure state', async () => {
    // Both shapes map to the same server `bad_credentials` code — the DOM states must be identical.
    backend = installAuthBackend({ login: 'bad_credentials' });
    const user = userEvent.setup();

    render(<DialogHarness mode="login" />);
    await submitLogin(user, 'unknown@user.com', 'whatever');
    const unknownEmailErr = (await screen.findByTestId('auth-form-error')).textContent;
    cleanup();

    render(<DialogHarness mode="login" />);
    await submitLogin(user, 'known@user.com', 'wrongpw');
    const wrongPwErr = (await screen.findByTestId('auth-form-error')).textContent;

    expect(unknownEmailErr).toBeTruthy(); // a failure IS surfaced (not a silent no-op)
    expect(unknownEmailErr).toBe(wrongPwErr); // ...and it is byte-identical across the two causes
    // Neither state may enumerate which credential was wrong.
    expect(wrongPwErr).not.toMatch(/no account|not found|email exists|wrong password/i);
  });
});

describe('auth · never-echo floor', () => {
  it('the typed password never re-enters the DOM outside its input and never rides ANY request URL', async () => {
    backend = installAuthBackend({ login: 'bad_credentials' });
    const user = userEvent.setup();
    const secret = 'SuperSecretHunter2';
    render(<DialogHarness mode="login" />);
    await submitLogin(user, 'a@user.com', secret);
    await screen.findByTestId('auth-form-error');

    // Not in any text node, and not in the serialized DOM outside the input element itself.
    expect(document.body.textContent ?? '').not.toContain(secret);
    expect(document.body.innerHTML.replace(/<input[^>]*>/g, '')).not.toContain(secret);
    // By construction: scan EVERY URL the network boundary ever received — the credential may ride
    // only a request BODY, never a URL/query string.
    for (const url of calledUrls()) expect(url).not.toContain(secret);
    expect(calledUrls().some((u) => u.includes('/api/auth/login'))).toBe(true); // the scan saw the attempt
  });
});

// =================================================================================================
// 6. Server-wins settings — anonymous client-local fallback, per-account isolation, zero bleed
// =================================================================================================
describe('auth · server-wins settings, no bleed across identities', () => {
  it('signed-in reads the server value (leftover local pref neither applied nor written back); anonymous falls back local; switching accounts switches cleanly', async () => {
    saveLocalTheme('light'); // a leftover anonymous client-local pref
    backend = installAuthBackend({
      session: userSession('u-X', 'x@x.com', {
        active_persona_id: null,
        default_ticker: 'MSFT',
        theme: 'dark',
      }),
    });
    const user = userEvent.setup();
    render(
      <Mount route="/settings">
        <SettingsPage />
      </Mount>,
    );
    const pressed = (pref: string) =>
      screen.getByTestId(`settings-theme-${pref}`).getAttribute('aria-pressed');

    // X's SERVER values show — the leftover local 'light' is not applied…
    await waitFor(() => expect(screen.getByTestId('settings-ticker')).toHaveValue('MSFT'));
    expect(pressed('dark')).toBe('true');
    expect(pressed('light')).toBe('false');
    // …and is never mirrored back to the server.
    expect(backend.calls.settingsPut).toBe(0);

    // Sign out ⇒ anonymous falls back to the CLIENT-LOCAL pref (the two stores never merged).
    await user.click(screen.getByTestId('settings-signout'));
    await waitFor(() =>
      expect(screen.getByTestId('settings-account-signed-out')).toBeInTheDocument(),
    );
    await waitFor(() => expect(pressed('light')).toBe('true'));

    // Sign in as Y ⇒ Y's OWN server values, with zero residue from X or the local store.
    backend.setUser({
      id: 'u-Y',
      email: 'y@x.com',
      settings: { active_persona_id: null, default_ticker: 'NVDA', theme: 'system' },
    });
    await user.click(screen.getByTestId('settings-signin'));
    await submitLogin(user, 'y@x.com', 'pw');
    await waitFor(() => expect(screen.getByTestId('settings-ticker')).toHaveValue('NVDA'));
    expect(pressed('system')).toBe('true');
    expect(pressed('light')).toBe('false');
    expect(pressed('dark')).toBe('false');
    // No settings write ever happened — reads never bleed into writes on identity changes.
    expect(backend.calls.settingsPut).toBe(0);
  }, 20000);
});

// =================================================================================================
// 7. Google — present-but-disabled-when-unconfigured; the config flip IS the test
// =================================================================================================

/** The dialog + a who-am-I re-read trigger (a config flip lands via the next session read). */
function GoogleHarness() {
  const auth = useAuth();
  return (
    <>
      <button onClick={() => auth.refresh()} data-testid="refresh-session">
        refresh
      </button>
      <AuthDialog
        open
        mode="login"
        onClose={() => undefined}
        onModeChange={() => undefined}
      />
    </>
  );
}

describe('auth · Google control', () => {
  it('google_available:false ⇒ disabled, and a click initiates NOTHING (no navigation, no fetch)', async () => {
    backend = installAuthBackend(); // anonymous, google_available: false
    render(
      <AuthProvider>
        <AppThemeProvider>
          <GoogleHarness />
        </AppThemeProvider>
      </AuthProvider>,
    );
    const btn = await screen.findByTestId('google-button');
    await waitFor(() => expect(btn).toBeDisabled());

    const hrefBefore = window.location.href;
    const fetchesBefore = calledUrls().length;
    fireEvent.click(btn); // bypasses pointer-events so the inertness is proven on the element itself
    // By construction: NOTHING was initiated — no OAuth navigation, no network call of any kind.
    expect(window.location.href).toBe(hrefBefore);
    expect(calledUrls().length).toBe(fetchesBefore);
    expect(calledUrls().some((u) => u.includes('google'))).toBe(false);
  });

  it('config-only flip false→true (no rebuild): the next who-am-I read enables the control', async () => {
    backend = installAuthBackend(); // starts unavailable
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <AppThemeProvider>
          <GoogleHarness />
        </AppThemeProvider>
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('google-button')).toBeDisabled());

    backend.setGoogle(true); // the deployment gains credentials — config, not code
    await user.click(screen.getByTestId('refresh-session'));
    await waitFor(() => expect(screen.getByTestId('google-button')).toBeEnabled());
  });
});

// =================================================================================================
// 8. Trader path untouched by identity — no auth header / new query param on the bundle (signed-in)
// =================================================================================================
describe('auth · bundle path carries no identity', () => {
  it('signed-in, getTicker is called with NO auth header and NO new query param', async () => {
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    mountApp('/ticker/TSLA');
    await screen.findByTestId('account-avatar'); // the signed-in state resolved
    await waitFor(() => expect(backend.tickerCalls.length).toBeGreaterThanOrEqual(1));
    for (const call of backend.tickerCalls) {
      expect(call.url).toMatch(/\/api\/ticker\/TSLA/);
      expect(call.init?.headers).toBeUndefined();
      expect(call.url).not.toMatch(/auth|session|persona|theme|token/i);
    }
  }, 20000);
});
