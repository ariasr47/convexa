/**
 * Component — the "Continue with Google" first-class present-but-disabled control (D9, UX_BLUEPRINT
 * §2.4). Driven by `google_available` from who-am-I (NOT a build flag). Covers T-G1 (present-disabled
 * + helper), T-G2 (no crash from absent creds; the credentials path still works), and T-G3 (config-only
 * flip false→true present-disabled → present-enabled with no rebuild).
 */
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { GoogleButton } from './GoogleButton';
import { AuthDialog } from './AuthDialog';
import { AUTH_COPY } from './copy';
import { installAuthBackend, uninstallAuthBackend, type AuthBackend } from './testBackend';

/** Mounts the dialog (with the Google control) + a button to re-read who-am-I (config flip). */
function Harness() {
  const auth = useAuth();
  const [open] = useState(true);
  return (
    <>
      <button onClick={() => auth.refresh()} data-testid="refresh-session">refresh</button>
      <span data-testid="google-flag">{String(auth.googleAvailable)}</span>
      <AuthDialog open={open} mode="login" onClose={() => undefined} onModeChange={() => undefined} />
    </>
  );
}

let backend: AuthBackend;
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); uninstallAuthBackend(); localStorage.clear(); });

describe('GoogleButton in isolation', () => {
  it('T-G1: unavailable ⇒ present, disabled, with the helper copy', () => {
    render(<GoogleButton available={false} />);
    const btn = screen.getByTestId('google-button');
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    expect(screen.getByTestId('google-helper')).toHaveTextContent(AUTH_COPY.google.helperDisabled);
  });

  it('available ⇒ present, enabled, no helper', () => {
    render(<GoogleButton available={true} />);
    const btn = screen.getByTestId('google-button');
    expect(btn).toBeInTheDocument();
    expect(btn).toBeEnabled();
    expect(screen.queryByTestId('google-helper')).not.toBeInTheDocument();
  });
});

describe('Google control driven by who-am-I', () => {
  it('T-G1: google_available=false ⇒ disabled in the form', async () => {
    backend = installAuthBackend({ session: { authenticated: false, user: null, google_available: false, settings: null } });
    render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('google-flag')).toHaveTextContent('false'));
    expect(screen.getByTestId('google-button')).toBeDisabled();
  });

  it('T-G2: absent creds cause no crash and the credentials path still works', async () => {
    backend = installAuthBackend({ session: { authenticated: false, user: null, google_available: false, settings: null }, login: 'ok' });
    const user = userEvent.setup();
    render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('google-button')).toBeDisabled());
    // The form renders fine and the email/password path is fully usable.
    await user.type(screen.getByTestId('auth-email'), 'a@user.com');
    await user.type(screen.getByTestId('auth-password'), 'pw');
    await user.click(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(backend.calls.login).toBe(1));
  });

  it('T-G3: flip false→true at the boundary ⇒ control becomes enabled with no rebuild', async () => {
    backend = installAuthBackend({ session: { authenticated: false, user: null, google_available: false, settings: null } });
    const user = userEvent.setup();
    render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('google-button')).toBeDisabled());
    // Config supplies the creds; the next who-am-I read flips the flag.
    backend.setGoogle(true);
    await user.click(screen.getByTestId('refresh-session'));
    await waitFor(() => expect(screen.getByTestId('google-button')).toBeEnabled());
  });
});
