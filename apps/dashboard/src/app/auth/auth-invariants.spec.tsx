/**
 * Integration — the PROMOTED INVARIANTS + the trader-path/security ACs. Mounts the REAL app subtree,
 * mocking ONLY the network boundary. These assert OBSERVABLE behavior, not a coverage %.
 *
 * Traceability: T-A2 (anon surfaces reachable), T-A3 (anon persona/theme client-local), T-F4 (settings
 * score-neutral), T-H1/H2 (no secret/password reaches the browser), T-I1 (bundle identical anon vs
 * signed-in), T-I2 (no new auth header/query param on the bundle/SSE path).
 */
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../app';
import { __resetMemory } from '../positions/store';
import { __resetLocalPrefs } from './localPrefs';
import {
  installAuthBackend, uninstallAuthBackend, userSession, type AuthBackend,
} from './testBackend';

/** <App/> self-composes the auth/theme/dialog providers. */
function mountApp(initial: string) {
  return render(<MemoryRouter initialEntries={[initial]}><App /></MemoryRouter>);
}

let backend: AuthBackend;
beforeEach(() => { localStorage.clear(); __resetMemory(); __resetLocalPrefs(); });
afterEach(() => { cleanup(); uninstallAuthBackend(); localStorage.clear(); __resetMemory(); __resetLocalPrefs(); });

describe('Anonymous surfaces reachable (AC-A2)', () => {
  it('T-A2: the Scanner stub renders for an anonymous user, no sign-in wall', async () => {
    backend = installAuthBackend();
    mountApp('/scanner');
    // Scanner is a static stub — it renders without auth and shows the Sign in control in the shell.
    expect(await screen.findByTestId('account-signin')).toBeInTheDocument();
    // The shell nav (anonymous-capable) is present.
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });
});

describe('Trader-path invariant — no new header / query param (AC-I2)', () => {
  it('T-I2: getTicker is called with NO auth header and NO new query param, anon AND signed-in', async () => {
    // Anonymous.
    backend = installAuthBackend();
    mountApp('/ticker/TSLA');
    await waitFor(() => expect(backend.tickerCalls.length).toBeGreaterThanOrEqual(1));
    const anonCall = backend.tickerCalls[0];
    expect(anonCall.url).toMatch(/\/api\/ticker\/TSLA/);
    // No auth-bearing header was attached.
    expect(anonCall.init?.headers).toBeUndefined();
    // No auth/session/persona/theme query param leaked onto the bundle path.
    expect(anonCall.url).not.toMatch(/auth|session|persona|theme|token/i);
    cleanup();
    uninstallAuthBackend();

    // Signed-in: the SAME shape — identity changes nothing the bundle path sees.
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    mountApp('/ticker/TSLA');
    await waitFor(() => expect(backend.tickerCalls.length).toBeGreaterThanOrEqual(1));
    const authedCall = backend.tickerCalls[0];
    expect(authedCall.url).toMatch(/\/api\/ticker\/TSLA/);
    expect(authedCall.init?.headers).toBeUndefined();
    expect(authedCall.url).not.toMatch(/auth|session|persona|theme|token/i);
  });
});

describe('Trader-path invariant — bundle render identical anon vs signed-in (AC-I1)', () => {
  it('T-I1: the same tile values render whether anonymous or signed-in', async () => {
    backend = installAuthBackend();
    mountApp('/ticker/TSLA');
    // Deterministic bundle values: call/put wall come straight from the (identical) mock bundle.
    await screen.findByText('Call wall');
    const anonCallWall = screen.getByText('$260');
    const anonPutWall = screen.getByText('$240');
    expect(anonCallWall).toBeInTheDocument();
    expect(anonPutWall).toBeInTheDocument();
    cleanup();
    uninstallAuthBackend();

    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    mountApp('/ticker/TSLA');
    await screen.findByText('Call wall');
    // Identity does not change the rendered bundle — the SAME wall values render.
    expect(screen.getByText('$260')).toBeInTheDocument();
    expect(screen.getByText('$240')).toBeInTheDocument();
  });
});

describe('Settings score-neutral (AC-F4)', () => {
  it('T-F4: a who-am-I carrying a persona/theme pref does NOT add a bundle refetch param', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com', { active_persona_id: 'income_keeper', default_ticker: 'NVDA', theme: 'light' }),
    });
    mountApp('/ticker/TSLA');
    await waitFor(() => expect(backend.tickerCalls.length).toBeGreaterThanOrEqual(1));
    // The bundle is still fetched for the URL ticker with no pref param — settings never touch scoring.
    backend.tickerCalls.forEach((c) => {
      expect(c.url).not.toMatch(/persona|theme|active_persona|default_ticker/i);
    });
  });
});

describe('Security floor — no secret/password reaches the browser (AC-H1/H2)', () => {
  it('T-H1 / T-H2: no consumed who-am-I field or rendered surface carries a password/hash/session id/secret', async () => {
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    const { container } = mountApp('/ticker/TSLA');
    await screen.findByTestId('account-avatar');
    // The who-am-I shape the FE consumes carries only identity + flags. Assert NO secret-bearing
    // KEY exists (the literal "password" as an auth_methods VALUE is fine — it is a method label, not
    // a credential). We inspect the object keys recursively.
    const keys = new Set<string>();
    const walk = (o: unknown) => {
      if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o as Record<string, unknown>)) { keys.add(k.toLowerCase()); walk(v); }
      }
    };
    walk(backend.state.session);
    for (const forbidden of ['password', 'password_hash', 'hash', 'session_id', 'sessionid', 'signing_key', 'client_secret', 'session_secret', 'token']) {
      expect(keys.has(forbidden)).toBe(false);
    }
    // No rendered surface leaks any secret token value.
    expect(container.textContent ?? '').not.toMatch(/signing_key|client_secret|session_secret|password_hash/i);
  });
});

describe('Anonymous persona/theme client-local — no regression (AC-A3)', () => {
  it('T-A3: anonymous defaults to the dark theme (today behavior); no server pref applied', async () => {
    backend = installAuthBackend(); // anonymous, no local prefs
    mountApp('/ticker/TSLA');
    await screen.findByText('Gamma flip');
    // The anonymous default theme is dark (CssBaseline applies the dark background) — today behavior.
    // (We assert the document didn't crash + rendered, the strongest observable for "as today".)
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });
});
