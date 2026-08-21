/**
 * Shared controllable mock backend for the auth test suite (the NETWORK BOUNDARY — never a live
 * backend). It stubs `fetch` + `EventSource` and emits exactly the INTERFACE_CONTRACT shapes for
 * who-am-I / signup / login / logout / settings / the gated-action outcomes + the trader bundle/SSE.
 *
 * It is mutable per-test: `setSession(...)` flips who-am-I (anonymous ↔ identity-X ↔ identity-Y),
 * `setGoogle(bool)` flips the config flag, `failSession()` simulates a who-am-I transport fault, and
 * the auth-write handlers can be told to 409/422/401/503 to drive every error state.
 */
import type {
  AiProvidersBootstrap,
  ByoProvider,
  CandidateBudget,
  CandidateContract,
  CandidateSetEnvelope,
  CapCheck,
  OptionRight,
  RiskInputs,
  SessionStatus,
  StrikeRow,
  TickerBundle,
  UserSettings,
} from '@convexa/api';
import { BYO_PROVIDERS } from '@convexa/api';
import { vi } from 'vitest';

/** How the rec POST resolves powering. Retired `produced_shared` / free-uses states are gone. */
export type RecKeyState =
  | 'produced_own'
  | 'produced_subscription'
  | 'no_key'
  | 'key_unusable'
  | 'key_rejected'
  | 'model_not_in_catalog'
  | 'oauth_expired'
  | 'oauth_unlinked'
  | 'subscription_unavailable'
  | 'transport';

export interface AiProviderSlotState {
  set: boolean;
  last4: string | null;
}

export interface AiKeyBackendState {
  storage_available: boolean;
  put: 'ok' | 'auth_required' | 'validation' | 'transport';
  slots: Record<ByoProvider, AiProviderSlotState>;
  grok: AiProvidersBootstrap['grok'];
  preference: AiProvidersBootstrap['preference'];
  catalog: AiProvidersBootstrap['catalog'];
  /** Legacy single-slot shims used by older tests (`set`/`last4` map to the anthropic row). */
  set?: boolean;
  last4?: string | null;
}

export function defaultAiCatalog(): AiProvidersBootstrap['catalog'] {
  return {
    providers: [
      { provider: 'anthropic', models: [{ id: 'claude-opus-4-8', recommended: true }] },
      { provider: 'openai', models: [{ id: 'gpt-4o', recommended: true }] },
      { provider: 'xai', models: [{ id: 'grok-3', recommended: true }] },
      { provider: 'gemini', models: [{ id: 'gemini-2.0-flash', recommended: true }] },
    ],
    grok_subscription: { provider: 'xai', models: [{ id: 'grok-3', recommended: true }] },
  };
}

export function emptyAiSlots(): Record<ByoProvider, AiProviderSlotState> {
  return {
    anthropic: { set: false, last4: null },
    openai: { set: false, last4: null },
    xai: { set: false, last4: null },
    gemini: { set: false, last4: null },
  };
}

export function makeAiBootstrap(state: AiKeyBackendState): AiProvidersBootstrap {
  return {
    storage_available: state.storage_available,
    providers: BYO_PROVIDERS.map((p) => ({
      provider: p,
      set: state.slots[p].set,
      last4: state.slots[p].set ? state.slots[p].last4 : null,
    })),
    grok: state.grok,
    preference: state.preference,
    catalog: state.catalog,
  };
}

function normalizeAiKeyState(partial?: Partial<AiKeyBackendState>): AiKeyBackendState {
  const slots = emptyAiSlots();
  if (partial?.slots) {
    for (const p of BYO_PROVIDERS) {
      if (partial.slots[p]) slots[p] = { ...slots[p], ...partial.slots[p] };
    }
  }
  if (partial?.set) {
    slots.anthropic = { set: true, last4: partial.last4 ?? slots.anthropic.last4 };
  }
  const catalog = partial?.catalog ?? defaultAiCatalog();
  const recommended =
    catalog.providers[0]?.models.find((m) => m.recommended)?.id ?? 'claude-opus-4-8';
  return {
    storage_available: partial?.storage_available ?? true,
    put: partial?.put ?? 'ok',
    slots,
    grok: partial?.grok ?? { available: false, connected: false, unavailable_reason: null },
    preference: partial?.preference ?? {
      power_path: slots.anthropic.set ? 'own_key' : null,
      provider: slots.anthropic.set ? 'anthropic' : null,
      model: recommended,
    },
    catalog,
  };
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
  // tradeable-rec-inputs — the per-user risk block (server-side, `GET`/`PUT /api/auth/settings`),
  // the candidate-set fixture (`GET /api/candidates/{ticker}`, `sent.candidates`,
  // `context.candidates`), and the cap-check outcome the rec POST's produced-trade branch carries.
  riskInputs: RiskInputs;
  candidates: CandidateSetEnvelope;
  capCheck: CapCheck;
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
    candidatesGet: number;
  };
  /** Capture the URLs/inits the bundle path was called with (for the no-new-header/param assertion). */
  tickerCalls: { url: string; init?: RequestInit }[];
  recPostInits: RequestInit[];
  /** Every rec POST body, parsed-friendly (JSON string) — so a test can assert the open-positions
   *  digest that was actually sent (F10), distinct from `recPostInits` (the raw fetch init). */
  recPostBodies: string[];
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
  /** tradeable-rec-inputs — preset the stored risk block (merges into the current one). */
  setRiskInputs(patch: Partial<RiskInputs>): void;
  /** tradeable-rec-inputs — preset the produced-trade rec's cap-check outcome. */
  setCapCheck(patch: Partial<CapCheck>): void;
  /** tradeable-rec-inputs — preset the candidate-set fixture (merges into the current one). */
  setCandidates(patch: Partial<CandidateSetEnvelope>): void;
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

// ---- tradeable-rec-inputs fixtures (the NETWORK BOUNDARY only) ---------------------------------

/** Mirrors the ONE server-side derivation (INTERFACE_CONTRACT §4) — the mock never lets the client
 *  compute this; it exists here only so a PUT round-trip in the mock returns an honest derived
 *  figure, exactly like the real server would. */
function deriveEffectiveDollarCap(
  accountSize: number | null,
  cap: RiskInputs['per_trade_cap'],
): RiskInputs['effective_dollar_cap'] {
  const derivedFrom = {
    account_size: accountSize,
    cap_value: cap?.value ?? null,
    cap_unit: cap?.unit ?? null,
  };
  if (!cap)
    return { state: 'not_set', value: null, not_derivable_reason: null, derived_from: derivedFrom };
  if (cap.unit === 'usd')
    return {
      state: 'derived',
      value: cap.value,
      not_derivable_reason: null,
      derived_from: derivedFrom,
    };
  // percent
  if (accountSize == null)
    return {
      state: 'not_derivable',
      value: null,
      not_derivable_reason: 'percent_without_account_size',
      derived_from: derivedFrom,
    };
  return {
    state: 'derived',
    value: Math.round(((accountSize * cap.value) / 100) * 100) / 100,
    not_derivable_reason: null,
    derived_from: derivedFrom,
  };
}

export function defaultRiskInputs(): RiskInputs {
  return {
    state: 'not_set',
    account_size: null,
    per_trade_cap: null,
    effective_dollar_cap: deriveEffectiveDollarCap(null, null),
    storage_available: true,
    updated_at: null,
  };
}

/** A bounded, ranked candidate fixture — the §1 envelope shape, reused verbatim by the dedicated
 *  read, `sent.candidates` and `context.candidates` (one computation, many renderings, per contract). */
export function makeCandidatesFixture(
  ticker = 'TSLA',
  budget: CandidateBudget = 'handoff',
): CandidateSetEnvelope {
  const caps =
    budget === 'handoff'
      ? { tenors: 4, rights: 2, strikes_per_tenor_right: 8, max_records: 64, max_bytes: 24_000 }
      : { tenors: 2, rights: 2, strikes_per_tenor_right: 5, max_records: 20, max_bytes: 8_000 };
  const contract = (strike: number, right: OptionRight, quoted = true): CandidateContract => ({
    expiration: '2026-07-18',
    dte: 25,
    strike,
    right,
    distance_pct: Math.round(((strike - 250) / 250) * 10_000) / 100,
    quote_presence: quoted ? 'quoted' : 'no_two_sided_quote',
    bid: quoted ? 4.8 : null,
    ask: quoted ? 5.2 : null,
    mid: quoted ? 5.0 : null,
    spread_abs: quoted ? 0.4 : null,
    spread_pct_of_mid: quoted ? 8 : null,
    open_interest: 500,
    volume: 120,
    iv_state: 'priced',
    iv: 0.32,
    greeks: { delta: right === 'call' ? 0.5 : -0.5, gamma: 0.02, theta: -0.05, vega: 0.12 },
  });
  return {
    ticker,
    state: 'ok',
    as_of: '2026-06-26T14:00:00Z',
    snapshot_age_seconds: 30,
    session_basis: 'after_close',
    quote_age: 'unknown',
    anchor_spot: 250,
    anchor_basis: 'gex_spot',
    band_pct: 15,
    budget,
    sent_to_model: budget === 'prompt',
    caps,
    included: { contracts: 2, expirations: ['2026-07-18'], expiration_count: 1 },
    omitted: {
      total: 0,
      expirations_omitted_by_cap: 0,
      by_reason: {
        outside_window: 0,
        outside_band: 0,
        no_interest: 0,
        expiration_cap: 0,
        strike_cap: 0,
      },
    },
    liquidity: {
      quoted: 2,
      no_two_sided_quote: 0,
      atm_relative_spread_band: 'moderate',
      wide_quotes: false,
      wide_quote_threshold_pct: 15,
    },
    contracts: [contract(250, 'call'), contract(250, 'put')],
  };
}

export function defaultCapCheck(): CapCheck {
  return {
    verdict: 'within',
    effective_dollar_cap: 500,
    cap_not_derivable_reason: null,
    parsed_risk_dollars: 300,
    model_max_risk_text: '$300',
    risk_refusal: null,
  };
}

const defaultStraddleMove = {
  state: 'ok' as const,
  as_of: '2026-06-26T14:00:00Z',
  session_basis: 'after_close' as const,
  anchor_spot: 250,
  anchor_basis: 'gex_spot' as const,
  anchor_label: 'gex_spot',
  primary_expiration: '2026-07-18',
  wide_quote_threshold_pct: 15,
  tenors: [
    {
      expiration: '2026-07-18',
      dte: 25,
      strike_used: 250,
      strike_distance_pct: 0,
      straddle_price: 10,
      move_dollars: 10,
      move_pct: 4,
      basis: 'atm_straddle_mid' as const,
      quote_spread_pct_of_mid: 8,
      wide_quotes: false,
    },
  ],
};

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
      straddle_move: defaultStraddleMove,
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
    aiKey: normalizeAiKeyState(initial.aiKey),
    riskInputs: initial.riskInputs ?? defaultRiskInputs(),
    candidates: initial.candidates ?? makeCandidatesFixture(),
    capCheck: initial.capCheck ?? defaultCapCheck(),
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
    candidatesGet: 0,
  };
  const tickerCalls: { url: string; init?: RequestInit }[] = [];
  const recPostInits: RequestInit[] = [];
  const recPostBodies: string[] = [];
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
        // tradeable-rec-inputs: the risk block always rides the settings a signed-in who-am-I
        // carries — `state.riskInputs` is the single per-user source of truth so a preset via
        // `setRiskInputs` is visible on the very next read (no separate GET endpoint in this tree).
        if (state.session.settings) {
          return json({
            ...state.session,
            settings: { ...state.session.settings, risk_inputs: state.riskInputs },
          });
        }
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
        if ('ai_model' in patch && patch.ai_model === null)
          return authErr('validation', 'clear forbidden', 422);
        if (
          patch.ai_power_path === 'own_key' &&
          !patch.ai_provider &&
          !state.aiKey.preference.provider
        )
          return authErr('validation', 'provider required', 422);
        if ('ai_power_path' in patch || 'ai_provider' in patch || 'ai_model' in patch) {
          const nextPath =
            'ai_power_path' in patch ? patch.ai_power_path : state.aiKey.preference.power_path;
          const nextProvider =
            'ai_provider' in patch ? patch.ai_provider : state.aiKey.preference.provider;
          let nextModel = 'ai_model' in patch ? patch.ai_model : state.aiKey.preference.model;
          const catalog =
            nextPath === 'grok_subscription'
              ? state.aiKey.catalog.grok_subscription.models
              : (state.aiKey.catalog.providers.find((p) => p.provider === nextProvider)?.models ??
                []);
          if (
            ('ai_power_path' in patch || 'ai_provider' in patch) &&
            nextModel &&
            !catalog.some((m) => m.id === nextModel)
          ) {
            nextModel = catalog.find((m) => m.recommended)?.id ?? nextModel;
          }
          state.aiKey.preference = {
            power_path: nextPath,
            provider: nextPath === 'own_key' ? nextProvider : null,
            model: nextModel,
          };
        }
        // ---- tradeable-rec-inputs: the owner-entered risk-inputs patch — server-side refusals are
        // authoritative (INTERFACE_CONTRACT §4); nothing is stored on a refusal.
        if ('risk_inputs' in patch) {
          const rp = (patch.risk_inputs ?? {}) as {
            account_size?: number | null;
            per_trade_cap?: RiskInputs['per_trade_cap'];
          };
          const nextAccountSize =
            'account_size' in rp ? (rp.account_size ?? null) : state.riskInputs.account_size;
          if (rp.account_size !== undefined && rp.account_size !== null) {
            if (!Number.isFinite(rp.account_size) || rp.account_size <= 0)
              return authErr('validation', 'Enter a number greater than zero.', 422);
          }
          if (rp.per_trade_cap !== undefined && rp.per_trade_cap !== null) {
            const cap = rp.per_trade_cap;
            if (!Number.isFinite(cap.value) || cap.value <= 0)
              return authErr('validation', 'Enter a number greater than zero.', 422);
            if (cap.unit === 'percent' && (cap.value <= 0 || cap.value > 100))
              return authErr('validation', 'Enter a percentage between 0 and 100.', 422);
            if (cap.unit === 'usd' && nextAccountSize != null && cap.value > nextAccountSize)
              return authErr(
                'validation',
                "Your per-trade cap can't exceed your account size.",
                422,
              );
          }
          if (state.riskInputs.storage_available === false) {
            // Storage-unavailable: a contained, honest 200 that claims nothing as saved (mirrors
            // the byo-ai-key precedent) — nothing is stored.
            const cur = state.session.settings ?? {
              active_persona_id: null,
              default_ticker: null,
              theme: 'dark' as const,
            };
            const next: UserSettings = { ...cur, ...patch, risk_inputs: state.riskInputs };
            state.session = { ...state.session, settings: next };
            return json(next);
          }
          const accountSize =
            'account_size' in rp ? (rp.account_size ?? null) : state.riskInputs.account_size;
          const perTradeCap =
            'per_trade_cap' in rp ? (rp.per_trade_cap ?? null) : state.riskInputs.per_trade_cap;
          state.riskInputs = {
            ...state.riskInputs,
            account_size: accountSize,
            per_trade_cap: perTradeCap,
            state: accountSize != null || perTradeCap != null ? 'set' : 'not_set',
            effective_dollar_cap: deriveEffectiveDollarCap(accountSize, perTradeCap),
            updated_at: Date.now(),
          };
        }
        const cur = state.session.settings ?? {
          active_persona_id: null,
          default_ticker: null,
          theme: 'dark' as const,
        };
        const next: UserSettings = { ...cur, ...patch, risk_inputs: state.riskInputs };
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
      if (url.includes('/api/auth/grok') && method === 'DELETE') {
        if (!state.session.authenticated)
          return keyJson({ error: 'auth_required', message: 'sign in' }, 403);
        state.aiKey.grok = {
          ...state.aiKey.grok,
          connected: false,
          unavailable_reason: 'oauth_unlinked',
        };
        if (state.aiKey.preference.power_path === 'grok_subscription') {
          state.aiKey.preference = { ...state.aiKey.preference, power_path: null };
        }
        return keyJson(makeAiBootstrap(state.aiKey));
      }
      // ---- ai-providers credential endpoints (write-only key; full bootstrap) -------------------
      if (url.includes('/api/auth/ai-key')) {
        if (!state.session.authenticated)
          return keyJson({ error: 'auth_required', message: 'sign in' }, 403);
        if (method === 'GET') {
          calls.aiKeyGet++;
          // D4: persist recommended default when model is still null.
          if (state.aiKey.preference.model == null) {
            const rec =
              state.aiKey.catalog.providers[0]?.models.find((m) => m.recommended)?.id ?? null;
            state.aiKey.preference = { ...state.aiKey.preference, model: rec };
          }
          return keyJson(makeAiBootstrap(state.aiKey));
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
            return keyJson({ ...makeAiBootstrap(state.aiKey), storage_available: false });
          }
          const parsed = body ? (JSON.parse(body) as { key?: string; provider?: string }) : {};
          const raw = parsed.key ?? '';
          const provider = (parsed.provider ?? '') as ByoProvider;
          if (!BYO_PROVIDERS.includes(provider))
            return keyJson({ error: 'validation', message: 'provider required' }, 422);
          state.aiKey.slots[provider] = { set: true, last4: raw.slice(-4) };
          const catalog =
            state.aiKey.catalog.providers.find((p) => p.provider === provider)?.models ?? [];
          const keep =
            state.aiKey.preference.model &&
            catalog.some((m) => m.id === state.aiKey.preference.model)
              ? state.aiKey.preference.model
              : (catalog.find((m) => m.recommended)?.id ?? state.aiKey.preference.model);
          state.aiKey.preference = {
            power_path: 'own_key',
            provider,
            model: keep,
          };
          return keyJson(makeAiBootstrap(state.aiKey));
        }
        if (method === 'DELETE') {
          calls.aiKeyDelete++;
          const q = new URL(url, 'http://local.invalid').searchParams.get(
            'provider',
          ) as ByoProvider | null;
          if (!q || !BYO_PROVIDERS.includes(q))
            return keyJson({ error: 'validation', message: 'provider required' }, 422);
          state.aiKey.slots[q] = { set: false, last4: null };
          if (
            state.aiKey.preference.power_path === 'own_key' &&
            state.aiKey.preference.provider === q
          ) {
            state.aiKey.preference = {
              ...state.aiKey.preference,
              power_path: null,
              provider: null,
            };
          }
          return keyJson(makeAiBootstrap(state.aiKey));
        }
      }
      // ---- trader bundle (UNTOUCHED by auth) ----------------------------------------------------
      if (url.includes('/api/ticker/')) {
        calls.ticker++;
        tickerCalls.push({ url, init });
        return json(makeBundle());
      }
      // ---- tradeable-rec-inputs: the dedicated candidate-set pull (anonymous-ok, STATIC) ---------
      if (url.includes('/api/candidates/')) {
        calls.candidatesGet++;
        return json(state.candidates);
      }
      // ---- ai-rec status / export / personas / contract (anonymous-usable floors) ---------------
      if (url.includes('/api/recommendation/status/')) {
        const signedIn = state.session.authenticated;
        const pref = state.aiKey.preference;
        const usable =
          signedIn &&
          ((pref.power_path === 'own_key' &&
            pref.provider != null &&
            state.aiKey.slots[pref.provider]?.set) ||
            (pref.power_path === 'grok_subscription' &&
              state.aiKey.grok.connected &&
              state.aiKey.grok.available));
        const reason = !signedIn
          ? null
          : pref.power_path == null
            ? 'no_key'
            : state.recKey === 'key_unusable'
              ? 'key_unusable'
              : state.recKey === 'key_rejected'
                ? 'key_rejected'
                : state.recKey === 'model_not_in_catalog'
                  ? 'model_not_in_catalog'
                  : state.recKey === 'oauth_expired'
                    ? 'oauth_expired'
                    : state.recKey === 'oauth_unlinked'
                      ? 'oauth_unlinked'
                      : state.recKey === 'subscription_unavailable'
                        ? 'subscription_unavailable'
                        : usable
                          ? null
                          : 'no_key';
        return keyJson({
          availability: { in_app_enabled: !!usable },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
          powering: {
            key_source: usable
              ? pref.power_path === 'grok_subscription'
                ? 'grok_subscription'
                : 'own_key'
              : 'none',
            provider: pref.power_path === 'own_key' ? pref.provider : null,
            model: pref.model,
            unavailable_reason: reason,
            preference: signedIn ? pref : { power_path: null, provider: null, model: null },
          },
        });
      }
      if (url.includes('/api/recommendation/export/')) {
        // The export floor — context (incl. candidates/risk_inputs/open_positions) + persona prompt
        // + glossary + the amended egress note/categories (AC-90/AC-97). Anonymous ALWAYS sees
        // `risk_inputs.state: 'not_set'` — present, never omitted.
        const anonymousRisk = !state.session.authenticated;
        const exportRisk = anonymousRisk
          ? defaultRiskInputs()
          : { ...state.riskInputs, storage_available: undefined, updated_at: undefined };
        return keyJson({
          ticker: 'TSLA',
          as_of: '2026-06-26T14:00:00Z',
          context: {
            gamma_flip: 248,
            market_state: { straddle_move: defaultStraddleMove },
            candidates: state.candidates,
            risk_inputs: {
              state: exportRisk.state,
              account_size: exportRisk.account_size,
              per_trade_cap: exportRisk.per_trade_cap,
              effective_dollar_cap: exportRisk.effective_dollar_cap,
            },
            open_positions: { source: 'simulated', state: 'not_sent' },
          },
          persona_prompt: 'prompt',
          glossary: 'glossary',
          egress_note:
            'This is the complete, reviewable list of what leaves the machine for TSLA, on demand: ' +
            'the computed snapshot, the candidate contracts, your risk inputs, your open simulated ' +
            "positions, your persona's prompt, and the field glossary. No other ticker, no name, " +
            'email or login, no broker credentials, and no API key ever leave. Nothing is ever ' +
            'placed as an order.',
          egress_categories: [
            { key: 'context', sent: true },
            { key: 'candidates', sent: true },
            { key: 'risk_inputs', sent: true },
            { key: 'open_positions', sent: true },
            { key: 'persona_prompt', sent: true },
            { key: 'glossary', sent: true },
          ],
        });
      }
      if (url.includes('/api/recommendation/') && method === 'POST') {
        calls.recPost++;
        recPostInits.push(init ?? {});
        const bodyStr = String(init?.body ?? '{}');
        recPostBodies.push(bodyStr);
        const reqBody = init?.body ? (JSON.parse(bodyStr) as { open_positions?: unknown }) : {};
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
          right: 'call' as const,
        };
        const promptCandidates = {
          ...state.candidates,
          budget: 'prompt' as const,
          sent_to_model: true,
        };
        const openPositions = (reqBody.open_positions as
          { source: string; state: string } | undefined) ?? {
          source: 'simulated',
          state: 'not_sent',
        };
        const sent = {
          budget: 'prompt' as const,
          candidates: promptCandidates,
          straddle_move_tenors: [defaultStraddleMove.primary_expiration],
          risk_inputs: state.riskInputs,
          risk_inputs_digest: `${state.riskInputs.state}:${state.riskInputs.account_size ?? 'null'}:${state.riskInputs.per_trade_cap?.value ?? 'null'}${state.riskInputs.per_trade_cap?.unit ?? ''}`,
          open_positions: openPositions,
        };
        const fieldReasons = {
          max_risk: null,
          position_size: null,
          exit_target: null,
          exit_stop: null,
          invalidation_level: null,
        };
        const citedContract = {
          state: 'cited' as const,
          contract:
            state.candidates.contracts.find((c) => c.strike === 260 && c.right === 'call') ?? null,
          legs: [],
        };

        // byo-ai-key — the 5 observable wire shapes (INTERFACE_CONTRACT §3).
        if (state.recKey === 'produced_own') {
          return keyJson({
            ...base,
            status: 'produced',
            strategy,
            unavailable_reason: null,
            key_source: 'own_key',
            provider: state.aiKey.preference.provider ?? 'anthropic',
            model: state.aiKey.preference.model,
            sent,
            cap_check: state.capCheck,
            field_reasons: fieldReasons,
            cited_contract: citedContract,
          });
        }
        if (state.recKey === 'produced_subscription') {
          return keyJson({
            ...base,
            status: 'produced',
            strategy,
            unavailable_reason: null,
            key_source: 'grok_subscription',
            provider: null,
            model: state.aiKey.preference.model,
            sent,
            cap_check: state.capCheck,
            field_reasons: fieldReasons,
            cited_contract: citedContract,
          });
        }
        const blocked: Record<string, string> = {
          no_key: 'no_key',
          key_unusable: 'key_unusable',
          key_rejected: 'key_rejected',
          model_not_in_catalog: 'model_not_in_catalog',
          oauth_expired: 'oauth_expired',
          oauth_unlinked: 'oauth_unlinked',
          subscription_unavailable: 'subscription_unavailable',
        };
        if (state.recKey in blocked) {
          return keyJson({
            ...base,
            status: 'unavailable',
            strategy: null,
            unavailable_reason: blocked[state.recKey],
            key_source: 'none',
            provider: state.aiKey.preference.provider,
            model: state.aiKey.preference.model,
          });
        }
        return keyJson({
          ...base,
          status: 'unavailable',
          strategy: null,
          unavailable_reason: 'no_key',
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
    recPostBodies,
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
      state.aiKey = normalizeAiKeyState({ ...state.aiKey, ...s });
    },
    setRiskInputs(patch) {
      state.riskInputs = { ...state.riskInputs, ...patch };
    },
    setCapCheck(patch) {
      state.capCheck = { ...state.capCheck, ...patch };
    },
    setCandidates(patch) {
      state.candidates = { ...state.candidates, ...patch };
    },
  };
  return backend;
}

export function uninstallAuthBackend() {
  vi.unstubAllGlobals();
}
