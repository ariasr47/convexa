/**
 * Component/integration — the Positions gated WRITE actions (UX_BLUEPRINT §2.6, AC-E1/E2/E3/E7). The
 * route stays viewable anonymously; ONLY the write actions gate. Mounts the REAL PositionsPage subtree
 * under the auth providers, mocking ONLY the network boundary.
 *
 * Traceability: T-E1 (write gated logged-out), T-E2 (write works signed-in), T-E3 (route viewable
 * anonymous), and the honest disclosure banner (D6d).
 */
import { render, screen, within, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { AuthDialogProvider } from './AuthDialogProvider';
import { AppThemeProvider } from './ThemeProvider';
import { AUTH_COPY } from './copy';
import { PositionsPage } from '../positions/PositionsPage';
import { __resetMemory, allPositions } from '../positions/store';
import { installAuthBackend, uninstallAuthBackend, userSession, type AuthBackend } from './testBackend';

/** Drive the real entry dialog through a minimal MANUAL open (the simplest state-bearing write).
 *  Expiration + strike default (first / nearest-to-spot); manual mode opens at the typed price
 *  regardless of contract stats (404 in the mock). Only the manual price + Confirm are needed. */
async function fillManualEntryAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText('Manual price'), '1.50');
  await user.click(within(dialog).getByRole('button', { name: 'Open simulated position' }));
}

function Mount({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <MemoryRouter initialEntries={['/positions']}>
          <AuthDialogProvider>{children}</AuthDialogProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </AuthProvider>
  );
}

let backend: AuthBackend;
beforeEach(() => { localStorage.clear(); __resetMemory(); });
afterEach(() => { cleanup(); uninstallAuthBackend(); localStorage.clear(); __resetMemory(); });

describe('Positions — viewable anonymously (AC-E3)', () => {
  it('T-E3: logged-out, the route renders with the disclosure banner; only writes prompt', async () => {
    backend = installAuthBackend(); // anonymous
    render(<Mount><PositionsPage /></Mount>);
    // The surface renders (route not blocked).
    expect(await screen.findByTestId('portfolio-panel')).toBeInTheDocument();
    // The honest browser-local disclosure is always shown.
    const disclosure = screen.getByTestId('positions-disclosure');
    expect(disclosure).toHaveTextContent('stored in this browser, not tied to your account');
    // Must NOT imply sync/privacy/account-scoping. The binding copy uses an honest NEGATION
    // ("aren't synced … aren't cleared when you log out"), which is the point — assert it is present.
    expect(disclosure.textContent).not.toMatch(/private to your account|backed up|your portfolio/i);
    expect(disclosure.textContent).toMatch(/aren’t synced|aren't synced/i);
    // No prompt is shown until a write is triggered.
    expect(screen.queryByTestId('positions-signin-prompt')).not.toBeInTheDocument();
  });
});

describe('Positions — write gated when logged out (AC-E1)', () => {
  it('T-E1: Open position ⇒ visible sign-in prompt, the entry dialog does NOT open', async () => {
    backend = installAuthBackend(); // anonymous
    const user = userEvent.setup();
    render(<Mount><PositionsPage /></Mount>);
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());

    await user.click(screen.getByTestId('open-entry'));
    // The prompt appears with the binding copy.
    expect(await screen.findByTestId('positions-signin-prompt'))
      .toHaveTextContent(AUTH_COPY.positions.gateTrack);
    // The action did NOT execute — the entry dialog is not open.
    expect(screen.queryByText('Open simulated trade')).not.toBeInTheDocument();
  });
});

describe('Positions — write works when signed in (AC-E2)', () => {
  it('T-E2: Open position ⇒ the existing entry dialog opens (mandatory confirm, SIMULATED)', async () => {
    backend = installAuthBackend({
      session: userSession('u-1', 'a@x.com'),
    });
    const user = userEvent.setup();
    render(<Mount><PositionsPage /></Mount>);
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());

    await user.click(screen.getByTestId('open-entry'));
    // The entry dialog opens — no sign-in prompt.
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.queryByTestId('positions-signin-prompt')).not.toBeInTheDocument();
  });
});

describe('Positions — server-enforced gate on the WRITE (AC-E7, D6e)', () => {
  // Proves the enforcement is SERVER-SIDE, not FE-only: the sim-trade WRITE awaits
  // `POST /api/positions/sim-trade/gate` BEFORE the local localStorage write. A 403 from the server
  // (stale cookie / bypassed FE auth check) ABORTS the write — nothing persists — while the FE still
  // believed it was signed in. Pairs with T-E7 in gated-ai-rec.spec.tsx (the AI-rec surface).
  it('T-E7 (positions): signed-in FE but the server gate returns 403 ⇒ server gate called, write ABORTED (nothing persisted), sign-in prompt shown', async () => {
    // The FE believes it is signed in, but the server-side gate rejects (stale cookie / bypass).
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com'), gatedAction: 'auth_required' });
    const user = userEvent.setup();
    render(<Mount><PositionsPage /></Mount>);
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());

    // The FE check passes (it thinks it is signed in) ⇒ the dialog opens, no prompt yet.
    await user.click(screen.getByTestId('open-entry'));
    expect(screen.queryByTestId('positions-signin-prompt')).not.toBeInTheDocument();

    await fillManualEntryAndConfirm(user);

    // The SERVER gate was actually called for the write (not an FE-only check).
    await waitFor(() => expect(backend.calls.simTradeGate).toBe(1));
    // The server 403 ABORTED the local write — nothing is persisted to the client-local store.
    expect(allPositions()).toHaveLength(0);
    // The in-context sign-in prompt is surfaced (never a silent no-op).
    expect(await screen.findByTestId('positions-signin-prompt'))
      .toHaveTextContent(AUTH_COPY.positions.gateTrack);
  });

  it('T-E7 (positions, allowed): a successful server gate (200) lets the local write proceed', async () => {
    // Default gatedAction = 'ok' ⇒ the server gate authorizes; the write must persist.
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    const user = userEvent.setup();
    render(<Mount><PositionsPage /></Mount>);
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());

    await user.click(screen.getByTestId('open-entry'));
    await fillManualEntryAndConfirm(user);

    // The server gate was awaited AND authorized ⇒ the local write happened (position persisted).
    await waitFor(() => expect(backend.calls.simTradeGate).toBe(1));
    await waitFor(() => expect(allPositions()).toHaveLength(1));
    // No sign-in prompt on the authorized path.
    expect(screen.queryByTestId('positions-signin-prompt')).not.toBeInTheDocument();
  });
});
