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
import { seedTestPositionsIfNeeded } from '@/features/trading/positions/testSeed';
import {
  login as apiLogin,
  logout as apiLogout,
  saveSettings as apiSave,
  signup as apiSignup,
  dataMode,
  DEMO_ACCOUNT,
  getSession,
  type AuthUser,
  type LoginRequest,
  type SessionStatus,
  type SignupRequest,
  type UserSettings,
  type UserSettingsPatch,
} from '@convexa/api';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { startOwnerGateSession } from './ownerGate';

export interface AuthState {
  /** false until the first who-am-I resolves (drives the account-control loading placeholder ONLY). */
  ready: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  /** D9 config flag from who-am-I; drives the present-disabled↔present-enabled Google control. */
  googleAvailable: boolean;
  /** Server settings when signed in; null when anonymous (the FE then uses client-local stores). */
  settings: UserSettings | null;
  /** DEV-ONLY: the seeded test account the backend advertises (SEED_TEST_ACCOUNT); null in prod.
   *  Lets the login form pre-fill it so it needn't be typed each time. */
  demoSeed: { email: string } | null;
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
  updateSettings: (patch: UserSettingsPatch) => Promise<UserSettings>;
}

const ANON: AuthState = {
  ready: false,
  authenticated: false,
  user: null,
  googleAvailable: false,
  settings: null,
  demoSeed: null,
  subsystemDegraded: false,
};

/** Demo builds are always signed in to the seed demo account (owner, 2026-10-14), so no demo screen
 *  sits behind a sign-in wall. The account and its settings come from the demo transport's who-am-I,
 *  the same read the live build makes. If that read fails (malformed local demo settings), the
 *  visitor stays signed in on client-local settings rather than dropping to anonymous. */
const DEMO_SIGNED_IN: AuthState = {
  ready: true,
  authenticated: true,
  user: DEMO_ACCOUNT,
  googleAvailable: false,
  settings: null,
  demoSeed: null,
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
    demoSeed: s.demo_seed ?? null,
    subsystemDegraded: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const demo = dataMode === 'demo';
  // Demo: signed in from the first render (`ready` waits for the settings read), so no sign-in
  // copy flashes while who-am-I is in flight.
  const [state, setState] = useState<AuthState>(demo ? { ...DEMO_SIGNED_IN, ready: false } : ANON);
  // Guard against a stale resolve overwriting a newer one (e.g. logout completes before an in-flight
  // mount read). Each read tags itself; only the latest applies.
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    try {
      const s = await getSession();
      if (seq.current === id) setState(applySession(s));
    } catch {
      // Transport fault ⇒ anonymous + degraded (demo: still the demo account). NEVER throws into
      // the trader path.
      if (seq.current === id) {
        setState(
          demo
            ? DEMO_SIGNED_IN
            : {
                ready: true,
                authenticated: false,
                user: null,
                googleAvailable: false,
                settings: null,
                demoSeed: null,
                subsystemDegraded: true,
              },
        );
      }
    }
  }, [demo]);

  // One who-am-I on mount. Children render immediately (anonymous-capable) while it's in flight.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A sign-in or sign-out (or an expired session found by a re-read) is a new session for the owner
  // gate: a refusal the last one met is dropped, and the owner-only surfaces ask again. The FIRST
  // who-am-I answer is not a change: a request sent before it carried the same cookie it reads, so
  // a refusal met while it was in flight (the desk doesn't wait for it) still stands.
  const sessionIdentity = state.ready
    ? state.authenticated
      ? `user:${state.user?.id ?? ''}`
      : 'anonymous'
    : null;
  const lastSessionIdentity = useRef<string | null>(null);
  useEffect(() => {
    if (sessionIdentity === null) return;
    const last = lastSessionIdentity.current;
    lastSessionIdentity.current = sessionIdentity;
    if (last !== null && last !== sessionIdentity) startOwnerGateSession();
  }, [sessionIdentity]);

  // DEV/TEST convenience: when the always-available test account signs in, seed a simulated
  // portfolio into the client-local positions store (once, non-destructively). A no-op for every
  // other account and best-effort — it never blocks or breaks the auth path.
  useEffect(() => {
    if (state.authenticated) seedTestPositionsIfNeeded(state.user?.email);
  }, [state.authenticated, state.user?.email]);

  // Multi-device durable book: after sign-in, pull server blob if newer (best-effort).
  // Dynamic import so bookSync is not forced into the shell/auth chunk (Vite INEFFECTIVE_DYNAMIC_IMPORT).
  useEffect(() => {
    if (demo || !state.authenticated) return;
    void import('@/features/trading/positions/bookSync')
      .then((m) => m.pullServerBook(state.user?.id))
      .catch(() => undefined);
  }, [demo, state.authenticated, state.user?.id]);

  const signIn = useCallback(
    async (body: LoginRequest) => {
      if (demo) throw new Error('Sign-in is unavailable in the public demo.');
      const s = await apiLogin(body); // throws AuthError on failure (form maps the code)
      seq.current++; // invalidate any in-flight who-am-I
      setState(applySession(s));
    },
    [demo],
  );

  const signUp = useCallback(
    async (body: SignupRequest) => {
      if (demo) throw new Error('Sign-up is unavailable in the public demo.');
      const s = await apiSignup(body);
      seq.current++;
      setState(applySession(s));
    },
    [demo],
  );

  const signOut = useCallback(async () => {
    if (demo) return; // the demo has no sign-out; "Reset demo data" restores the seed account
    // The account boundary (audit W-E01): this browser's copy of the synced book must not outlive
    // the session. Push first; drop the local copy only once the server holds it. If the push
    // fails, the copy stays tagged with this account, and the next other account to sign in here
    // drops it (claimBookFor) rather than adopting it.
    const book = await import('@/features/trading/positions/bookSync');
    const pushed = await book.pushLocalBook().catch(() => false);
    await apiLogout(); // idempotent, best-effort
    if (pushed) (await import('@/features/trading/positions/store')).clearSyncedBook();
    await refresh(); // re-read who-am-I ⇒ anonymous
  }, [demo, refresh]);

  const updateSettings = useCallback(async (patch: UserSettingsPatch) => {
    // Demo: the demo transport stores it in this browser's demo workspace.
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
    ...ANON,
    ready: true,
    refresh: async () => undefined,
    signIn: async () => undefined,
    signUp: async () => undefined,
    signOut: async () => undefined,
    updateSettings: async () => ({ active_persona_id: null, default_ticker: null, theme: 'dark' }),
  };
}
