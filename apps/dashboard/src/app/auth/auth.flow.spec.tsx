/**
 * user-accounts FLOW-INTEGRATION suite — THE CENTERPIECE. Drives the REAL user journeys end-to-end
 * through <App/> + the real auth providers, mocking ONLY the network boundary (`fetch` + `EventSource`
 * via testBackend) — NEVER a live backend. The real @org/api client, the real AuthContext/hooks/forms,
 * and the real trader subtree all run.
 *
 * Journeys walked here:
 *  - anonymous browsing renders the trader path with NO regression + NO sign-in wall (T-A1/A2);
 *  - signup → signed-in → reload-persist → logout → anonymous (T-B1/C2/D1);
 *  - logged-out gated action → in-context prompt → sign-in → action available (T-E1 + D6c return);
 *  - stale cookie ⇒ anonymous (T-D2);
 *  - auth-subsystem failure ⇒ degrade-to-anonymous WITHOUT breaking the trader path (T-J1).
 *
 * QA traces each AC → ≥1 named passing test at GATE Q.
 */
import { render, screen, within, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../app';
import { AUTH_COPY } from './copy';
import { __resetMemory } from '../positions/store';
import { __resetLocalPrefs } from './localPrefs';
import {
  installAuthBackend, uninstallAuthBackend, userSession, anonSession, type AuthBackend,
} from './testBackend';

/** Mount the WHOLE app at a chosen route. <App/> self-composes the auth/theme/dialog providers. */
function mountApp(initial = '/ticker/TSLA') {
  return render(<MemoryRouter initialEntries={[initial]}><App /></MemoryRouter>);
}

let backend: AuthBackend;
beforeEach(() => { localStorage.clear(); __resetMemory(); __resetLocalPrefs(); });
afterEach(() => { cleanup(); uninstallAuthBackend(); localStorage.clear(); __resetMemory(); __resetLocalPrefs(); });

async function signUp(user: ReturnType<typeof userEvent.setup>, email: string, pw: string) {
  await user.click(await screen.findByTestId('auth-mode-switch')); // login → signup
  await user.type(screen.getByTestId('auth-email'), email);
  await user.type(screen.getByTestId('auth-password'), pw);
  await user.click(screen.getByTestId('auth-submit'));
}

describe('Anonymous browsing — zero regression (AC-A1/A2)', () => {
  it('T-A1: Ticker bundle (tiles) renders for an anonymous user; account control shows Sign in; no wall', async () => {
    backend = installAuthBackend(); // anonymous
    mountApp('/ticker/TSLA');
    // The trader bundle rendered (a stat tile is present) — no sign-in wall blocking it.
    expect(await screen.findByText('Gamma flip')).toBeInTheDocument();
    // The bundle was fetched without waiting on who-am-I.
    await waitFor(() => expect(backend.calls.ticker).toBeGreaterThanOrEqual(1));
    // The account control resolves to Sign in.
    expect(await screen.findByTestId('account-signin')).toBeInTheDocument();
  });
});

describe('Signup → reload-persist → logout (AC-B1/C2/D1)', () => {
  it('T-B1/C2/D1: signs up, persists across a remount, then logs out to anonymous', async () => {
    backend = installAuthBackend(); // anonymous start
    const user = userEvent.setup();
    const { unmount } = mountApp('/ticker/TSLA');

    // Open the sign-in dialog from the account control, switch to signup, create the account.
    await user.click(await screen.findByTestId('account-signin'));
    await signUp(user, 'new@user.com', 'longenoughpw');

    // Signed-in: the account menu now shows (the email/display name).
    await waitFor(() => expect(screen.getByTestId('account-menu-button')).toBeInTheDocument());
    expect(screen.getByTestId('account-menu-button')).toHaveTextContent('new@user.com');

    // T-C2: remount (a reload) ⇒ who-am-I reports the SAME user, still signed in.
    unmount();
    mountApp('/ticker/TSLA');
    await waitFor(() => expect(screen.getByTestId('account-menu-button')).toHaveTextContent('new@user.com'));

    // T-D1: log out ⇒ account control flips back to Sign in; who-am-I reports anonymous.
    await user.click(screen.getByTestId('account-menu-button'));
    await user.click(await screen.findByTestId('account-logout'));
    await waitFor(() => expect(screen.getByTestId('account-signin')).toBeInTheDocument());
    expect(backend.state.session.authenticated).toBe(false);
  });
});

describe('Logged-out gated action → prompt → sign-in → works (AC-E1, D6c)', () => {
  it('T-E1: a Positions write prompts sign-in; after sign-in the write surface is available', async () => {
    backend = installAuthBackend(); // anonymous
    const user = userEvent.setup();
    mountApp('/positions');

    // Trigger a write while logged out ⇒ the in-context prompt appears, the entry dialog does NOT open.
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));
    const prompt = await screen.findByTestId('positions-signin-prompt');
    expect(prompt).toHaveTextContent(AUTH_COPY.positions.gateTrack);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Tap "Sign in" in the prompt → the dialog opens; log in.
    await user.click(within(prompt).getByTestId('positions-signin-prompt-button'));
    await user.type(await screen.findByTestId('auth-email'), 'a@user.com');
    await user.type(screen.getByTestId('auth-password'), 'pw');
    await user.click(screen.getByTestId('auth-submit'));

    // Back on /positions, signed in: the write now works (the entry dialog opens) — prompt cleared.
    await waitFor(() => expect(screen.getByTestId('account-menu-button')).toBeInTheDocument());
    await user.click(screen.getByTestId('open-entry'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });
});

describe('Stale / expired / revoked cookie ⇒ anonymous (AC-D2)', () => {
  it('T-D2: who-am-I returns anonymous despite a (stale) cookie ⇒ Sign in shown, writes prompt', async () => {
    // The browser has a cookie, but the server resolves it to anonymous (stale/expired/revoked).
    backend = installAuthBackend({ session: anonSession() });
    const user = userEvent.setup();
    mountApp('/positions');

    expect(await screen.findByTestId('account-signin')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));
    expect(await screen.findByTestId('positions-signin-prompt')).toBeInTheDocument();
  });
});

describe('Auth-subsystem failure ⇒ degrade-to-anonymous, trader path intact (AC-J1)', () => {
  it('T-J1: who-am-I fails ⇒ bundle still renders (chart never blanks), account shows Sign in', async () => {
    backend = installAuthBackend(); // anonymous shape
    backend.failSession(); // who-am-I now 503s (transport fault)
    mountApp('/ticker/TSLA');

    // The trader bundle renders EXACTLY as today despite the auth fault.
    expect(await screen.findByText('Gamma flip')).toBeInTheDocument();
    await waitFor(() => expect(backend.calls.ticker).toBeGreaterThanOrEqual(1));
    // Degraded ⇒ treated as anonymous: the account control shows Sign in (never a trader-path break).
    expect(await screen.findByTestId('account-signin')).toBeInTheDocument();
  });
});
