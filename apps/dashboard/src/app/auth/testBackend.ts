/**
 * Shared controllable mock backend for the auth test suite (the NETWORK BOUNDARY — never a live
 * backend). It stubs `fetch` + `EventSource` and emits exactly the INTERFACE_CONTRACT shapes for
 * who-am-I / signup / login / logout / settings / the gated-action outcomes + the trader bundle/SSE.
 *
 * It is mutable per-test: `setSession(...)` flips who-am-I (anonymous ↔ identity-X ↔ identity-Y),
 * `setGoogle(bool)` flips the config flag, `failSession()` simulates a who-am-I transport fault, and
 * the auth-write handlers can be told to 409/422/401/503 to drive every error state.
 */
import { vi } from 'vitest';
import type {
  SessionStatus, UserSettings, TickerBundle, StrikeRow,
} from '@org/api';

export interface AuthBackendState {
  session: SessionStatus;
  sessionFails: boolean;             // who-am-I transport fault ⇒ FE degrades to anonymous
  signup: 'ok' | 'email_taken' | 'validation' | 'auth_unavailable';
  login: 'ok' | 'bad_credentials' | 'validation' | 'auth_unavailable';
  settingsWrite: 'ok' | 'auth_required' | 'auth_unavailable' | 'validation';
  // The gated-action server outcomes (ai-rec POST / a hypothetical positions write).
  gatedAction: 'ok' | 'auth_required' | 'auth_unavailable';
  passwordFloor: number;             // surfaced in the 422 signup message
}

export interface AuthBackend {
  state: AuthBackendState;
  calls: { session: number; signup: number; login: number; logout: number; settingsPut: number; ticker: number; recPost: number; simTradeGate: number };
  /** Capture the URLs/inits the bundle path was called with (for the no-new-header/param assertion). */
  tickerCalls: { url: string; init?: RequestInit }[];
  recPostInits: RequestInit[];
  setSession(s: Partial<SessionStatus>): void;
  setUser(opts: { id: string; email: string; settings?: UserSettings | null; display_name?: string | null }): void;
  setAnonymous(): void;
  setGoogle(available: boolean): void;
  failSession(): void;
  healSession(): void;
}

export function anonSession(googleAvailable = false): SessionStatus {
  return { authenticated: false, user: null, google_available: googleAvailable, settings: null };
}

export function userSession(
  id: string,
  email: string,
  settings: UserSettings | null = { active_persona_id: null, default_ticker: null, theme: 'dark' },
  opts: { googleAvailable?: boolean; display_name?: string | null; auth_methods?: string[] } = {},
): SessionStatus {
  return {
    authenticated: true,
    user: {
      id, email,
      display_name: opts.display_name ?? null,
      auth_methods: opts.auth_methods ?? ['password'],
    },
    google_available: opts.googleAvailable ?? false,
    settings,
  };
}

function strike(s: number): StrikeRow {
  return {
    strike: s, net_gex: 0, call_gex: 0, put_gex: 0, call_oi: 10, put_oi: 10, total_oi: 20,
    net_dex: 0, call_dex: 0, put_dex: 0, volume: 5, vol_oi_ratio: 0.25,
  };
}

export function makeBundle(): TickerBundle {
  const snap = '2026-06-26T14:00:00Z';
  return {
    market_state: {
      ticker: 'TSLA', price: 250.5, gex_spot: 250, timestamp: 1_700_000_000, timestamp_iso: snap,
      call_wall: 260, put_wall: 240, peak_gex_strike: 255, gamma_flip: 248, max_pain: 250,
      max_pain_expiration: '2026-06-26', net_gex: 1.2e9, call_gex: 2e9, put_gex: -0.8e9, total_gex: 1.2e9,
      net_dex: 5e8, call_dex: 6e8, put_dex: -1e8, net_vanna: null, net_charm: null, net_volga: null,
      vwap: 249, vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null,
      dte_min: 7, dte_max: 45, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.12, net_flow: null,
      put_call_ratio: 0.8, chain_vol_oi_ratio: 0.5, total_volume: 100_000, vol_oi_unusual_threshold: 1,
      iv_skew: null, term_structure: null,
    },
    signals: {
      ticker: 'TSLA', regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral', distances: {},
      setups: [], opportunity_score: 42, opportunity_tier: 'watch', prime_prompt_eligible: false,
    },
    strike_profile: { ticker: 'TSLA', spot: 250.5, strikes: [strike(255), strike(260), strike(265)] },
    expirations: [{ date: '2026-06-26', dte: 3 }, { date: '2026-07-18', dte: 25 }],
    ai_eval: { ready: true, reasons: [], changed: true, state_fingerprint: 'fp-A', score_threshold: 50 },
    meta: {
      served_at: snap,
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: { snapshot_iso: snap, data_age_seconds: 30, stale: false, stale_after_seconds: 600 },
    },
    off_exchange: {
      ratio_pct: 38, offex_shares: 38_000, total_shares: 100_000, levels: [], blocks: [],
      block_min_shares: 5000, note: '',
    },
    position_eval: null,
  };
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

export function installAuthBackend(initial: Partial<AuthBackendState> = {}): AuthBackend {
  const state: AuthBackendState = {
    session: initial.session ?? anonSession(),
    sessionFails: initial.sessionFails ?? false,
    signup: initial.signup ?? 'ok',
    login: initial.login ?? 'ok',
    settingsWrite: initial.settingsWrite ?? 'ok',
    gatedAction: initial.gatedAction ?? 'ok',
    passwordFloor: initial.passwordFloor ?? 8,
  };
  const calls = { session: 0, signup: 0, login: 0, logout: 0, settingsPut: 0, ticker: 0, recPost: 0, simTradeGate: 0 };
  const tickerCalls: { url: string; init?: RequestInit }[] = [];
  const recPostInits: RequestInit[] = [];

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() { /* no-op */ }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  const authErr = (code: string, message: string, status: number) => json({ error: code, message }, status);

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    // ---- who-am-I -----------------------------------------------------------------------------
    if (url.includes('/api/auth/session')) {
      calls.session++;
      if (state.sessionFails) return json({ error: 'auth_unavailable' }, 503);
      return json(state.session);
    }
    // ---- signup -------------------------------------------------------------------------------
    if (url.includes('/api/auth/signup')) {
      calls.signup++;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (state.signup === 'email_taken') return authErr('email_taken', 'That email is already registered.', 409);
      if (state.signup === 'validation') {
        return authErr('validation', `Password must be at least ${state.passwordFloor} characters.`, 422);
      }
      if (state.signup === 'auth_unavailable') return authErr('auth_unavailable', 'auth down', 503);
      const sess = userSession(
        'u-new', body.email, { active_persona_id: null, default_ticker: null, theme: 'dark' },
        { display_name: body.display_name ?? null, googleAvailable: state.session.google_available },
      );
      state.session = sess;
      return json(sess);
    }
    // ---- login --------------------------------------------------------------------------------
    if (url.includes('/api/auth/login')) {
      calls.login++;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (state.login === 'bad_credentials') {
        // The 401 message MUST NOT enumerate (identical for unknown-email vs wrong-password).
        return authErr('bad_credentials', 'Invalid credentials.', 401);
      }
      if (state.login === 'validation') return authErr('validation', 'Enter a valid email address.', 422);
      if (state.login === 'auth_unavailable') return authErr('auth_unavailable', 'auth down', 503);
      // Success ⇒ identity. Default to the existing session's user if one is staged, else a generic one.
      const sess = state.session.authenticated
        ? state.session
        : userSession('u-login', body.email, { active_persona_id: null, default_ticker: null, theme: 'dark' },
            { googleAvailable: state.session.google_available });
      state.session = { ...sess, authenticated: true };
      return json(state.session);
    }
    // ---- logout -------------------------------------------------------------------------------
    if (url.includes('/api/auth/logout')) {
      calls.logout++;
      state.session = anonSession(state.session.google_available);
      return json({});
    }
    // ---- settings write -----------------------------------------------------------------------
    if (url.includes('/api/auth/settings') && method === 'PUT') {
      calls.settingsPut++;
      if (state.settingsWrite === 'auth_required') return authErr('auth_required', 'Sign in to do this.', 401);
      if (state.settingsWrite === 'auth_unavailable') return authErr('auth_unavailable', 'auth down', 503);
      if (state.settingsWrite === 'validation') return authErr('validation', 'bad theme', 422);
      const patch = init?.body ? JSON.parse(String(init.body)) : {};
      const cur = state.session.settings ?? { active_persona_id: null, default_ticker: null, theme: 'dark' as const };
      const next: UserSettings = { ...cur, ...patch };
      state.session = { ...state.session, settings: next };
      return json(next);
    }
    // ---- Positions sim-trade SERVER GATE (D6e/AC-E7) ------------------------------------------
    // The server-enforced auth gate the FE awaits BEFORE a local Positions sim-trade write. Reuses
    // the shared `gatedAction` outcome (same auth class as the ai-rec gate): 200 {authorized:true}
    // signed-in, 403 auth_required when the (stale-cookie / bypassed-FE) session is invalid, 503 on
    // an auth-subsystem fault. Empty body — positions data stays client-local.
    if (url.includes('/api/positions/sim-trade/gate') && method === 'POST') {
      calls.simTradeGate++;
      if (state.gatedAction === 'auth_required') return authErr('auth_required', 'Sign in to do this.', 403);
      if (state.gatedAction === 'auth_unavailable') return authErr('auth_unavailable', 'auth down', 503);
      return json({ authorized: true });
    }
    // ---- trader bundle (UNTOUCHED by auth) ----------------------------------------------------
    if (url.includes('/api/ticker/')) {
      calls.ticker++;
      tickerCalls.push({ url, init });
      return json(makeBundle());
    }
    // ---- ai-rec status / export / personas / contract (anonymous-usable floors) ---------------
    if (url.includes('/api/recommendation/status/')) {
      return json({
        availability: { in_app_enabled: true },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
      });
    }
    if (url.includes('/api/recommendation/export/')) {
      return json({
        ticker: 'TSLA', as_of: '2026-06-26T14:00:00Z', context: { gamma_flip: 248 },
        persona_prompt: 'prompt', glossary: 'glossary', egress_note: 'note',
      });
    }
    if (url.includes('/api/recommendation/') && method === 'POST') {
      calls.recPost++;
      recPostInits.push(init ?? {});
      // The ai-rec invoke gains the auth gate as its OUTERMOST precondition (D6f).
      if (state.gatedAction === 'auth_required') return authErr('auth_required', 'Sign in to do this.', 403);
      if (state.gatedAction === 'auth_unavailable') return authErr('auth_unavailable', 'auth down', 503);
      return json({
        status: 'produced',
        persona: { id: null, name: 'Default (no persona)' },
        as_of: '2026-06-26T14:00:00Z', pinned_fingerprint: 'fp-A', stale_born: false,
        strategy: {
          decision: 'trade', bias: 'long', structure: 'call', strikes: [260], expiration: '2026-07-18',
          entry_trigger: 'break', invalidation_level: 242, max_risk: '$300', position_size: '2',
          exit_plan: { target: 12, stop: 6 }, time_horizon: '5d', confidence: 'medium', rationale: 'edge',
        },
        unavailable_reason: null,
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 49, resets_at: '2026-06-27T04:00:00Z' },
      });
    }
    if (url.includes('/api/personas')) return json([]);
    if (url.includes('/api/contract/')) return json({ detail: 'not found' }, 404);

    return json({ detail: 'unmocked' }, 404);
  }));

  const backend: AuthBackend = {
    state, calls, tickerCalls, recPostInits,
    setSession(s) { state.session = { ...state.session, ...s }; },
    setUser({ id, email, settings = { active_persona_id: null, default_ticker: null, theme: 'dark' }, display_name = null }) {
      state.session = userSession(id, email, settings, { display_name, googleAvailable: state.session.google_available });
    },
    setAnonymous() { state.session = anonSession(state.session.google_available); },
    setGoogle(available) { state.session = { ...state.session, google_available: available }; },
    failSession() { state.sessionFails = true; },
    healSession() { state.sessionFails = false; },
  };
  return backend;
}

export function uninstallAuthBackend() {
  vi.unstubAllGlobals();
}
