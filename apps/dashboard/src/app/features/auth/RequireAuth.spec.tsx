/**
 * RequireAuth.spec.tsx — curvature-v2-landing-and-site SPEC §4/§5 (F11): the wall's two NEW
 * branches (the quiet hold while `!ready`, and the degraded branch that stops asserting the
 * visitor is signed out when the who-am-I read failed).
 *
 * `useAuth()` is mocked directly so every branch is asserted in isolation and deterministically —
 * no fetch, no AuthProvider, no timers.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AuthApi } from './AuthContext';
import { AUTH_COPY } from './copy';
import { RequireAuth } from './RequireAuth';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock('./AuthContext', () => ({ useAuth: useAuthMock }));

const BASE_AUTH: AuthApi = {
  ready: true,
  authenticated: false,
  user: null,
  googleAvailable: false,
  settings: null,
  demoSeed: null,
  subsystemDegraded: false,
  refresh: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updateSettings: vi.fn(),
};

function mockAuth(overrides: Partial<AuthApi> = {}) {
  useAuthMock.mockReturnValue({ ...BASE_AUTH, ...overrides });
}

function renderWall(overrides: Partial<AuthApi> = {}) {
  mockAuth(overrides);
  return render(
    <MemoryRouter>
      <RequireAuth surface="the scanner">
        <div data-testid="protected-child">protected</div>
      </RequireAuth>
    </MemoryRouter>,
  );
}

describe('RequireAuth — the three branches (quiet fill / children / wall)', () => {
  it('AC-A2a — while !ready the gated route shows the quiet fill, never the wall, never null', () => {
    const { container } = renderWall({ ready: false, authenticated: false });
    expect(screen.getByTestId('route-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('require-auth-wall')).toBeNull();
    expect(container.textContent).not.toMatch(/sign(ed)? ?(in|out)/i);
  });

  it('AC-A2 — an authenticated trader sees the children, never the wall', () => {
    renderWall({ ready: true, authenticated: true });
    expect(screen.getByTestId('protected-child')).toBeInTheDocument();
    expect(screen.queryByTestId('require-auth-wall')).toBeNull();
  });

  it('normal branch: the shipped heading, and neither the degraded line nor Try again', () => {
    renderWall({ ready: true, authenticated: false, subsystemDegraded: false });
    expect(screen.getByTestId('require-auth-wall')).toBeInTheDocument();
    expect(screen.getByText('Sign in to open the scanner')).toBeInTheDocument();
    expect(screen.queryByText(AUTH_COPY.gate.sessionUnknown)).toBeNull();
    expect(screen.queryByText(AUTH_COPY.gate.unavailable)).toBeNull();
    expect(screen.queryByTestId('require-auth-retry')).toBeNull();
  });

  it('degraded: the degraded literal is PRESENT and the identity heading is ABSENT', () => {
    renderWall({ ready: true, authenticated: false, subsystemDegraded: true });
    expect(screen.getByText(AUTH_COPY.gate.sessionUnknown)).toBeInTheDocument();
    expect(screen.getByText(AUTH_COPY.gate.unavailable)).toBeInTheDocument();
    expect(screen.queryByText('Sign in to open the scanner')).toBeNull();
    expect(screen.queryByText(/^Sign in to open /)).toBeNull();
    // The policy caption and the two offers survive the degradation.
    expect(screen.getByTestId('require-auth-policy')).toHaveTextContent(/new sign-ups are closed/);
    expect(screen.getByTestId('require-auth-ticker')).toHaveAttribute('href', '/ticker');
  });

  it('AC-A9 — Try again retries ONLY when pressed', async () => {
    const refresh = vi.fn();
    renderWall({ ready: true, authenticated: false, subsystemDegraded: true, refresh });
    expect(refresh).not.toHaveBeenCalled(); // no effect, no timer
    await userEvent.setup().click(screen.getByTestId('require-auth-retry'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
