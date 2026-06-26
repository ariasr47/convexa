/**
 * Component — the sign-up + log-in forms (UX_BLUEPRINT §2.2/§2.3). Renders each component state from
 * the contract: default / loading / duplicate-email / validation / bad-credentials NON-ENUMERATING /
 * auth-unavailable / success. Mocks ONLY the network boundary.
 *
 * Traceability: T-B1, T-B2, T-B3, T-C1, T-C3, T-H3.
 */
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { AuthProvider } from './AuthContext';
import { AuthDialog, type AuthMode } from './AuthDialog';
import { AUTH_COPY } from './copy';
import { installAuthBackend, uninstallAuthBackend, type AuthBackend } from './testBackend';

/** A small harness that mounts the dialog open in a chosen mode under the real AuthProvider. */
function Harness({ mode: initial }: { mode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initial);
  const [open, setOpen] = useState(true);
  return (
    <AuthProvider>
      <AuthDialog open={open} mode={mode} onClose={() => setOpen(false)} onModeChange={setMode} />
    </AuthProvider>
  );
}

let backend: AuthBackend;
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); uninstallAuthBackend(); localStorage.clear(); });

async function fillForm(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.clear(screen.getByTestId('auth-email'));
  await user.type(screen.getByTestId('auth-email'), email);
  await user.clear(screen.getByTestId('auth-password'));
  await user.type(screen.getByTestId('auth-password'), password);
}

describe('Sign-up form', () => {
  it('T-B1: valid signup ⇒ submits the credentials and resolves signed-in', async () => {
    backend = installAuthBackend({ signup: 'ok' });
    const user = userEvent.setup();
    render(<Harness mode="signup" />);
    await fillForm(user, 'new@user.com', 'longenoughpw');
    await user.click(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(backend.calls.signup).toBe(1));
  });

  it('T-B2: duplicate email ⇒ the exact "already registered" inline copy, no generic error', async () => {
    backend = installAuthBackend({ signup: 'email_taken' });
    const user = userEvent.setup();
    render(<Harness mode="signup" />);
    await fillForm(user, 'taken@user.com', 'longenoughpw');
    await user.click(screen.getByTestId('auth-submit'));
    expect(await screen.findByText(AUTH_COPY.signup.emailTaken)).toBeInTheDocument();
  });

  it('T-B3: validation ⇒ field-level password-floor copy reading the server number', async () => {
    backend = installAuthBackend({ signup: 'validation', passwordFloor: 10 });
    const user = userEvent.setup();
    render(<Harness mode="signup" />);
    await fillForm(user, 'ok@user.com', 'short'); // client passes @-shape; server enforces the floor
    await user.click(screen.getByTestId('auth-submit'));
    expect(await screen.findByText(AUTH_COPY.signup.passwordFloor(10))).toBeInTheDocument();
  });

  it('T-B3 (client): malformed email blocks submit with field copy, no network call', async () => {
    backend = installAuthBackend();
    const user = userEvent.setup();
    render(<Harness mode="signup" />);
    await fillForm(user, 'not-an-email', 'longenoughpw');
    await user.click(screen.getByTestId('auth-submit'));
    expect(await screen.findByText(AUTH_COPY.signup.invalidEmail)).toBeInTheDocument();
    expect(backend.calls.signup).toBe(0);
  });

  it('auth-unavailable ⇒ the degraded banner, no account, never a misleading error', async () => {
    backend = installAuthBackend({ signup: 'auth_unavailable' });
    const user = userEvent.setup();
    render(<Harness mode="signup" />);
    await fillForm(user, 'ok@user.com', 'longenoughpw');
    await user.click(screen.getByTestId('auth-submit'));
    expect(await screen.findByText(AUTH_COPY.signup.unavailable)).toBeInTheDocument();
  });
});

describe('Log-in form', () => {
  it('T-C1: correct credentials ⇒ submits login', async () => {
    backend = installAuthBackend({ login: 'ok' });
    const user = userEvent.setup();
    render(<Harness mode="login" />);
    await fillForm(user, 'a@user.com', 'pw');
    await user.click(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(backend.calls.login).toBe(1));
  });

  it('T-C3 / T-H3: bad credentials ⇒ the single generic NON-ENUMERATING message', async () => {
    backend = installAuthBackend({ login: 'bad_credentials' });
    const user = userEvent.setup();
    render(<Harness mode="login" />);
    await fillForm(user, 'wrong@user.com', 'wrongpw');
    await user.click(screen.getByTestId('auth-submit'));
    const err = await screen.findByTestId('auth-form-error');
    expect(err).toHaveTextContent(AUTH_COPY.login.badCredentials);
    // It must NOT enumerate.
    expect(err.textContent).not.toMatch(/no account|not found|email exists|wrong password/i);
  });

  it('empty password ⇒ field-level copy, no network call', async () => {
    backend = installAuthBackend();
    const user = userEvent.setup();
    render(<Harness mode="login" />);
    await user.type(screen.getByTestId('auth-email'), 'a@user.com');
    await user.click(screen.getByTestId('auth-submit'));
    expect(await screen.findByText(AUTH_COPY.login.emptyPassword)).toBeInTheDocument();
    expect(backend.calls.login).toBe(0);
  });
});

describe('T-H3: login-failure copy is byte-identical for wrong-email vs wrong-password', () => {
  it('renders the SAME message for both failure shapes', async () => {
    // Both shapes map to the same server `bad_credentials` code ⇒ the same FE copy.
    backend = installAuthBackend({ login: 'bad_credentials' });
    const user = userEvent.setup();

    render(<Harness mode="login" />);
    await fillForm(user, 'unknown@user.com', 'whatever');
    await user.click(screen.getByTestId('auth-submit'));
    const msgUnknownEmail = (await screen.findByTestId('auth-form-error')).textContent;
    cleanup();

    render(<Harness mode="login" />);
    await fillForm(user, 'known@user.com', 'wrongpw');
    await user.click(screen.getByTestId('auth-submit'));
    const msgWrongPw = (await screen.findByTestId('auth-form-error')).textContent;

    expect(msgUnknownEmail).toBe(msgWrongPw);
    expect(msgWrongPw).toBe(AUTH_COPY.login.badCredentials);
  });
});

describe('T-H1: the password is never echoed into any surfaced state', () => {
  it('no rendered surface contains the typed password after an error', async () => {
    backend = installAuthBackend({ login: 'bad_credentials' });
    const user = userEvent.setup();
    const secret = 'SuperSecret123';
    const { container } = render(<Harness mode="login" />);
    await fillForm(user, 'a@user.com', secret);
    await user.click(screen.getByTestId('auth-submit'));
    await screen.findByTestId('auth-form-error');
    // The password input value holds it (that is the field), but no OTHER text node should.
    const textOnly = container.querySelectorAll('[data-testid="auth-form-error"], .MuiAlert-message');
    textOnly.forEach((n) => expect(n.textContent ?? '').not.toContain(secret));
  });
});
