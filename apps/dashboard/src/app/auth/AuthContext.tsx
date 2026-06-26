/**
 * AuthProvider / useAuth — the single source of auth truth for the FE (FRONTEND_EXECUTION_CONTRACT
 * §2/§3, UX_BLUEPRINT §1/§2.1). It owns the ONE server-authoritative who-am-I read (`getSession`),
 * resolves anonymous-vs-signed-in on mount + after every auth transition, and exposes the identity,
 * the `google_available` flag, the per-user settings, and the auth actions.
 *
 * The central invariants this enforces:
 *  - **who-am-I is non-blocking** (§3): the provider renders children IMMEDIATELY (anonymous-capable)
 *    while the read is in flight. There is NO full-page auth spinner; the trader path never waits.
 *  - **subsystem-degraded ⇒ anonymous** (AC-J1): a who-am-I transport fault resolves to anonymous +
 *    sets a transient `subsystemDegraded` flag. That flag drives ONLY the gated-action "couldn't
 *    reach sign-in" copy — NEVER the bundle/SSE/trader path.
 *  - **server-wins settings, per-account isolated** (D7, AC-F2): the carried settings come straight
 *    from who-am-I; the FE never overwrites the server value from local state on each login.
 *  - **no secret ever stored** (AC-H1/H2): only the `SessionStatus` shape is held — no password,
 *    session id, signing key, or secret is ever in scope here.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import {
  getSession, login as apiLogin, signup as apiSignup, logout as apiLogout, saveSettings as apiSave,
  type SessionStatus, type AuthUser, type UserSettings, type LoginRequest, type SignupRequest,
} from '@org/api';

export interface AuthState {
  /** false until the first who-am-I resolves (drives the account-control loading placeholder ONLY). */
  ready: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  /** D9 config flag from who-am-I; drives the present-disabled↔present-enabled Google control. */
  googleAvailable: boolean;
  /** Server settings when signed in; null when anonymous (the FE then uses client-local stores). */
  settings: UserSettings | null;
  /** Transient: who-am-I failed/unreachable ⇒ treat as anonymous AND surface the degraded copy on
   *  gated actions only (NEVER the trader path). */
  subsystemDegraded: boolean;
}

export interface AuthApi extends AuthState {
  /** Re-read who-am-I (after a transition). Resolves to anonymous on a transport fault. */
  refresh: () => Promise<void>;
  /** Throws an `AuthError` on failure (the form maps the code → copy). Succeeds ⇒ state flips signed-in. */
  signIn: (body: LoginRequest) => Promise<void>;
  signUp: (body: SignupRequest) => Promise<void>;
  /** Idempotent; flips to anonymous (re-reads who-am-I). */
  signOut: () => Promise<void>;
  /** Persist a settings patch (server-wins). Throws on failure so the caller can revert. No-op +
   *  throw when anonymous would be wrong here — callers only invoke this when signed in. */
  updateSettings: (patch: Partial<UserSettings>) => Promise<UserSettings>;
}

const ANON: AuthState = {
  ready: false, authenticated: false, user: null, googleAvailable: false, settings: null,
  subsystemDegraded: false,
};

const AuthContext = createContext<AuthApi | null>(null);

function applySession(s: SessionStatus): AuthState {
  return {
    ready: true,
    authenticated: s.authenticated,
    user: s.user,
    googleAvailable: s.google_available,
    settings: s.settings,
    subsystemDegraded: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(ANON);
  // Guard against a stale resolve overwriting a newer one (e.g. logout completes before an in-flight
  // mount read). Each read tags itself; only the latest applies.
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    try {
      const s = await getSession();
      if (seq.current === id) setState(applySession(s));
    } catch {
      // Transport fault ⇒ anonymous + degraded. NEVER throws into the trader path.
      if (seq.current === id) {
        setState({
          ready: true, authenticated: false, user: null, googleAvailable: false, settings: null,
          subsystemDegraded: true,
        });
      }
    }
  }, []);

  // One who-am-I on mount. Children render immediately (anonymous-capable) while it's in flight.
  useEffect(() => { void refresh(); }, [refresh]);

  const signIn = useCallback(async (body: LoginRequest) => {
    const s = await apiLogin(body); // throws AuthError on failure (form maps the code)
    seq.current++; // invalidate any in-flight who-am-I
    setState(applySession(s));
  }, []);

  const signUp = useCallback(async (body: SignupRequest) => {
    const s = await apiSignup(body);
    seq.current++;
    setState(applySession(s));
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout(); // idempotent, best-effort
    await refresh();   // re-read who-am-I ⇒ anonymous
  }, [refresh]);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    const saved = await apiSave(patch); // throws on failure → caller reverts
    setState((prev) => (prev.authenticated ? { ...prev, settings: saved } : prev));
    return saved;
  }, []);

  const api = useMemo<AuthApi>(
    () => ({ ...state, refresh, signIn, signUp, signOut, updateSettings }),
    [state, refresh, signIn, signUp, signOut, updateSettings],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

/** Consume the auth state + actions. Outside a provider it returns a stable anonymous-capable stub so
 *  surfaces that may render in isolation (tests, storybook) never crash — they just behave anonymous. */
export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  return {
    ...ANON, ready: true,
    refresh: async () => undefined,
    signIn: async () => undefined,
    signUp: async () => undefined,
    signOut: async () => undefined,
    updateSettings: async () => ({ active_persona_id: null, default_ticker: null, theme: 'dark' }),
  };
}
