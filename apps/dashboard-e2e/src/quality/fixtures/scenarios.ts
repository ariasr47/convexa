import { FIXTURE_CAPTURE_AT, FIXTURE_NOW } from './data';
export type Scenario = {
  id: string;
  route: string;
  auth: 'anonymous' | 'authenticated';
  durableSeed: Record<string, unknown>;
  stream: 'none' | 'connected' | 'payload-gap';
  rest: Record<string, { status?: number; contentType?: string; body: string }>;
  now: typeof FIXTURE_NOW;
  captureAt: typeof FIXTURE_CAPTURE_AT;
  locale: 'en-US';
  timezoneId: 'UTC';
  viewport: { width: number; height: number };
  colorScheme: 'dark' | 'light';
  deviceScaleFactor: 1;
  reducedMotion: 'reduce';
  ready: { selector: string; text?: string }[];
  forbidden: { selector: string }[];
};
const response = (x: unknown) => ({ body: JSON.stringify(x), contentType: 'application/json' });
const errorResponse = (status: number, x: unknown) => ({
  status,
  body: JSON.stringify(x),
  contentType: 'application/json',
});
const bundle = {
  market_state: {
    ticker: 'SPY',
    price: 500,
    gex_spot: 500,
    timestamp: 1,
    timestamp_iso: FIXTURE_NOW,
    call_wall: 510,
    put_wall: 490,
    gamma_flip: 498,
    max_pain: 500,
    net_gex: 1,
    call_gex: 1,
    put_gex: -1,
    net_dex: 1,
    dte_min: 7,
    dte_max: 45,
    atm_iv: 0.3,
    hv_30d: 0.25,
    iv_hv_ratio: 1.1,
    put_call_ratio: 0.8,
    chain_vol_oi_ratio: 0.5,
    total_volume: 1000,
  },
  signals: {
    ticker: 'SPY',
    regime: 'positive_gamma',
    regime_note: null,
    vol_regime: 'neutral',
    distances: {},
    setups: [],
    opportunity_score: 42,
    opportunity_tier: 'watch',
    prime_prompt_eligible: false,
  },
  strike_profile: { ticker: 'SPY', spot: 500, strikes: [] },
  expirations: [],
  ai_eval: {
    ready: true,
    reasons: [],
    changed: true,
    state_fingerprint: 'fixture-fingerprint',
    score_threshold: 50,
  },
  meta: {
    served_at: FIXTURE_NOW,
    cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
    freshness: {
      snapshot_iso: FIXTURE_NOW,
      data_age_seconds: 10,
      stale: false,
      stale_after_seconds: 600,
    },
  },
  position_eval: null,
};
// The visual AI arm must exercise the produced state, not merely the idle/gated card. This is a
// contract-shaped deterministic response (no live model or backend data) with the fields the panel
// renders in its decision card and analysis sheet.
const producedRecommendation = {
  status: 'produced',
  persona: { id: null, name: 'Default (no persona)' },
  as_of: FIXTURE_NOW,
  pinned_fingerprint: 'fixture-fingerprint',
  stale_born: false,
  strategy: {
    decision: 'trade',
    bias: 'long',
    structure: 'call debit spread',
    strikes: [500, 505],
    expiration: '2026-09-18',
    entry_trigger: 'break above 500',
    invalidation_level: 498,
    max_risk: '$300',
    position_size: '2 contracts',
    exit_plan: { target: 512, stop: 498 },
    time_horizon: '5–10 trading days',
    confidence: 'medium',
    rationale: 'Call wall and gamma positioning support the setup.',
    right: 'call',
  },
  unavailable_reason: null,
  gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
  cap: { over_limit: false, remaining_today: 49, resets_at: FIXTURE_NOW },
  sent: {
    budget: 'prompt',
    candidates: {
      ticker: 'SPY',
      state: 'ok',
      as_of: FIXTURE_NOW,
      snapshot_age_seconds: 10,
      session_basis: 'regular',
      quote_age: 'fresh',
      anchor_spot: 500,
      anchor_basis: 'gex_spot',
      band_pct: 15,
      sent_to_model: true,
      caps: { tenors: 2, rights: 2, strikes_per_tenor_right: 5, max_records: 20, max_bytes: 8000 },
      included: { contracts: 0, expirations: [], expiration_count: 0 },
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
        quoted: 0,
        no_two_sided_quote: 0,
        atm_relative_spread_band: 'moderate',
        wide_quotes: false,
        wide_quote_threshold_pct: 15,
      },
      contracts: [],
    },
    straddle_move_tenors: ['2026-09-18'],
    risk_inputs: {
      state: 'set',
      account_size: 50_000,
      per_trade_cap: { value: 1, unit: 'percent' },
      effective_dollar_cap: {
        state: 'derived',
        value: 500,
        not_derivable_reason: null,
        derived_from: { account_size: 50_000, cap_value: 1, cap_unit: 'percent' },
      },
      storage_available: true,
      updated_at: 1_700_000_000_000,
    },
    risk_inputs_digest: 'set:50000:1percent',
    open_positions: {
      source: 'simulated',
      state: 'none_open',
      this_underlying: null,
      portfolio: null,
    },
  },
  cap_check: {
    verdict: 'within',
    effective_dollar_cap: 500,
    cap_not_derivable_reason: null,
    parsed_risk_dollars: 300,
    model_max_risk_text: '$300',
    risk_refusal: null,
  },
  field_reasons: {
    max_risk: null,
    position_size: null,
    exit_target: null,
    exit_stop: null,
    invalidation_level: null,
  },
  cited_contract: { state: 'none', contract: null, legs: [] },
  grounding: {
    card: 'all_traced',
    counts: { checked: 4, traced: 4, untraced: 0, not_checkable: 0 },
    tolerance_pct: 0.1,
    fields: {
      exit_stop: { state: 'traced', basis: 'exact', anchor_kind: 'gex_spot', anchor_value: 498 },
      exit_target: {
        state: 'traced',
        basis: 'inside_range',
        range_low: 490,
        range_high: 520,
        expiration: '2026-09-18',
      },
      invalidation_level: {
        state: 'traced',
        basis: 'exact',
        anchor_kind: 'gex_spot',
        anchor_value: 498,
      },
      max_risk: { state: 'not_checkable', not_checkable_reason: 'structurally_unchecked' },
      position_size: { state: 'not_checkable', not_checkable_reason: 'structurally_unchecked' },
    },
  },
};
const session = (signed: boolean) => ({
  authenticated: signed,
  user: signed
    ? {
        id: 'quality-user',
        email: 'quality-user@fixture.invalid',
        display_name: 'Quality Fixture',
        auth_methods: ['password'],
      }
    : null,
  google_available: false,
  settings: signed ? { active_persona_id: null, default_ticker: null, theme: 'dark' } : null,
});
/** GET /api/health as the paused production API answers it. A live build reads it once per page
 *  load (`getMarketDataMode`, libs/api; since `de6aa430`), so every scan sends it. The keys are the
 *  closed `HealthWire` that `health()` builds (apps/api/src/routes/health.rs), and every value is
 *  what production served on 2026-10-25 (docs/quality/2026-10-25/SITE-AUDIT.md, SEC-4). Production
 *  is paused with no vendor key, so `market_data` is `not_live` (`Config::market_data_state`,
 *  apps/api/src/config.rs). The dashboard reads `market_data` alone. */
const pausedProductionHealth = {
  status: 'ok',
  service: 'api-rust',
  release: '7810a87ba81f527f8a2978c70a44f2daa275136f',
  price_cache: 'memory',
  durable_store: 'postgres',
  data_feed: 'realtime',
  gex_kernel: 'avx2-f64x4',
  scanner: {
    enabled: false,
    embedded: true,
    market_hours_only: true,
    universe_size: 69,
    board: {
      rows: 69,
      by_status: { error: 69 },
      priced: 69,
      scored: 69,
      history_samples: 39744,
      history_backend: 'postgres',
      history_symbols: 12,
      history_top: [
        'AAPL',
        'ADBE',
        'AMD',
        'AMZN',
        'ARM',
        'AVGO',
        'BA',
        'BABA',
        'BAC',
        'COIN',
        'COST',
        'CRM',
      ].map((symbol) => ({ symbol, n: 576 })),
      sweep_last_completed: 1790280078.472,
      heartbeat_updated_at: 1790280078.472,
    },
  },
  rate_limit: { public_per_min: 30, enabled: true },
  ai_meter: {
    scope: 'process_local_with_postgres',
    daily_cap: 50,
    note: 'Process-local daily AI-rec cap; correct for a single api replica',
  },
  metrics_auth: 'required',
  warm: { enabled: false, symbols: ['SPY', 'QQQ', 'NVDA'], interval_secs: 25, concurrency: 2 },
  gex_cache: {
    hits: 0,
    misses: 0,
    sets: 0,
    expirations: 0,
    warm_refreshes: 0,
    warm_errors: 0,
    hit_rate: 0.0,
    entries: 0,
    warm_symbols: ['SPY', 'QQQ', 'NVDA'],
    ttl_default_secs: 10,
    ttl_liquid_secs: 20,
  },
  market_data: 'not_live',
};
/** The same server with its feed on (`MARKET_DATA_MODE=live`). `market_data` is the field the mode
 *  sets. `scanner.enabled` and `warm.enabled` are each `flag && is_live()` in `health()`, and stay
 *  false here, as they do with SCAN_ENABLED and WARM_ENABLED off. */
const liveFeedHealth = { ...pausedProductionHealth, market_data: 'live' };
const scanRows = ['SPY', 'QQQ', 'NVDA'].map((symbol, i) => ({
  symbol,
  price: 500 - i * 10,
  chg_pct: i === 1 ? -0.4 : 1.2,
  score: 90 - i * 12,
  tier: i === 0 ? 'prime' : 'watch',
  regime: 'positive_gamma',
  vol_regime: 'iv_rich',
  flip: 498 - i,
  dist_to_flip_pct: 1 + i,
  call_wall: 510,
  put_wall: 490,
  dist_to_wall_pct: i ? -1 : 2,
  as_of: 1787500800,
  status: 'ok',
}));
const densePositions = Object.fromEntries(
  [0, 1, 2].map((i) => [
    `fixture-position-${i}`,
    {
      id: `fixture-position-${i}`,
      legs: [
        {
          id: `fixture-leg-${i}`,
          kind: 'option',
          ticker: 'SPY',
          side: 'long',
          qty: 1 + i,
          multiplier: 100,
          entry_price: 10 + i,
          entry_basis: 'manual',
          expiration: '2026-09-18',
          strike: 500 + i * 5,
          right: 'call',
        },
        {
          id: `fixture-leg-${i}-hedge`,
          kind: 'option',
          ticker: 'SPY',
          side: 'short',
          qty: 1,
          multiplier: 100,
          entry_price: 6 + i,
          entry_basis: 'manual',
          expiration: '2026-09-18',
          strike: 505 + i * 5,
          right: 'call',
        },
      ],
      opened_time: '2026-08-23T15:00:00.000Z',
      status: 'open',
      entry_mode: 'manual',
      schema_version: 3,
    },
  ]),
);
const denseConfig = {
  columns: [
    'contract',
    'structure',
    'qty',
    'entry',
    'mark',
    'pl',
    'pl_pct',
    'delta_entry',
    'trend',
    'max_loss',
    'expiry',
  ],
  sortKey: 'entry_time',
  sortDir: 'desc',
  group: 'none',
  layout: 'table',
  density: 'comfortable',
  filter: { ticker: null, status: ['open'], structure: null, expiry: null },
};
const denseBook = {
  schema_version: 3,
  positions: densePositions,
  decisions: [],
  customization: {
    views: [{ id: 'all', name: 'All positions', builtin: true, config: denseConfig }],
    activeViewId: 'all',
    working: denseConfig,
  },
};
const base = (
  id: string,
  route: string,
  auth: Scenario['auth'],
  viewport: Scenario['viewport'],
  colorScheme: Scenario['colorScheme'],
  ready: { selector: string; text?: string }[],
  forbidden = [{ selector: '[data-testid="route-fallback"]' }],
): Scenario => ({
  id,
  route,
  auth,
  durableSeed: {
    'convexa.uiprefs.v1': { schema_version: 1, theme: colorScheme },
    ...(auth === 'authenticated' ? { 'convexa.positions.v3': denseBook } : {}),
  },
  stream: 'connected',
  rest: {
    'GET /api/health': response(pausedProductionHealth),
    'GET /api/auth/session': response(session(auth === 'authenticated')),
    'POST /api/auth/login': errorResponse(401, {
      error: 'bad_credentials',
      message: 'Invalid credentials.',
    }),
    'GET /api/ticker/SPY': response(bundle),
    'GET /api/ticker/TSLA': response({
      ...bundle,
      market_state: { ...bundle.market_state, ticker: 'TSLA' },
      signals: { ...bundle.signals, ticker: 'TSLA' },
      strike_profile: { ...bundle.strike_profile, ticker: 'TSLA' },
    }),
    'GET /api/ticker/SPY?dark_pool=true': response(bundle),
    'GET /api/ticker/SPY?pos_expiration=2026-09-18&pos_strike=500&pos_right=call&dark_pool=true':
      response(bundle),
    'GET /api/scan/universe': response({ symbols: ['SPY', 'QQQ', 'NVDA'], universe_size: 3 }),
    'GET /api/scan': response({
      view: {
        source: 'default',
        authenticated: auth === 'authenticated',
        name: null,
        symbols: ['SPY', 'QQQ', 'NVDA'],
        sort: { key: 'score', dir: 'desc' },
        density: 'compact',
      },
      rows: scanRows,
      sweep: { updated_at: 1, sweep_last_completed: 1, universe_size: 3 },
    }),
    'GET /api/scan/SPY/history?limit=48': response({ history: [] }),
    'GET /api/personas': response([]),
    'GET /api/broker/credential': response({ set: false, last4: null, storage_available: true }),
    'GET /api/recommendation/status/SPY': response({
      availability: { in_app_enabled: id === 'ai-recommendation' },
      gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
      cap: { over_limit: false, remaining_today: 49, resets_at: FIXTURE_NOW },
    }),
    'GET /api/auth/ai-key': response({
      storage_available: true,
      providers: [{ provider: 'anthropic', set: true, last4: '1234' }],
      grok: { available: false, connected: false, unavailable_reason: null },
      preference: { power_path: 'own_key', provider: 'anthropic', model: 'claude-opus-4-8' },
      catalog: {
        providers: [
          { provider: 'anthropic', models: [{ id: 'claude-opus-4-8', recommended: true }] },
        ],
      },
    }),
    'POST /api/recommendation/SPY': response(producedRecommendation),
    'GET /api/book': response({ blob: {}, updated_at: 0 }),
    'GET /api/contract/SPY?expiration=2026-09-18&strike=500&right=call': response({
      ticker: 'SPY',
      expiration: '2026-09-18',
      strike: 500,
      right: 'call',
      option_quote: { bid: 10, ask: 10.2, mid: 10.1 },
      greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
      iv: 0.3,
      dte: 26,
    }),
    'GET /api/contract/SPY?expiration=2026-09-18&strike=505&right=call': response({
      ticker: 'SPY',
      expiration: '2026-09-18',
      strike: 505,
      right: 'call',
      option_quote: { bid: 7, ask: 7.2, mid: 7.1 },
      greeks: { delta: 0.4, gamma: 0.01, theta: -0.05, vega: 0.1 },
      iv: 0.3,
      dte: 26,
    }),
    'GET /api/contract/SPY?expiration=2026-09-18&strike=510&right=call': response({
      ticker: 'SPY',
      expiration: '2026-09-18',
      strike: 510,
      right: 'call',
      option_quote: { bid: 4, ask: 4.2, mid: 4.1 },
      greeks: { delta: 0.3, gamma: 0.01, theta: -0.05, vega: 0.1 },
      iv: 0.3,
      dte: 26,
    }),
    'GET /api/contract/SPY?expiration=2026-09-18&strike=515&right=call': response({
      ticker: 'SPY',
      expiration: '2026-09-18',
      strike: 515,
      right: 'call',
      option_quote: { bid: 2, ask: 2.2, mid: 2.1 },
      greeks: { delta: 0.2, gamma: 0.01, theta: -0.05, vega: 0.1 },
      iv: 0.3,
      dte: 26,
    }),
  },
  now: FIXTURE_NOW,
  captureAt: FIXTURE_CAPTURE_AT,
  locale: 'en-US',
  timezoneId: 'UTC',
  viewport,
  colorScheme,
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
  ready,
  forbidden,
});
/** GATE Z I-2 (amendment 5) — force the app-wide who-am-I read to FAIL (503), so `RequireAuth`
 *  renders its DEGRADED branch (`subsystemDegraded`) instead of the normal wall: the new "Try
 *  again" CTA (`require-auth-retry`) the widened AC-G1 scan matrix must also cover. */
function withSessionFault(scenario: Scenario): Scenario {
  return {
    ...scenario,
    rest: {
      ...scenario.rest,
      'GET /api/auth/session': errorResponse(503, {
        error: 'auth_unavailable',
        message: 'auth down',
      }),
    },
  };
}
/** A scenario whose surface only a server with its feed on serves: the full ticker desk (with its
 *  cold-load failure, offline tape and paused-bundle panel) and the scanner board. A live build
 *  mounts those only when /api/health does not report the feed off. On `not_live` it mounts the
 *  public desk and the scanner's explain page instead (app.tsx `TickerDeskRoute`, `ScannerRoute`). */
function withLiveFeed(scenario: Scenario): Scenario {
  return {
    ...scenario,
    rest: { ...scenario.rest, 'GET /api/health': response(liveFeedHealth) },
  };
}
export const journeys = [
  // Lands on `/`, then reaches the full desk: the server has its feed on.
  withLiveFeed(
    base('landing-ticker-navigation', '/', 'anonymous', { width: 1280, height: 900 }, 'dark', [
      { selector: '[data-testid="landing"]' },
    ]),
  ),
  withLiveFeed({
    ...base(
      'ticker-stream-loss',
      '/ticker/SPY',
      'anonymous',
      { width: 1280, height: 900 },
      'dark',
      [{ selector: '[data-testid="command-deck"]' }, { selector: '[data-testid="widget-bento"]' }],
    ),
    stream: 'payload-gap' as const,
  }),
  base('signed-out-auth-dialog', '/positions', 'anonymous', { width: 1280, height: 900 }, 'dark', [
    { selector: '[data-testid="require-auth-wall"]' },
  ]),
  // Walks on from the book to the scanner board: the server has its feed on.
  withLiveFeed(
    base('dense-positions', '/positions', 'authenticated', { width: 393, height: 852 }, 'dark', [
      { selector: '[data-testid="portfolio-panel"]' },
    ]),
  ),
  withLiveFeed(
    base('dense-scanner', '/scanner', 'authenticated', { width: 393, height: 852 }, 'dark', [
      { selector: '[data-testid="scanner-page"]' },
    ]),
  ),
  withLiveFeed(
    base(
      'ai-recommendation',
      '/ticker/SPY',
      'authenticated',
      { width: 393, height: 852 },
      'light',
      [{ selector: '[data-testid="widget-bento"]' }],
    ),
  ),
];
export const accessibilityScenarios = [
  base('A11Y-1', '/', 'anonymous', { width: 1280, height: 900 }, 'dark', [
    { selector: '[data-testid="app-shell"]' },
    { selector: '[data-testid="landing"]' },
    { selector: '[data-testid="cta-primary"]' },
  ]),
  base('A11Y-2', '/', 'anonymous', { width: 1280, height: 900 }, 'light', [
    { selector: '[data-testid="app-shell"]' },
    { selector: '[data-testid="landing"]' },
    { selector: '[data-testid="cta-primary"]' },
  ]),
  withLiveFeed(
    base('A11Y-3', '/ticker/SPY', 'anonymous', { width: 1280, height: 900 }, 'dark', [
      { selector: '[data-testid="command-deck"]' },
      { selector: '[data-testid="widget-bento"]' },
      { selector: '[data-testid="freshness-line"]' },
    ]),
  ),
  base('A11Y-4', '/settings', 'authenticated', { width: 1280, height: 900 }, 'dark', [
    { selector: '[data-testid="settings-page"]' },
    { selector: '[data-testid="settings-account-signed-in"]' },
    { selector: '[data-testid="settings-preferences-panel"]' },
  ]),
  base(
    'A11Y-5',
    '/positions',
    'authenticated',
    { width: 393, height: 852 },
    'dark',
    [
      { selector: '[data-testid="portfolio-panel"]' },
      { selector: '[data-testid="positions-cards"]' },
    ],
    [
      { selector: '[data-testid="empty-no-positions"]' },
      { selector: '[data-testid="empty-filtered"]' },
      { selector: '[data-testid="empty-faulted"]' },
    ],
  ),
  withLiveFeed(
    base('A11Y-6', '/scanner', 'authenticated', { width: 393, height: 852 }, 'dark', [
      { selector: '[data-testid="scanner-page"]' },
      { selector: '[data-testid="scan-cards"]' },
    ]),
  ),
  withLiveFeed(
    base('A11Y-7', '/scanner', 'authenticated', { width: 393, height: 852 }, 'dark', [
      { selector: '[data-testid="scanner-page"]' },
      { selector: '[data-testid="scan-empty-view"]', text: 'No tickers in your view.' },
    ]),
  ),
  withLiveFeed(
    base(
      'A11Y-8',
      '/ticker/SPY',
      'anonymous',
      { width: 1280, height: 900 },
      'dark',
      // Fidelity repair 2, N7 — the design's cold-start-failure sentence, never the raw client
      // status string (the status itself is kept, as a Mono detail line — `HTTP 503` — so this
      // substring match still proves nothing is hidden).
      [{ selector: '[role="alert"]', text: "Couldn't load SPY." }],
      [
        { selector: '[data-testid="cold-load"]' },
        { selector: '[data-testid="command-deck"]' },
        { selector: '[data-testid="widget-bento"]' },
      ],
    ),
  ),
  withLiveFeed({
    ...base('A11Y-9', '/ticker/SPY', 'anonymous', { width: 1280, height: 900 }, 'dark', [
      { selector: '[data-testid="command-deck"]' },
      { selector: '[data-testid="widget-bento"]' },
      // Re-pointed (curvature-v2-foundations, AC-57): folded into the ONE connection chip; the
      // label no longer carries the literal `⚠`/`⏸` glyph (a stroke icon renders instead).
      {
        selector: '[data-testid="connection-chip"][data-connection-state="offline"]',
        text: 'Live offline',
      },
      { selector: '[data-testid="last-trade"]', text: '⏸ Last trade' },
    ]),
    stream: 'payload-gap' as const,
  }),
  // (curvature-v2-landing-and-site F15, AC-G1) three new public surfaces. A11Y-1/A11Y-2 already
  // scan `/` in dark and light and pick up the footer mount; every scan below picks up the footer
  // for free.
  base('A11Y-10', '/blog', 'anonymous', { width: 393, height: 852 }, 'dark', [
    { selector: '[data-testid="blog-page"]' },
    { selector: '[data-testid="site-footer"]' },
  ]),
  base('A11Y-11', '/methodology', 'anonymous', { width: 393, height: 852 }, 'dark', [
    { selector: '[data-testid="methodology-page"]' },
    { selector: '[data-testid="methodology-toc"]' },
  ]),
  base(
    'A11Y-12',
    '/this-address-does-not-exist',
    'anonymous',
    { width: 1280, height: 900 },
    'dark',
    [{ selector: '[data-testid="not-found-page"]' }, { selector: '[data-testid="site-footer"]' }],
  ),
  // GATE Z I-2 (AC-G1, amendment 5) — the scan matrix is NAMED, not left to whatever the gate
  // happened to cover: each of the six surfaces (/, /blog, /methodology, the 404, the sign-in
  // wall, the degraded wall) in dark AND light at 393; the 404 stays additionally at 1280
  // (A11Y-12 above, unchanged — "as today"); the sign-in wall, the degraded wall and the open
  // sign-in dialog each count as surfaces and are scanned in both schemes at 393 too. Of the
  // twelve 393-scheme combinations the six-surface bullet requires, two already existed
  // (A11Y-10 blog/dark, A11Y-11 methodology/dark) — only the gaps are new here. APPENDED, never
  // inserted: A11Y-1..A11Y-12's array INDICES are hard-relied-on by A11Y-B1/B2/B4/B5/B6/B7 below.
  base('A11Y-13', '/', 'anonymous', { width: 393, height: 852 }, 'dark', [
    { selector: '[data-testid="landing"]' },
  ]),
  base('A11Y-14', '/', 'anonymous', { width: 393, height: 852 }, 'light', [
    { selector: '[data-testid="landing"]' },
  ]),
  base('A11Y-15', '/blog', 'anonymous', { width: 393, height: 852 }, 'light', [
    { selector: '[data-testid="blog-page"]' },
    { selector: '[data-testid="site-footer"]' },
  ]),
  base('A11Y-16', '/methodology', 'anonymous', { width: 393, height: 852 }, 'light', [
    { selector: '[data-testid="methodology-page"]' },
    { selector: '[data-testid="methodology-toc"]' },
  ]),
  base(
    'A11Y-17',
    '/this-address-does-not-exist',
    'anonymous',
    { width: 393, height: 852 },
    'dark',
    [{ selector: '[data-testid="not-found-page"]' }, { selector: '[data-testid="site-footer"]' }],
  ),
  base(
    'A11Y-18',
    '/this-address-does-not-exist',
    'anonymous',
    { width: 393, height: 852 },
    'light',
    [{ selector: '[data-testid="not-found-page"]' }, { selector: '[data-testid="site-footer"]' }],
  ),
  base('A11Y-19', '/scanner', 'anonymous', { width: 393, height: 852 }, 'dark', [
    { selector: '[data-testid="require-auth-wall"]' },
  ]),
  base('A11Y-20', '/scanner', 'anonymous', { width: 393, height: 852 }, 'light', [
    { selector: '[data-testid="require-auth-wall"]' },
  ]),
  withSessionFault(
    base('A11Y-21', '/scanner', 'anonymous', { width: 393, height: 852 }, 'dark', [
      { selector: '[data-testid="require-auth-wall"]' },
      { selector: '[data-testid="require-auth-retry"]' },
    ]),
  ),
  withSessionFault(
    base('A11Y-22', '/scanner', 'anonymous', { width: 393, height: 852 }, 'light', [
      { selector: '[data-testid="require-auth-wall"]' },
      { selector: '[data-testid="require-auth-retry"]' },
    ]),
  ),
  // The open sign-in dialog: loaded at `/` (anonymous), then `accessibility.spec.ts` opens it
  // (via the nav's “Log in”, `account-signin`) before the axe scan — same special-case mechanism
  // A11Y-9 already uses. `ready` only requires the landing shell; the dialog's own presence is
  // asserted there.
  base('A11Y-23', '/', 'anonymous', { width: 393, height: 852 }, 'dark', [
    { selector: '[data-testid="landing"]' },
  ]),
  base('A11Y-24', '/', 'anonymous', { width: 393, height: 852 }, 'light', [
    { selector: '[data-testid="landing"]' },
  ]),
  // no-vendor-production-posture AC-10 — the paused ticker-desk panel (F2), both breakpoints and
  // both color schemes. `strict-fixture.ts` special-cases these four ids (mirrors A11Y-8's own
  // ticker-failure override) to answer every `GET /api/ticker/SPY*` with the exact paused 503 — a
  // prefix match, not an exact `rest` key, because the query string a fresh anonymous /ticker/SPY
  // visit sends (`dark_pool=true`) is an FE default, not a value worth pinning here. The panel is
  // the full desk's own cold start, so health says the feed is on (`withLiveFeed`): on `not_live` a
  // live build mounts the public desk, which never reads the bundle.
  withLiveFeed(
    base(
      'A11Y-25',
      '/ticker/SPY',
      'anonymous',
      { width: 393, height: 852 },
      'dark',
      [{ selector: '[role="status"]', text: 'Market data is paused.' }],
      [
        { selector: '[data-testid="cold-load"]' },
        { selector: '[data-testid="command-deck"]' },
        { selector: '[role="alert"]' },
      ],
    ),
  ),
  withLiveFeed(
    base(
      'A11Y-26',
      '/ticker/SPY',
      'anonymous',
      { width: 393, height: 852 },
      'light',
      [{ selector: '[role="status"]', text: 'Market data is paused.' }],
      [
        { selector: '[data-testid="cold-load"]' },
        { selector: '[data-testid="command-deck"]' },
        { selector: '[role="alert"]' },
      ],
    ),
  ),
  withLiveFeed(
    base(
      'A11Y-27',
      '/ticker/SPY',
      'anonymous',
      { width: 1280, height: 900 },
      'dark',
      [{ selector: '[role="status"]', text: 'Market data is paused.' }],
      [
        { selector: '[data-testid="cold-load"]' },
        { selector: '[data-testid="command-deck"]' },
        { selector: '[role="alert"]' },
      ],
    ),
  ),
  withLiveFeed(
    base(
      'A11Y-28',
      '/ticker/SPY',
      'anonymous',
      { width: 1280, height: 900 },
      'light',
      [{ selector: '[role="status"]', text: 'Market data is paused.' }],
      [
        { selector: '[data-testid="cold-load"]' },
        { selector: '[data-testid="command-deck"]' },
        { selector: '[role="alert"]' },
      ],
    ),
  ),
];
