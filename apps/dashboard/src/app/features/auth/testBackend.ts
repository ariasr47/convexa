/**
 * Shared controllable mock backend for the auth test suite (the NETWORK BOUNDARY — never a live
 * backend). It stubs `fetch` + `EventSource` and emits exactly the INTERFACE_CONTRACT shapes for
 * who-am-I / signup / login / logout / settings / the gated-action outcomes + the trader bundle/SSE.
 *
 * It is mutable per-test: `setSession(...)` flips who-am-I (anonymous ↔ identity-X ↔ identity-Y),
 * `setGoogle(bool)` flips the config flag, `failSession()` simulates a who-am-I transport fault, and
 * the auth-write handlers can be told to 409/422/401/503 to drive every error state.
 */
import type { SessionStatus, StrikeRow, TickerBundle, UserSettings } from '@convexa/api';
import { vi } from 'vitest';

/** byo-ai-key: how the rec POST resolves the key (the 5 observable states a–e). Each maps to the
 *  INTERFACE_CONTRACT §3 wire shape. `transport` simulates a network fault on the POST. */
export type RecKeyState =
  | 'produced_own' // (d) produced + key_source own_key
  | 'produced_shared' // (b) produced + key_source shared_admin + remaining_free_uses/total
  | 'no_key' // (a) unavailable + no_key (regular)
  | 'over_limit' // (c) unavailable + over_limit (admin exhausted)
  | 'shared_unconfigured' // (e) unavailable + shared_key_unconfigured (admin, no shared key)
  | 'transport'; // a network fault → the FE-synthesized unavailable

/** byo-ai-key: the masked-hint the GET ai-key read returns (NEVER a raw key). */
export interface AiKeyBackendState {
  set: boolean;
  last4: string | null;
  storage_available: boolean;
  put: 'ok' | 'auth_required' | 'validation' | 'transport'; // PUT outcome (storage-unavailable is a 200 `set:false`)
}

export interface AuthBackendState {
  session: SessionStatus;
  sessionFails: boolean; // who-am-I transport fault ⇒ FE degrades to anonymous
  signup: 'ok' | 'email_taken' | 'validation' | 'auth_unavailable';
  login: 'ok' | 'bad_credentials' | 'validation' | 'auth_unavailable';
  settingsWrite: 'ok' | 'auth_required' | 'auth_unavailable' | 'validation';
  // The gated-action server outcomes (ai-rec POST / a hypothetical positions write).
  gatedAction: 'ok' | 'auth_required' | 'auth_unavailable';
  passwordFloor: number; // surfaced in the 422 signup message
  // byo-ai-key — how the rec POST resolves the key + the per-admin allowance + the stored-key read.
  recKey: RecKeyState;
  remainingFreeUses: number; // the count the NEXT produced_shared rec returns (post-decrement)
  freeUsesTotal: number; // the per-admin allowance
  aiKey: AiKeyBackendState;
}

export interface AuthBackend {
  state: AuthBackendState;
  calls: {
    session: number;
    signup: number;
    login: number;
    logout: number;
    settingsPut: number;
    ticker: number;
    recPost: number;
    simTradeGate: number;
    aiKeyGet: number;
    aiKeyPut: number;
    aiKeyDelete: number;
  };
  /** Capture the URLs/inits the bundle path was called with (for the no-new-header/param assertion). */
  tickerCalls: { url: string; init?: RequestInit }[];
  recPostInits: RequestInit[];
  /** Capture EVERY ai-key PUT body (egress assertion: the raw key rides ONLY here, browser→server). */
  aiKeyPutBodies: string[];
  /** Capture EVERY response body the FE ever received from a key-flow endpoint (egress: no raw key). */
  keyFlowResponses: string[];
  setSession(s: Partial<SessionStatus>): void;
  setUser(opts: {
    id: string;
    email: string;
    settings?: UserSettings | null;
    display_name?: string | null;
  }): void;
  setAnonymous(): void;
  setGoogle(available: boolean): void;
  failSession(): void;
  healSession(): void;
  /** byo-ai-key — flip how the next rec POST resolves the key (the a–e state machine). */
  setRecKey(state: RecKeyState, opts?: { remaining?: number; total?: number }): void;
  /** byo-ai-key — set the stored masked-key read (drives the Settings Empty/Set/storage state). */
  setAiKeyStored(s: Partial<AiKeyBackendState>): void;
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
      id,
      email,
      display_name: opts.display_name ?? null,
      auth_methods: opts.auth_methods ?? ['password'],
    },
    google_available: opts.googleAvailable ?? false,
    settings,
  };
}

function strike(s: number): StrikeRow {
  return {
    strike: s,
    net_gex: 0,
    call_gex: 0,
    put_gex: 0,
    call_oi: 10,
    put_oi: 10,
    total_oi: 20,
    net_dex: 0,
    call_dex: 0,
    put_dex: 0,
    volume: 5,
    vol_oi_ratio: 0.25,
  };
}

export function makeBundle(): TickerBundle {
  const snap = '2026-06-26T14:00:00Z';
  return {
    market_state: {
      ticker: 'TSLA',
      price: 250.5,
      gex_spot: 250,
      timestamp: 1_700_000_000,
      timestamp_iso: snap,
      call_wall: 260,
      put_wall: 240,
      peak_gex_strike: 255,
      gamma_flip: 248,
      max_pain: 250,
      max_pain_expiration: '2026-06-26',
      net_gex: 1.2e9,
      call_gex: 2e9,
      put_gex: -0.8e9,
      total_gex: 1.2e9,
      net_dex: 5e8,
      call_dex: 6e8,
      put_dex: -1e8,
      net_vanna: null,
      net_charm: null,
      net_volga: null,
      vwap: 249,
      vwap_upper_2: null,
      vwap_upper_3: null,
      vwap_lower_2: null,
      vwap_lower_3: null,
      dte_min: 7,
      dte_max: 45,
      atm_iv: 45,
      hv_30d: 40,
      iv_hv_ratio: 1.12,
      net_flow: null,
      put_call_ratio: 0.8,
      chain_vol_oi_ratio: 0.5,
      total_volume: 100_000,
      vol_oi_unusual_threshold: 1,
      iv_skew: null,
      term_structure: null,
      dealer_flow_projection: null,
    },
    signals: {
      ticker: 'TSLA',
      regime: 'positive_gamma',
      regime_note: null,
      vol_regime: 'neutral',
      distances: {},
      setups: [],
      opportunity_score: 42,
      opportunity_tier: 'watch',
      prime_prompt_eligible: false,
    },
    strike_profile: {
      ticker: 'TSLA',
      spot: 250.5,
      strikes: [strike(255), strike(260), strike(265)],
    },
    expirations: [
      { date: '2026-06-26', dte: 3 },
      { date: '2026-07-18', dte: 25 },
    ],
    ai_eval: {
      ready: true,
      reasons: [],
      changed: true,
      state_fingerprint: 'fp-A',
      score_threshold: 50,
    },
    meta: {
      served_at: snap,
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: {
        snapshot_iso: snap,
        data_age_seconds: 30,
        stale: false,
        stale_after_seconds: 600,
      },
    },
    off_exchange: {
      ratio_pct: 38,
      offex_shares: 38_000,
      total_shares: 100_000,
      levels: [],
      blocks: [],
      block_min_shares: 5000,
      note: '',
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
    recKey: initial.recKey ?? 'produced_own',
    remainingFreeUses: initial.remainingFreeUses ?? 3,
    freeUsesTotal: initial.freeUsesTotal ?? 3,
    aiKey: initial.aiKey ?? { set: false, last4: null, storage_available: true, put: 'ok' },
  };
  const calls = {
    session: 0,
    signup: 0,
    login: 0,
    logout: 0,
    settingsPut: 0,
    ticker: 0,
    recPost: 0,
    simTradeGate: 0,
    aiKeyGet: 0,
    aiKeyPut: 0,
    aiKeyDelete: 0,
  };
  const tickerCalls: { url: string; init?: RequestInit }[] = [];
  const recPostInits: RequestInit[] = [];
  const aiKeyPutBodies: string[] = [];
  const keyFlowResponses: string[] = [];

  // Wrap a response so its body is recorded for the egress assertions (no raw key ever returned).
  const keyJson = (b: unknown, status = 200) => {
    keyFlowResponses.push(JSON.stringify(b));
    return json(b, status);
  };

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  const authErr = (code: string, message: string, status: number) =>
    json({ error: code, message }, status);

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
        if (state.signup === 'email_taken')
          return authErr('email_taken', 'That email is already registered.', 409);
        if (state.signup === 'validation') {
          return authErr(
            'validation',
            `Password must be at least ${state.passwordFloor} characters.`,
            422,
          );
        }
        if (state.signup === 'auth_unavailable')
          return authErr('auth_unavailable', 'auth down', 503);
        const sess = userSession(
          'u-new',
          body.email,
          { active_persona_id: null, default_ticker: null, theme: 'dark' },
          {
            display_name: body.display_name ?? null,
            googleAvailable: state.session.google_available,
          },
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
        if (state.login === 'validation')
          return authErr('validation', 'Enter a valid email address.', 422);
        if (state.login === 'auth_unavailable')
          return authErr('auth_unavailable', 'auth down', 503);
        // Success ⇒ identity. Default to the existing session's user if one is staged, else a generic one.
        const sess = state.session.authenticated
          ? state.session
          : userSession(
              'u-login',
              body.email,
              { active_persona_id: null, default_ticker: null, theme: 'dark' },
              { googleAvailable: state.session.google_available },
            );
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
        if (state.settingsWrite === 'auth_required')
          return authErr('auth_required', 'Sign in to do this.', 401);
        if (state.settingsWrite === 'auth_unavailable')
          return authErr('auth_unavailable', 'auth down', 503);
        if (state.settingsWrite === 'validation') return authErr('validation', 'bad theme', 422);
        const patch = init?.body ? JSON.parse(String(init.body)) : {};
        const cur = state.session.settings ?? {
          active_persona_id: null,
          default_ticker: null,
          theme: 'dark' as const,
        };
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
        if (state.gatedAction === 'auth_required')
          return authErr('auth_required', 'Sign in to do this.', 403);
        if (state.gatedAction === 'auth_unavailable')
          return authErr('auth_unavailable', 'auth down', 503);
        return json({ authorized: true });
      }
      // ---- byo-ai-key credential endpoints (write-only key; masked-hint read) -------------------
      if (url.includes('/api/auth/ai-key')) {
        // All three sit behind the auth gate — anonymous ⇒ 403 auth_required (never a key state).
        if (!state.session.authenticated)
          return keyJson({ error: 'auth_required', message: 'sign in' }, 403);
        if (method === 'GET') {
          calls.aiKeyGet++;
          // The read returns ONLY the masked hint (set/last4/storage_available) — NEVER the key.
          return keyJson({
            set: state.aiKey.set,
            last4: state.aiKey.set ? state.aiKey.last4 : null,
            storage_available: state.aiKey.storage_available,
          });
        }
        if (method === 'PUT') {
          calls.aiKeyPut++;
          const body = String(init?.body ?? '');
          aiKeyPutBodies.push(body);
          if (state.aiKey.put === 'transport') return new Response('', { status: 502 });
          if (state.aiKey.put === 'auth_required')
            return keyJson({ error: 'auth_required', message: 'sign in' }, 403);
          if (state.aiKey.put === 'validation')
            return keyJson({ error: 'validation', message: 'bad key' }, 422);
          if (state.aiKey.storage_available === false) {
            // Storage unavailable is a contained 200 `set:false`, NEVER a 5xx (AC-18).
            return keyJson({ set: false, storage_available: false });
          }
          // Store the masked LAST-4 derived from the raw key — the raw key is NEVER echoed back.
          const parsed = body ? (JSON.parse(body) as { key?: string }) : {};
          const raw = parsed.key ?? '';
          state.aiKey = { ...state.aiKey, set: true, last4: raw.slice(-4) };
          return keyJson({ set: true, last4: state.aiKey.last4, storage_available: true });
        }
        if (method === 'DELETE') {
          calls.aiKeyDelete++;
          state.aiKey = { ...state.aiKey, set: false, last4: null };
          return keyJson({
            set: false,
            last4: null,
            storage_available: state.aiKey.storage_available,
          });
        }
      }
      // ---- trader bundle (UNTOUCHED by auth) ----------------------------------------------------
      if (url.includes('/api/ticker/')) {
        calls.ticker++;
        tickerCalls.push({ url, init });
        return json(makeBundle());
      }
      // ---- ai-rec status / export / personas / contract (anonymous-usable floors) ---------------
      if (url.includes('/api/recommendation/status/')) {
        // byo-ai-key: an admin shared-key path pre-renders its count; regular users carry no counter.
        const adminShared = state.recKey === 'produced_shared' || state.recKey === 'over_limit';
        return keyJson({
          availability: { in_app_enabled: true },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
          ...(adminShared
            ? { remaining_free_uses: state.remainingFreeUses, free_uses_total: state.freeUsesTotal }
            : {}),
        });
      }
      if (url.includes('/api/recommendation/export/')) {
        // The export floor egress shape — context + persona prompt + glossary + egress_note ONLY.
        return keyJson({
          ticker: 'TSLA',
          as_of: '2026-06-26T14:00:00Z',
          context: { gamma_flip: 248 },
          persona_prompt: 'prompt',
          glossary: 'glossary',
          egress_note:
            'No other ticker, no account or identity, no broker/order data, and no API key ever leave.',
        });
      }
      if (url.includes('/api/recommendation/') && method === 'POST') {
        calls.recPost++;
        recPostInits.push(init ?? {});
        // The ai-rec invoke gains the auth gate as its OUTERMOST precondition (D6f).
        if (state.gatedAction === 'auth_required')
          return authErr('auth_required', 'Sign in to do this.', 403);
        if (state.gatedAction === 'auth_unavailable')
          return authErr('auth_unavailable', 'auth down', 503);
        if (state.recKey === 'transport') return new Response('', { status: 502 });

        const base = {
          persona: { id: null, name: 'Default (no persona)' },
          as_of: '2026-06-26T14:00:00Z',
          pinned_fingerprint: 'fp-A',
          stale_born: false,
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 49, resets_at: '2026-06-27T04:00:00Z' },
        };
        const strategy = {
          decision: 'trade',
          bias: 'long',
          structure: 'call',
          strikes: [260],
          expiration: '2026-07-18',
          entry_trigger: 'break',
          invalidation_level: 242,
          max_risk: '$300',
          position_size: '2',
          exit_plan: { target: 12, stop: 6 },
          time_horizon: '5d',
          confidence: 'medium',
          rationale: 'edge',
        };

        // byo-ai-key — the 5 observable wire shapes (INTERFACE_CONTRACT §3).
        if (state.recKey === 'produced_own') {
          return keyJson({
            ...base,
            status: 'produced',
            strategy,
            unavailable_reason: null,
            key_source: 'own_key',
          });
        }
        if (state.recKey === 'produced_shared') {
          // Decrement ONLY on a produced shared rec; the returned value is the post-decrement count.
          state.remainingFreeUses = Math.max(0, state.remainingFreeUses - 1);
          return keyJson({
            ...base,
            status: 'produced',
            strategy,
            unavailable_reason: null,
            key_source: 'shared_admin',
            remaining_free_uses: state.remainingFreeUses,
            free_uses_total: state.freeUsesTotal,
          });
        }
        if (state.recKey === 'no_key') {
          return keyJson({
            ...base,
            status: 'unavailable',
            strategy: null,
            unavailable_reason: 'no_key',
            key_source: 'none',
          });
        }
        if (state.recKey === 'over_limit') {
          // An LLM-failed shared call does NOT decrement; the exhausted state holds at 0 (AC-17).
          return keyJson({
            ...base,
            status: 'unavailable',
            strategy: null,
            unavailable_reason: 'over_limit',
            key_source: 'none',
            remaining_free_uses: 0,
            free_uses_total: state.freeUsesTotal,
          });
        }
        // shared_unconfigured (e)
        return keyJson({
          ...base,
          status: 'unavailable',
          strategy: null,
          unavailable_reason: 'shared_key_unconfigured',
          key_source: 'none',
        });
      }
      if (url.includes('/api/personas')) return json([]);
      if (url.includes('/api/contract/')) return json({ detail: 'not found' }, 404);

      return json({ detail: 'unmocked' }, 404);
    }),
  );

  const backend: AuthBackend = {
    state,
    calls,
    tickerCalls,
    recPostInits,
    aiKeyPutBodies,
    keyFlowResponses,
    setSession(s) {
      state.session = { ...state.session, ...s };
    },
    setUser({
      id,
      email,
      settings = { active_persona_id: null, default_ticker: null, theme: 'dark' },
      display_name = null,
    }) {
      state.session = userSession(id, email, settings, {
        display_name,
        googleAvailable: state.session.google_available,
      });
    },
    setAnonymous() {
      state.session = anonSession(state.session.google_available);
    },
    setGoogle(available) {
      state.session = { ...state.session, google_available: available };
    },
    failSession() {
      state.sessionFails = true;
    },
    healSession() {
      state.sessionFails = false;
    },
    setRecKey(s, opts) {
      state.recKey = s;
      if (opts?.remaining != null) state.remainingFreeUses = opts.remaining;
      if (opts?.total != null) state.freeUsesTotal = opts.total;
    },
    setAiKeyStored(s) {
      state.aiKey = { ...state.aiKey, ...s };
    },
  };
  return backend;
}

export function uninstallAuthBackend() {
  vi.unstubAllGlobals();
}
